import asyncio
from datetime import datetime
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import status, BackgroundTasks # Import BackgroundTasks
from typing import Dict, List # Import List
from unittest.mock import patch, AsyncMock # Import patch and AsyncMock

from app import crud, schemas, models
from app.models.request import RequestStatus
from app.api.api_v1.endpoints import admin_requests
from app.main import app as fastapi_app

# Import the helper fixture from test_login
from .test_login import admin_token_headers, TEST_USERNAME, TEST_PASSWORD, test_admin_user

# Import test data from test_requests
from .test_requests import VALID_REQUEST_DATA

# Mark all tests in this module to use asyncio
pytestmark = pytest.mark.asyncio

# --- Helper to create multiple requests ---
async def create_test_requests(db_session: AsyncSession, count: int = 3) -> List[models.Request]:
    """Helper function to create multiple test requests."""
    requests = []
    for i in range(count):
        # Create slightly different data for each request if needed
        data = VALID_REQUEST_DATA.copy()
        data["user_prompt"] = f"Test Prompt {i+1}\nCode {i+1}" # Combine prompt and code
        # data["original_code"] = f"Code {i+1}" # Removed
        request_in = schemas.RequestCreate(**data)
        req = await crud.crud_request.create(db_session, obj_in=request_in)
        requests.append(req)
    await db_session.commit()
    for req in requests: # Refresh after commit
        await db_session.refresh(req)
    return requests

# --- Tests for GET /admin/requests/ ---

async def test_read_admin_requests_success(
    test_client: AsyncClient, db_session: AsyncSession, admin_token_headers: Dict[str, str]
):
    """Test successfully reading requests as admin."""
    await create_test_requests(db_session, 2)
    response = await test_client.get("/admin/requests/", headers=admin_token_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 2
    assert "versions" in data[0] # Admin view should include versions

async def test_read_admin_requests_unauthenticated(test_client: AsyncClient):
    """Test reading admin requests without authentication."""
    response = await test_client.get("/admin/requests/")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

# --- Tests for GET /admin/requests/{request_id} ---

async def test_read_admin_request_detail_success(
    test_client: AsyncClient, db_session: AsyncSession, admin_token_headers: Dict[str, str]
):
    """Test successfully reading a specific request detail as admin."""
    requests = await create_test_requests(db_session, 1)
    request_id = requests[0].id
    response = await test_client.get(f"/admin/requests/{request_id}", headers=admin_token_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == request_id
    assert "versions" in data # Should include versions
    # Add check for analysis version details if needed later

async def test_read_admin_request_detail_not_found(
    test_client: AsyncClient, admin_token_headers: Dict[str, str]
):
    """Test reading a non-existent request detail as admin."""
    response = await test_client.get("/admin/requests/99999", headers=admin_token_headers)
    assert response.status_code == status.HTTP_404_NOT_FOUND

async def test_read_admin_request_detail_unauthenticated(test_client: AsyncClient, db_session: AsyncSession):
    """Test reading request detail without authentication."""
    requests = await create_test_requests(db_session, 1)
    request_id = requests[0].id
    response = await test_client.get(f"/admin/requests/{request_id}")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

# --- Tests for POST /admin/requests/batch-delete ---

async def test_batch_delete_requests_success(
    test_client: AsyncClient, db_session: AsyncSession, admin_token_headers: Dict[str, str]
):
    """Test successfully deleting requests in batch."""
    requests = await create_test_requests(db_session, 3)
    request_ids_to_delete = [req.id for req in requests[:2]] # Delete first two

    # Call the correct batch endpoint with action in payload
    batch_payload = {"action": "delete", "request_ids": request_ids_to_delete}
    response = await test_client.post("/admin/requests/batch", json=batch_payload, headers=admin_token_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    # Check the response structure from the batch endpoint
    assert data["message"] == "Batch delete attempted. 2 requests deleted."
    assert data["results"]["success"] == request_ids_to_delete
    assert data["results"]["failed"] == []

    # Verify deletion in DB
    remaining_request = await crud.crud_request.get(db_session, id=requests[2].id)
    assert remaining_request is not None
    deleted_request1 = await crud.crud_request.get(db_session, id=request_ids_to_delete[0])
    assert deleted_request1 is None
    deleted_request2 = await crud.crud_request.get(db_session, id=request_ids_to_delete[1])
    assert deleted_request2 is None

async def test_batch_delete_requests_unauthenticated(test_client: AsyncClient, db_session: AsyncSession):
    """Test batch delete without authentication."""
    requests = await create_test_requests(db_session, 1)
    batch_payload = {"action": "delete", "request_ids": [requests[0].id]}
    response = await test_client.post("/admin/requests/batch", json=batch_payload) # Correct URL
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

# --- Tests for POST /admin/requests/batch-regenerate ---
# Note: We patch BackgroundTasks here as well

@pytest.mark.skip(reason="Need to implement mocking for batch regenerate background tasks") # Skip until mocking is refined
@patch("app.api.api_v1.endpoints.admin_requests.BackgroundTasks.add_task")
async def test_batch_regenerate_requests_success(
    mock_add_task: AsyncMock,
    test_client: AsyncClient,
    db_session: AsyncSession,
    admin_token_headers: Dict[str, str]
):
    """Test successfully regenerating requests in batch."""
    requests = await create_test_requests(db_session, 3)
    # Set some to completed/failed status
    await crud.crud_request.update_status(db_session, db_obj=requests[0], status=RequestStatus.COMPLETED)
    await crud.crud_request.update_status(db_session, db_obj=requests[1], status=RequestStatus.FAILED)
    await db_session.commit()
    await db_session.refresh(requests[0])
    await db_session.refresh(requests[1])

    request_ids_to_regen = [requests[0].id, requests[1].id]

    # Call the correct batch endpoint with action in payload
    batch_payload = {"action": "retry", "request_ids": request_ids_to_regen}
    response = await test_client.post("/admin/requests/batch", json=batch_payload, headers=admin_token_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    # Check the response structure from the batch endpoint
    assert data["message"] == "Batch retry attempted. 2 requests queued for retry."
    assert data["results"]["success"] == request_ids_to_regen
    assert data["results"]["failed"] == []

    # Verify status in DB (should be QUEUED)
    req1 = await crud.crud_request.get(db_session, id=requests[0].id)
    req2 = await crud.crud_request.get(db_session, id=requests[1].id)
    req3 = await crud.crud_request.get(db_session, id=requests[2].id) # Should be unchanged
    assert req1.status == RequestStatus.QUEUED
    assert req2.status == RequestStatus.QUEUED
    assert req3.status == RequestStatus.QUEUED # Assuming initial was QUEUED

    # Verify background tasks were called
    assert mock_add_task.call_count == 2
    # TODO: Add more specific checks for mock_add_task calls if needed

async def test_batch_regenerate_requests_unauthenticated(test_client: AsyncClient, db_session: AsyncSession):
    """Test batch regenerate without authentication."""
    requests = await create_test_requests(db_session, 1)
    batch_payload = {"action": "retry", "request_ids": [requests[0].id]}
    response = await test_client.post("/admin/requests/batch", json=batch_payload) # Correct URL
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


async def test_retry_request_analysis_broadcast_payload(
    test_client: AsyncClient,
    db_session: AsyncSession,
    admin_token_headers: Dict[str, str],
    monkeypatch,
):
    """Ensure retry endpoint broadcasts expected payload structure."""
    await _ensure_queue()
    request_obj = (await create_test_requests(db_session, 1))[0]
    failed_request = await crud.crud_request.update_status(
        db_session,
        db_obj=request_obj,
        status=RequestStatus.FAILED,
        error_message="Boom",
    )
    await db_session.refresh(failed_request)

    broadcast_mock = AsyncMock()
    monkeypatch.setattr(admin_requests.manager, "broadcast_request_updated", broadcast_mock)

    response = await test_client.post(
        f"/admin/requests/{failed_request.id}/retry",
        headers=admin_token_headers,
    )

    assert response.status_code == status.HTTP_200_OK
    response_data = response.json()
    assert response_data["status"] == RequestStatus.QUEUED

    assert broadcast_mock.await_count == 1
    args, kwargs = broadcast_mock.await_args
    assert not kwargs, "Broadcast should be called with positional args"
    request_id, status_value, updated_at, error_message = args
    assert request_id == failed_request.id
    assert status_value == RequestStatus.QUEUED
    assert isinstance(updated_at, datetime)
    assert error_message is None


async def test_batch_retry_broadcast_payload(
    test_client: AsyncClient,
    db_session: AsyncSession,
    admin_token_headers: Dict[str, str],
    monkeypatch,
):
    """Ensure batch retry endpoint broadcasts expected payload structure per request."""
    await _ensure_queue()
    request_obj = (await create_test_requests(db_session, 1))[0]
    failed_request = await crud.crud_request.update_status(
        db_session,
        db_obj=request_obj,
        status=RequestStatus.FAILED,
        error_message="Needs retry",
    )
    await db_session.refresh(failed_request)

    broadcast_mock = AsyncMock()
    monkeypatch.setattr(admin_requests.manager, "broadcast_request_updated", broadcast_mock)

    batch_payload = {"action": "retry", "request_ids": [failed_request.id]}
    response = await test_client.post(
        "/admin/requests/batch",
        json=batch_payload,
        headers=admin_token_headers,
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["results"]["success"] == [failed_request.id]

    assert broadcast_mock.await_count == 1
    args, kwargs = broadcast_mock.await_args
    assert not kwargs
    request_id, status_value, updated_at, error_message = args
    assert request_id == failed_request.id
    assert status_value == RequestStatus.QUEUED
    assert isinstance(updated_at, datetime)
    assert error_message is None


async def _ensure_queue():
    """Ensure the FastAPI app has an analysis queue for tests that enqueue work."""
    if not hasattr(fastapi_app.state, "analysis_queue"):
        fastapi_app.state.analysis_queue = asyncio.Queue()
