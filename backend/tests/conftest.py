import pytest
import pytest_asyncio
from typing import AsyncGenerator, Generator
import os
import asyncio # Import asyncio

import httpx
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient # Although we use httpx, TestClient might be useful for some cases

# Import your FastAPI app and Base for metadata
# Ensure the path allows importing 'app' from the 'tests' directory
import sys
# Add the project root ('backend') to the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.main import app # Import your FastAPI application instance
from app.db.base_class import Base # Import your Base for creating/dropping tables
from app.api import deps # To override dependencies like get_db

# --- Test Database Setup ---
# Use a separate database file for testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///./data/test_app.db"
# Ensure the data directory exists for the test database
data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
os.makedirs(data_dir, exist_ok=True)

# Create an async engine for the test database
test_engine = create_async_engine(TEST_DATABASE_URL, echo=False) # Set echo=True for debugging SQL

# Create an async sessionmaker for the test database
TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Use function scope to ensure clean DB for each test
@pytest_asyncio.fixture(scope="function", autouse=True)
async def setup_test_database() -> AsyncGenerator[None, None]:
    """
    Fixture to create and drop the test database tables before and after each test function.
    Ensures test isolation.
    """
    # Run database operations within the session-scoped event loop if needed,
    # although create_all/drop_all with run_sync might not strictly require it here.
    async with test_engine.begin() as conn:
        # Drop all tables first (optional, ensures clean state)
        # await conn.run_sync(Base.metadata.drop_all)
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
    yield # Test session runs here
    # Teardown: Drop all tables after the test session
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()
    # Optionally remove the test database file
    test_db_path = os.path.join(data_dir, 'test_app.db')
    if os.path.exists(test_db_path):
        os.remove(test_db_path)


@pytest_asyncio.fixture(scope="function") # Use function scope for isolated sessions per test
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Provides a clean database session for each test function.
    """
    async with TestingSessionLocal() as session:
        try:
            yield session
        finally:
            # Expire all objects to clear the session cache
            session.expire_all()
            # Rollback changes after each test function to ensure isolation
            await session.rollback()


# --- Override get_db Dependency ---
async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency override to provide the test database session.
    """
    async with TestingSessionLocal() as session:
        yield session

# Apply the override to the FastAPI app instance for testing
app.dependency_overrides[deps.get_db] = override_get_db


# --- HTTPX Test Client Fixture ---
@pytest_asyncio.fixture(scope="function") # Function scope for client per test
async def test_client() -> AsyncGenerator[httpx.AsyncClient, None]:
    """
    Provides an asynchronous HTTP client for making requests to the test app.
    """
    # Use httpx.AsyncClient with an ASGITransport pointing to the app
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver/api/v1") as client:
        yield client

# --- Optional: TestClient Fixture (Sync, less preferred for async app) ---
# @pytest.fixture(scope="module")
# def sync_test_client() -> Generator[TestClient, None, None]:
#     """Provides a synchronous TestClient."""
#     with TestClient(app) as client:
#         yield client