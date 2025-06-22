import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import uuid4

from app.services.request_service import RequestService
from app.schemas.request import RequestCreate, Request as RequestSchema
from app.models.request import Request as RequestModel, RequestStatus
from app.core.exceptions import RequestCreationError, RequestRegenerationError, RequestNotFoundError

# Mock 全局变量，因为它们在服务模块顶层被导入
analysis_queue_mock = AsyncMock()
ws_manager_mock = MagicMock()
ws_manager_mock.broadcast_request_created = AsyncMock()

@pytest.fixture(autouse=True)
def mock_global_dependencies():
    """自动模拟全局依赖"""
    with patch('app.services.request_service.analysis_queue', analysis_queue_mock), \
         patch('app.services.request_service.ws_manager', ws_manager_mock):
        yield
        analysis_queue_mock.reset_mock()
        ws_manager_mock.reset_mock()
        ws_manager_mock.broadcast_request_created.reset_mock()


@pytest.fixture
def mock_db_session() -> AsyncMock:
    """提供一个 mock 的 AsyncSession"""
    return AsyncMock(spec=AsyncSession)

@pytest.fixture
def request_service(mock_db_session: AsyncMock) -> RequestService:
    """提供一个带有 mock 数据库会话的 RequestService 实例"""
    return RequestService(db=mock_db_session)

@pytest.mark.asyncio
async def test_create_request_success(
    request_service: RequestService,
    mock_db_session: AsyncMock
):
    """测试成功创建请求"""
    request_in = RequestCreate(
        prompt="Test prompt",
        negative_prompt="Test negative prompt",
        style_reference="Test style",
        aspect_ratio="16:9",
        image_references=["ref1.jpg", "ref2.png"]
    )
    owner_id = uuid4()
    mock_created_request = RequestModel(
        id=uuid4(),
        prompt=request_in.prompt,
        negative_prompt=request_in.negative_prompt,
        style_reference=request_in.style_reference,
        aspect_ratio=request_in.aspect_ratio,
        image_references=request_in.image_references,
        status=RequestStatus.PENDING,
        owner_id=owner_id
    )

    # Mock CRUD 操作
    crud_request_mock = AsyncMock()
    crud_request_mock.create_with_owner = AsyncMock(return_value=mock_created_request)

    with patch('app.services.request_service.crud_request', crud_request_mock):
        # 调用服务方法
        created_request_schema = await request_service.create_request(
            request_in=request_in,
            owner_id=owner_id
        )

        # 断言 CRUD 调用
        crud_request_mock.create_with_owner.assert_awaited_once_with(
            db=mock_db_session, obj_in=request_in, owner_id=owner_id
        )

        # 断言队列操作
        analysis_queue_mock.put.assert_awaited_once_with(mock_created_request.id)

        # 断言 WebSocket 广播
        ws_manager_mock.broadcast_request_created.assert_awaited_once()
        # 检查广播调用的参数（如果需要更精确的检查）
        call_args, _ = ws_manager_mock.broadcast_request_created.call_args
        assert isinstance(call_args[0], RequestSchema)
        assert call_args[0].id == mock_created_request.id

        # 断言返回结果
        assert isinstance(created_request_schema, RequestSchema)
        assert created_request_schema.id == mock_created_request.id
        assert created_request_schema.prompt == request_in.prompt
        assert created_request_schema.status == RequestStatus.PENDING
        assert created_request_schema.owner_id == owner_id


@pytest.mark.asyncio
async def test_regenerate_request_success(
    request_service: RequestService,
    mock_db_session: AsyncMock
):
    """测试成功重新生成请求"""
    original_request_id = uuid4()
    owner_id = uuid4()
    mock_original_request = RequestModel(
        id=original_request_id,
        prompt="Original prompt",
        negative_prompt="Original negative",
        style_reference="Original style",
        aspect_ratio="1:1",
        image_references=["orig1.jpg"],
        status=RequestStatus.COMPLETED, # 假设原始请求已完成
        owner_id=owner_id,
        result_image_url="http://example.com/original.jpg" # 假设有结果
    )
    mock_new_request = RequestModel(
        id=uuid4(),
        prompt=mock_original_request.prompt,
        negative_prompt=mock_original_request.negative_prompt,
        style_reference=mock_original_request.style_reference,
        aspect_ratio=mock_original_request.aspect_ratio,
        image_references=mock_original_request.image_references,
        status=RequestStatus.PENDING, # 新请求应为 PENDING
        owner_id=owner_id,
        original_request_id=original_request_id # 链接到原始请求
    )

    # Mock CRUD 操作
    crud_request_mock = AsyncMock()
    crud_request_mock.get_or_404 = AsyncMock(return_value=mock_original_request)
    crud_request_mock.create_with_owner = AsyncMock(return_value=mock_new_request)

    with patch('app.services.request_service.crud_request', crud_request_mock):
        # 调用服务方法
        regenerated_request_schema = await request_service.regenerate_request(
            original_request_id=original_request_id,
            owner_id=owner_id
        )

        # 断言 CRUD 调用 (get_or_404)
        crud_request_mock.get_or_404.assert_awaited_once_with(
            db=mock_db_session, id=original_request_id, owner_id=owner_id
        )

        # 断言 CRUD 调用 (create_with_owner)
        crud_request_mock.create_with_owner.assert_awaited_once()
        call_args, call_kwargs = crud_request_mock.create_with_owner.call_args
        created_obj_in = call_kwargs.get('obj_in') # 或者 call_args[1] 如果是位置参数
        assert isinstance(created_obj_in, RequestCreate)
        assert created_obj_in.prompt == mock_original_request.prompt
        assert created_obj_in.negative_prompt == mock_original_request.negative_prompt
        assert created_obj_in.style_reference == mock_original_request.style_reference
        assert created_obj_in.aspect_ratio == mock_original_request.aspect_ratio
        assert created_obj_in.image_references == mock_original_request.image_references
        assert created_obj_in.original_request_id == original_request_id
        assert call_kwargs.get('owner_id') == owner_id # 或者 call_args[2]

        # 断言队列操作
        analysis_queue_mock.put.assert_awaited_once_with(mock_new_request.id)

        # 断言 WebSocket 广播
        ws_manager_mock.broadcast_request_created.assert_awaited_once()
        broadcast_call_args, _ = ws_manager_mock.broadcast_request_created.call_args
        assert isinstance(broadcast_call_args[0], RequestSchema)
        assert broadcast_call_args[0].id == mock_new_request.id
        assert broadcast_call_args[0].original_request_id == original_request_id

        # 断言返回结果
        assert isinstance(regenerated_request_schema, RequestSchema)
        assert regenerated_request_schema.id == mock_new_request.id
        assert regenerated_request_schema.prompt == mock_original_request.prompt
        assert regenerated_request_schema.status == RequestStatus.PENDING
        assert regenerated_request_schema.owner_id == owner_id
        assert regenerated_request_schema.original_request_id == original_request_id


@pytest.mark.asyncio
async def test_get_request_success(
    request_service: RequestService,
    mock_db_session: AsyncMock
):
    """测试成功获取单个请求"""
    request_id = uuid4()
    owner_id = uuid4()
    mock_request = RequestModel(
        id=request_id,
        prompt="Test",
        status=RequestStatus.COMPLETED,
        owner_id=owner_id
    )

    # Mock CRUD 操作
    crud_request_mock = AsyncMock()
    crud_request_mock.get_or_404 = AsyncMock(return_value=mock_request)

    with patch('app.services.request_service.crud_request', crud_request_mock):
        # 调用服务方法
        retrieved_request = await request_service.get_request(
            request_id=request_id,
            owner_id=owner_id
        )

        # 断言 CRUD 调用
        crud_request_mock.get_or_404.assert_awaited_once_with(
            db=mock_db_session, id=request_id, owner_id=owner_id
        )

        # 断言返回结果
        assert isinstance(retrieved_request, RequestSchema)
        assert retrieved_request.id == request_id
        assert retrieved_request.owner_id == owner_id


@pytest.mark.asyncio
async def test_get_all_requests_success(
    request_service: RequestService,
    mock_db_session: AsyncMock
):
    """测试成功获取所有请求（分页）"""
    owner_id = uuid4()
    mock_requests = [
        RequestModel(id=uuid4(), prompt="Req 1", owner_id=owner_id),
        RequestModel(id=uuid4(), prompt="Req 2", owner_id=owner_id),
    ]
    skip = 0
    limit = 10

    # Mock CRUD 操作
    crud_request_mock = AsyncMock()
    crud_request_mock.get_multi_by_owner = AsyncMock(return_value=mock_requests)

    with patch('app.services.request_service.crud_request', crud_request_mock):
        # 调用服务方法
        retrieved_requests = await request_service.get_all_requests(
            owner_id=owner_id,
            skip=skip,
            limit=limit  # 修复：添加 limit 参数
        ) # 修复：添加右括号

        # 断言 CRUD 调用
        crud_request_mock.get_multi_by_owner.assert_awaited_once_with(
            db=mock_db_session, owner_id=owner_id, skip=skip, limit=limit
        )

        # 断言返回结果
        assert isinstance(retrieved_requests, list)
        assert len(retrieved_requests) == len(mock_requests)
        assert all(isinstance(r, RequestSchema) for r in retrieved_requests)
        assert retrieved_requests[0].id == mock_requests[0].id
        assert retrieved_requests[1].id == mock_requests[1].id


@pytest.mark.asyncio
async def test_create_request_creation_fails(
    request_service: RequestService,
    mock_db_session: AsyncMock
):
    """测试创建请求时 CRUD 操作失败"""
    request_in = RequestCreate(prompt="Test prompt")
    owner_id = uuid4()
    db_error = Exception("Database connection failed")

    # Mock CRUD 操作引发异常
    crud_request_mock = AsyncMock()
    crud_request_mock.create_with_owner = AsyncMock(side_effect=db_error)

    with patch('app.services.request_service.crud_request', crud_request_mock):
        # 调用服务方法并断言异常
        with pytest.raises(RequestCreationError) as excinfo:
            await request_service.create_request(
                request_in=request_in,
                owner_id=owner_id
            )

        # 检查异常信息或原因（可选）
        assert "Failed to create request in DB" in str(excinfo.value)
        assert excinfo.value.__cause__ is db_error

        # 确认队列和广播未被调用
        analysis_queue_mock.put.assert_not_awaited()
        ws_manager_mock.broadcast_request_created.assert_not_awaited()


@pytest.mark.asyncio
async def test_regenerate_request_get_fails(
    request_service: RequestService,
    mock_db_session: AsyncMock
):
    """测试重新生成请求时获取原始请求失败 (get_or_404 引发异常)"""
    original_request_id = uuid4()
    owner_id = uuid4()
    not_found_error = RequestNotFoundError(f"Request not found: {original_request_id}") # 假设 crud 抛出这个

    # Mock CRUD 操作 (get_or_404 引发异常)
    crud_request_mock = AsyncMock()
    crud_request_mock.get_or_404 = AsyncMock(side_effect=not_found_error)
    crud_request_mock.create_with_owner = AsyncMock() # 这个不应该被调用

    with patch('app.services.request_service.crud_request', crud_request_mock):
        # 调用服务方法并断言异常 (RequestService 应该重新抛出或包装它)
        # 注意：这里假设 RequestService 不捕获 RequestNotFoundError，而是让它冒泡
        # 如果 RequestService 捕获并包装成 RequestRegenerationError，则需要修改断言
        with pytest.raises(RequestNotFoundError) as excinfo:
             await request_service.regenerate_request(
                original_request_id=original_request_id,
                owner_id=owner_id
            )

        assert excinfo.value is not_found_error

        # 确认 get_or_404 被调用
        crud_request_mock.get_or_404.assert_awaited_once_with(
            db=mock_db_session, id=original_request_id, owner_id=owner_id
        )
        # 确认 create_with_owner, 队列和广播未被调用
        crud_request_mock.create_with_owner.assert_not_awaited()
        analysis_queue_mock.put.assert_not_awaited()
        ws_manager_mock.broadcast_request_created.assert_not_awaited()


@pytest.mark.asyncio
async def test_regenerate_request_creation_fails(
    request_service: RequestService,
    mock_db_session: AsyncMock
):
    """测试重新生成请求时 CRUD 创建操作失败"""
    original_request_id = uuid4()
    owner_id = uuid4()
    mock_original_request = RequestModel(
        id=original_request_id,
        prompt="Original",
        owner_id=owner_id
    )
    db_error = Exception("Database insert failed")

    # Mock CRUD 操作
    crud_request_mock = AsyncMock()
    crud_request_mock.get_or_404 = AsyncMock(return_value=mock_original_request)
    # 让 create_with_owner 引发异常
    crud_request_mock.create_with_owner = AsyncMock(side_effect=db_error)

    with patch('app.services.request_service.crud_request', crud_request_mock):
        # 调用服务方法并断言异常
        with pytest.raises(RequestRegenerationError) as excinfo:
            await request_service.regenerate_request(
                original_request_id=original_request_id,
                owner_id=owner_id
            )

        # 检查异常信息或原因（可选）
        assert "Failed to create regenerated request in DB" in str(excinfo.value)
        assert excinfo.value.__cause__ is db_error

        # 确认 get_or_404 被调用
        crud_request_mock.get_or_404.assert_awaited_once_with(
            db=mock_db_session, id=original_request_id, owner_id=owner_id
        )
        # 确认 create_with_owner 被尝试调用
        crud_request_mock.create_with_owner.assert_awaited_once()
        # 确认队列和广播未被调用
        analysis_queue_mock.put.assert_not_awaited()
        ws_manager_mock.broadcast_request_created.assert_not_awaited()