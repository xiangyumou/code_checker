import pytest
from httpx import AsyncClient
from fastapi import status
from typing import Dict
import os

# Import the helper fixture from test_login
from .test_login import admin_token_headers, test_admin_user # Import test_admin_user fixture

# Import LOGS_DIR from config
from app.core.config import LOGS_DIR

# Mark all tests in this module to use asyncio
pytestmark = pytest.mark.asyncio

# --- Helper to create a dummy log file ---
@pytest.fixture(scope="function") # Remove autouse=True, let tests request it explicitly if needed
def manage_dummy_log_file():
    """Ensures a dummy log file exists with known content before a test, and cleans up."""
    log_file_path = os.path.join(LOGS_DIR, "app.log")
    # Ensure logs directory exists
    os.makedirs(LOGS_DIR, exist_ok=True)
    # Write known content before the test
    dummy_content = "INFO: Log line 1\nDEBUG: Log line 2\nERROR: Log line 3\n"
    try:
        with open(log_file_path, "w", encoding="utf-8") as f:
            f.write(dummy_content)
        yield log_file_path, dummy_content # Yield path and content for verification
    finally:
        # Teardown: Attempt to remove the file, ignore error if it fails (e.g., still locked)
        # Tests should not rely on the file being deleted immediately.
        try:
            if os.path.exists(log_file_path):
                os.remove(log_file_path)
        except OSError:
            # Log this potential issue if necessary, but don't fail the test run
            print(f"Warning: Could not remove log file {log_file_path} during teardown.")
            pass

# --- Tests for GET /admin/logs/ ---

async def test_read_logs_success(
    test_client: AsyncClient, admin_token_headers: Dict[str, str], manage_dummy_log_file # Use new fixture name
):
    """Test successfully reading logs as admin."""
    log_file_path, dummy_content = manage_dummy_log_file
    # Call the endpoint to get the specific log file content
    response = await test_client.get("/admin/logs/app.log", headers=admin_token_headers)
    assert response.status_code == status.HTTP_200_OK
    # Check if the response content contains the dummy log lines
    # Response is StreamingResponse, read the content
    content = await response.aread()
    assert dummy_content in content.decode("utf-8")
    # Check content type
    assert response.headers["content-type"] == "text/plain; charset=utf-8"

async def test_read_logs_tail(
    test_client: AsyncClient, admin_token_headers: Dict[str, str], manage_dummy_log_file # Use new fixture name
):
    """Test reading the tail end of the logs."""
    log_file_path, dummy_content = manage_dummy_log_file
    # Add more lines to test tailing
    more_content = "".join([f"Line {i}\n" for i in range(4, 105)]) # Add 101 more lines
    with open(log_file_path, "a", encoding="utf-8") as f:
        f.write(more_content)

    # Call the endpoint for the specific file with tail parameter
    response = await test_client.get("/admin/logs/app.log?tail=50", headers=admin_token_headers) # Request last 50 lines
    assert response.status_code == status.HTTP_200_OK
    content = await response.aread()
    decoded_content = content.decode("utf-8")
    lines = decoded_content.strip().split('\n')
    assert len(lines) == 50
    assert "Line 104" in lines[-1] # Check if the last line is correct
    assert "Line 55" in lines[0] # Check if the first line of the tail is correct
    assert "Log line 1" not in decoded_content # Ensure older lines are not present

async def test_read_logs_unauthenticated(test_client: AsyncClient, manage_dummy_log_file): # Use new fixture name
    """Test reading logs without authentication."""
    # Fixture ensures the file exists for the endpoint to potentially find
    # Test accessing the specific log file endpoint without auth
    response = await test_client.get("/admin/logs/app.log")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

async def test_read_logs_file_not_found(
    test_client: AsyncClient, admin_token_headers: Dict[str, str] # Don't request manage_dummy_log_file here
):
    """Test reading logs when the log file doesn't exist."""
    # Ensure the file does not exist before making the request
    log_file_path = os.path.join(LOGS_DIR, "app.log")
    if os.path.exists(log_file_path):
        # Attempt to remove, ignore error if it fails (might be locked)
        try:
            os.remove(log_file_path)
        except OSError:
            pytest.skip(f"Could not remove log file {log_file_path}, skipping test.")

    # Test accessing the specific log file endpoint when file doesn't exist
    response = await test_client.get("/admin/logs/app.log", headers=admin_token_headers)
    # If the file genuinely doesn't exist, we expect 404
    assert response.status_code == status.HTTP_404_NOT_FOUND
    data = response.json()
    assert "detail" in data
    assert "log file not found" in data["detail"].lower()