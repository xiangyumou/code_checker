import pytest
import os
import sys
from typing import AsyncGenerator

import pytest
import pytest_asyncio

# Ensure the project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    import aiosqlite  # type: ignore  # noqa: F401
    HAS_AIOSQLITE = True
except ModuleNotFoundError:
    HAS_AIOSQLITE = False

if HAS_AIOSQLITE:
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
    from sqlalchemy.orm import sessionmaker
    import httpx
    from fastapi.testclient import TestClient  # noqa: F401
    from app.main import app
    from app.db.base_class import Base
    from app.api import deps

if HAS_AIOSQLITE:
    TEST_DATABASE_URL = "sqlite+aiosqlite:///./data/test_app.db"
    data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
    os.makedirs(data_dir, exist_ok=True)

    test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    @pytest_asyncio.fixture(scope="function", autouse=True)
    async def setup_test_database() -> AsyncGenerator[None, None]:
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        yield
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await test_engine.dispose()
        test_db_path = os.path.join(data_dir, 'test_app.db')
        if os.path.exists(test_db_path):
            os.remove(test_db_path)

    @pytest_asyncio.fixture(scope="function")
    async def db_session() -> AsyncGenerator[AsyncSession, None]:
        async with TestingSessionLocal() as session:
            try:
                yield session
            finally:
                session.expire_all()
                await session.rollback()

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with TestingSessionLocal() as session:
            yield session

    app.dependency_overrides[deps.get_db] = override_get_db

    @pytest_asyncio.fixture(scope="function")
    async def test_client() -> AsyncGenerator[httpx.AsyncClient, None]:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver/api/v1") as client:
            yield client
else:
    @pytest_asyncio.fixture(scope="function", autouse=True)
    async def setup_test_database() -> AsyncGenerator[None, None]:
        yield

    @pytest_asyncio.fixture(scope="function")
    async def db_session():
        pytest.skip("Async database driver not available")

    @pytest_asyncio.fixture(scope="function")
    async def test_client():
        pytest.skip("Async database driver not available")

# --- Optional: TestClient Fixture (Sync, less preferred for async app) ---
# @pytest.fixture(scope="module")
# def sync_test_client() -> Generator[TestClient, None, None]:
#     """Provides a synchronous TestClient."""
#     with TestClient(app) as client:
#         yield client