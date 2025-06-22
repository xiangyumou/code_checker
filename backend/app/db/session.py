from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from typing import AsyncGenerator

from app.core.config import settings

# Create the SQLAlchemy async engine
# connect_args is specific to SQLite to enable foreign key constraints
engine = create_async_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    pool_pre_ping=True, # Checks connections for liveness before handing them out
    # echo=True # Uncomment for debugging SQL queries
    connect_args={"check_same_thread": False} if "sqlite" in settings.SQLALCHEMY_DATABASE_URI else {}
)

# Create a configured "Session" class
# Use expire_on_commit=False for async sessions as recommended
AsyncSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency function that yields an async SQLAlchemy session.
    Ensures the session is closed after the request is finished.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            # Optional: commit here if you want auto-commit behavior per request
            # await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            # The session is automatically closed by the context manager 'async with'
            pass

# Function to create database tables
async def init_db():
    """
    Initializes the database by creating tables based on the defined models.
    This should be called during application startup.
    """
    # Import Base and all models here to ensure they are registered with SQLAlchemy's metadata
    from app.db.base_class import Base
    # Importing __init__ registers all models defined in __all__
    import app.models # noqa

    async with engine.begin() as conn:
        # Use run_sync for metadata operations with async engine
        # await conn.run_sync(Base.metadata.drop_all) # Use with extreme caution! Only for dev.
        await conn.run_sync(Base.metadata.create_all)
        print("Database tables checked/created.") # Simple confirmation log