import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import patch, AsyncMock # Import patch and AsyncMock
from fastapi import status, BackgroundTasks

from app import crud, schemas
from app.models.request import RequestStatus # Import enum
from app.services import openai_processor # Import the module to patch

# Mark all tests in this module to use asyncio
pytestmark = pytest.mark.asyncio

# --- Test Data ---
VALID_REQUEST_DATA = {
    "user_prompt": "Test problem description\nint main() { return 0; }", # Combine prompt and code for testing
    # "original_code": "int main() { return 0; }", # Removed
    "image_base64": None,
}

# Sample invalid data (empty code test removed as validation is removed)
# INVALID_REQUEST_DATA_NO_CODE = {
#     "user_prompt": "Test problem description",
#     "original_code": "", # Empty code
#     "image_base64": None,
# }

# --- Tests for POST /requests/ ---

@patch("app.api.api_v1.endpoints.requests.BackgroundTasks.add_task") # Patch add_task in the endpoint module
async def test_create_request_success(
    mock_add_task: AsyncMock, # Mock object is passed as first argument
    test_client: AsyncClient,
    db_session: AsyncSession
):
    """Test successful creation of a new analysis request."""
    response = await test_client.post("/requests/", json=VALID_REQUEST_DATA)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["user_prompt"] == VALID_REQUEST_DATA["user_prompt"]
    # assert data["original_code"] == VALID_REQUEST_DATA["original_code"] # Removed assertion
    assert data["status"] == RequestStatus.QUEUED # Check initial status
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data
    assert "versions" in data and isinstance(data["versions"], list) and len(data["versions"]) == 0
    assert data["current_version"] is None

    # Verify it was actually created in the DB
    db_request = await crud.crud_request.get(db_session, id=data["id"])
    assert db_request is not None
    assert db_request.id == data["id"]
    assert db_request.status == RequestStatus.QUEUED

    # Assert that the background task was added correctly
    mock_add_task.assert_called_once_with(
        openai_processor.process_analysis_request, # Check the correct function is called
        request_id=data["id"] # Check the correct request_id is passed
    )

# Test creating a request with missing (empty) code - Test Removed
# async def test_create_request_missing_code(test_client: AsyncClient):
#     """Test creating a request with missing (empty) code."""
#     response = await test_client.post("/requests/", json=INVALID_REQUEST_DATA_NO_CODE)
#     assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
#     data = response.json()
#     assert "detail" in data
#     # Check that the validation error detail mentions 'original_code' and length constraint
#     assert any("original_code" in err.get("loc", []) and "at least 1 character" in err.get("msg", "") for err in data["detail"])


# --- Tests for GET /requests/ ---

async def test_read_requests_empty(test_client: AsyncClient):
    """Test reading requests when none exist."""
    response = await test_client.get("/requests/")
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == []

async def test_read_requests_with_data(
    test_client: AsyncClient, db_session: AsyncSession
):
    """Test reading requests after creating one."""
    # Create a request first
    await crud.crud_request.create(db_session, obj_in=schemas.RequestCreate(**VALID_REQUEST_DATA))
    await db_session.commit()

    response = await test_client.get("/requests/")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    # assert data[0]["original_code"] == VALID_REQUEST_DATA["original_code"] # Removed assertion
    assert data[0]["status"] == RequestStatus.QUEUED

# --- Tests for GET /requests/{request_id} ---

async def test_read_request_success(
    test_client: AsyncClient, db_session: AsyncSession
):
    """Test reading a specific request by ID."""
    # Create a request first
    created_request = await crud.crud_request.create(db_session, obj_in=schemas.RequestCreate(**VALID_REQUEST_DATA))
    await db_session.commit()

    response = await test_client.get(f"/requests/{created_request.id}")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == created_request.id
    # assert data["original_code"] == VALID_REQUEST_DATA["original_code"] # Removed assertion

async def test_read_request_not_found(test_client: AsyncClient):
    """Test reading a request that does not exist."""
    non_existent_id = 99999
    response = await test_client.get(f"/requests/{non_existent_id}")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()


# --- Tests for POST /requests/{request_id}/regenerate ---

@patch("app.api.api_v1.endpoints.requests.BackgroundTasks.add_task") # Patch add_task
async def test_regenerate_request_success(
    mock_add_task: AsyncMock, # Mock object
    test_client: AsyncClient,
    db_session: AsyncSession
):
    """Test successfully triggering regeneration for a request."""
    # Create a request and set it to Completed (or Failed)
    request_in = schemas.RequestCreate(**VALID_REQUEST_DATA)
    created_request = await crud.crud_request.create(db_session, obj_in=request_in)
    await crud.crud_request.update_status(db_session, db_obj=created_request, status=RequestStatus.COMPLETED)
    await db_session.commit()
    await db_session.refresh(created_request) # Refresh to get updated status

    assert created_request.status == RequestStatus.COMPLETED

    response = await test_client.post(f"/requests/{created_request.id}/regenerate")
    assert response.status_code == status.HTTP_200_OK # Endpoint returns 200 OK
    data = response.json()
    assert data["id"] == created_request.id
    assert data["status"] == RequestStatus.QUEUED # Status should be back to Queued

    # Commit the session to ensure the status update from the endpoint is persisted
    # before we query it again. Note: This might not be strictly necessary if the
    # test client runs within the same transaction context, but explicit commit is safer.
    # await db_session.commit() # Let's try without commit first, rely on session state

    # Verify status in DB (should be QUEUED after endpoint call)
    # Refresh the object within the session to get the latest state potentially updated by the endpoint
    await db_session.refresh(created_request)
    assert created_request.status == RequestStatus.QUEUED

    # Assert that the background task was added correctly
    mock_add_task.assert_called_once_with(
        openai_processor.process_analysis_request,
        request_id=created_request.id
    )

async def test_regenerate_request_not_found(test_client: AsyncClient):
    """Test regenerating a request that does not exist."""
    non_existent_id = 99998
    response = await test_client.post(f"/requests/{non_existent_id}/regenerate")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()

# Add more tests as needed, e.g., testing status filters, pagination limits, etc.