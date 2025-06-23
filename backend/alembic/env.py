import asyncio # Import asyncio for async run
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine # Import AsyncEngine and create_async_engine
from sqlalchemy import create_engine # Keep sync engine for offline mode if needed

from alembic import context

# Import Base and models
import sys
import os

# Add the project root ('backend' directory) to the Python path first
# Assuming env.py is in backend/alembic, '..' goes to backend
backend_dir = os.path.realpath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, backend_dir)
from app.db.base_class import Base # Import your Base
# Import all models here so Base knows about them
from app.models.admin_user import AdminUser
from app.models.request import Request
# from app.models.analysis_version import AnalysisVersion # Removed import
from app.models.setting import Setting
from app.models.log import Log

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Ensure the data directory exists before proceeding
# Use the backend_dir calculated earlier
data_dir = os.path.join(backend_dir, 'data')
os.makedirs(data_dir, exist_ok=True)

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# target_metadata = mymodel.Base.metadata
target_metadata = Base.metadata # Use imported Base

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


# Helper function to get DB URL from environment variables for sync operations
def get_sync_db_url() -> str | None:
    user = os.getenv("POSTGRES_USER", "user")
    password = os.getenv("POSTGRES_PASSWORD", "password")
    server = os.getenv("POSTGRES_SERVER", "db")
    db = os.getenv("POSTGRES_DB", "app")
    # Use psycopg2 driver for Alembic sync operations
    return f"postgresql+psycopg2://{user}:{password}@{server}/{db}"

# Helper function to get DB URL from environment variables for async operations (used by online mode AsyncEngine)
def get_async_db_url() -> str | None:
    user = os.getenv("POSTGRES_USER", "user")
    password = os.getenv("POSTGRES_PASSWORD", "password")
    server = os.getenv("POSTGRES_SERVER", "db")
    db = os.getenv("POSTGRES_DB", "app")
    # Use asyncpg driver for SQLAlchemy async operations
    return f"postgresql+asyncpg://{user}:{password}@{server}/{db}"

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    # url = config.get_main_option("sqlalchemy.url") # Removed: Get URL dynamically
    url = get_sync_db_url()
    if not url:
        raise ValueError("Database URL could not be constructed from environment variables for offline mode.")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


# --- Async Setup ---
# db_url = config.get_main_option("sqlalchemy.url") # Removed: Get URL dynamically

def do_run_migrations(connection):
    """Helper function to run migrations within a transaction."""
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    # Get the asynchronous database URL from environment variables
    async_db_url = get_async_db_url()
    if not async_db_url:
        raise ValueError("Database URL could not be constructed from environment variables for online mode.")

    # Create an AsyncEngine directly using the async URL.
    # This is the standard approach for Alembic async support.
    connectable = create_async_engine(
        async_db_url,
        poolclass=pool.NullPool
    )


    async with connectable.connect() as connection:
        # Run migrations within the async connection context
        await connection.run_sync(do_run_migrations)

    # Dispose the engine after use
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    # Use asyncio.run() to execute the async function
    asyncio.run(run_migrations_online())
