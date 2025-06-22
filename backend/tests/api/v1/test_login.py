import pytest
import pytest_asyncio # Import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import status
from typing import Dict, Any # Import Dict and Any

from app import crud, schemas, models # Import models
from app.core.security import get_password_hash # To create user

# Mark all tests in this module to use asyncio
pytestmark = pytest.mark.asyncio

# --- Test Data ---
TEST_USERNAME = "testadmin"
TEST_PASSWORD = "testpassword"

# --- Fixture to create a test admin user ---
@pytest_asyncio.fixture(scope="function") # Function scope to ensure clean state
async def test_admin_user(db_session: AsyncSession) -> models.AdminUser:
    """Fixture to create a test admin user in the database."""
    user_in = schemas.AdminUserCreate(username=TEST_USERNAME, password=TEST_PASSWORD)
    # Directly use crud layer to create user with hashed password
    user = await crud.crud_admin_user.create(db_session, obj_in=user_in)
    await db_session.commit()
    await db_session.refresh(user)
    return user

# --- Tests for POST /login/access-token ---

async def test_login_success(
    test_client: AsyncClient, test_admin_user: models.AdminUser
):
    """Test successful login with correct credentials."""
    login_data = {"username": TEST_USERNAME, "password": TEST_PASSWORD}
    response = await test_client.post("/login/access-token", data=login_data) # Use data for form submission
    assert response.status_code == status.HTTP_200_OK
    token_data = response.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"

async def test_login_incorrect_password(
    test_client: AsyncClient, test_admin_user: models.AdminUser
):
    """Test login with incorrect password."""
    login_data = {"username": TEST_USERNAME, "password": "wrongpassword"}
    response = await test_client.post("/login/access-token", data=login_data)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    data = response.json()
    assert "detail" in data
    assert "incorrect username or password" in data["detail"].lower()

async def test_login_nonexistent_user(test_client: AsyncClient):
    """Test login with a username that does not exist."""
    login_data = {"username": "nonexistentuser", "password": "somepassword"}
    response = await test_client.post("/login/access-token", data=login_data)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    data = response.json()
    assert "detail" in data
    assert "incorrect username or password" in data["detail"].lower()

async def test_login_inactive_user(
    test_client: AsyncClient, db_session: AsyncSession
):
    """Test login with an inactive user."""
    # Create an inactive user
    user_in = schemas.AdminUserCreate(username="inactiveuser", password=TEST_PASSWORD, is_active=False)
    await crud.crud_admin_user.create(db_session, obj_in=user_in)
    await db_session.commit()

    login_data = {"username": "inactiveuser", "password": TEST_PASSWORD}
    response = await test_client.post("/login/access-token", data=login_data)
    assert response.status_code == status.HTTP_400_BAD_REQUEST # Should be 400 for inactive user
    data = response.json()
    assert "detail" in data
    assert "inactive user" in data["detail"].lower()

# --- Helper fixture to get a valid token ---
@pytest_asyncio.fixture(scope="function")
async def admin_token_headers(
    test_client: AsyncClient, test_admin_user: models.AdminUser
) -> Dict[str, str]:
    """Fixture to get authentication headers for a test admin user."""
    login_data = {"username": TEST_USERNAME, "password": TEST_PASSWORD}
    response = await test_client.post("/login/access-token", data=login_data)
    response.raise_for_status() # Ensure login was successful
    token_data = response.json()
    access_token = token_data["access_token"]
    return {"Authorization": f"Bearer {access_token}"}