import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator, PostgresDsn # Import field_validator and potentially PostgresDsn
from functools import lru_cache
from typing import Optional, Dict, Any # Import necessary types

# Define the base directory for the project relative to this file
# Assuming config.py is in backend/app/core/
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# Use /app in Docker, fall back to relative paths for development
APP_DIR = os.environ.get("APP_DIR", BASE_DIR)
DATA_DIR = os.path.join(APP_DIR, "data")
LOGS_DIR = os.path.join(APP_DIR, "logs")

# Ensure data and logs directories exist (useful if not running in Docker initially)
# os.makedirs(DATA_DIR, exist_ok=True)
# os.makedirs(LOGS_DIR, exist_ok=True)

class Settings(BaseSettings):
    PROJECT_NAME: str = "Code Checker API"
    API_V1_STR: str = "/api/v1"
    BASE_DIR: str = APP_DIR # Add this line
    IMAGE_UPLOAD_DIR: str = os.path.join(DATA_DIR, "uploads/images") # Add this line

    # --- PostgreSQL Database Settings ---
    # Loaded from environment variables (injected by Docker Compose)
    POSTGRES_SERVER: str = "db" # Default to service name if not set
    POSTGRES_USER: str = "user" # Default user if not set
    POSTGRES_PASSWORD: str = "password" # Default password if not set
    POSTGRES_DB: str = "app" # Default db name if not set

    # Asynchronous database connection URI
    SQLALCHEMY_DATABASE_URI: Optional[str] = None # Make it optional, validator will build it

    @field_validator("SQLALCHEMY_DATABASE_URI", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: Optional[str], info) -> str:
        if isinstance(v, str): # If already set (e.g., explicitly in env), use it
            return v
        # Build the URI from individual components loaded from env vars
        values = info.data if info else {}
        user = values.get("POSTGRES_USER")
        password = values.get("POSTGRES_PASSWORD")
        server = values.get("POSTGRES_SERVER")
        db = values.get("POSTGRES_DB")
        if all([user, password, server, db]): # Ensure all components are present
             # Using PostgresDsn for validation (optional but good practice)
             # return PostgresDsn.build(
             #     scheme="postgresql+asyncpg",
             #     username=user,
             #     password=password,
             #     host=server,
             #     path=f"/{db}",
             # )
             # Or build the string directly
             return f"postgresql+asyncpg://{user}:{password}@{server}/{db}"
        raise ValueError("Missing PostgreSQL connection details in environment variables")

    # --- OpenAI settings (Loaded dynamically) ---
    # OPENAI_API_KEY: str | None = None # Loaded dynamically
    # OPENAI_BASE_URL: str | None = None # Loaded dynamically
    # OPENAI_MODEL: str | None = None # Loaded dynamically

    # --- Concurrency Settings ---
    # Max concurrent analysis tasks (system-wide semaphore limit).
    # Read from env var at startup. Changing the DB setting requires restart.
    MAX_CONCURRENT_ANALYSIS_TASKS: int = 5 # Default value if env var not set

    # Other settings like parallel requests per prompt, total attempts, timeout, etc.,
    # are loaded dynamically from the DB via crud_setting within the task execution.

    # Logging settings - This will be loaded dynamically from the DB
    # LOG_LEVEL: str | None = None # Loaded dynamically

    # Security settings
    # Generate a secret key using: openssl rand -hex 32 or set in environment
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8 # 8 days for admin token

    @field_validator("SECRET_KEY", mode="after")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if not v or len(v) < 32:
            raise ValueError(
                "SECRET_KEY must be set as environment variable with at least 32 characters. "
                "Generate one using: openssl rand -hex 32"
            )
        return v

    # Initialization status - This will be checked dynamically via crud_setting
    # IS_INITIALIZED: bool = False # Checked dynamically

    # Use model_config for Pydantic V2 compatibility
    model_config = SettingsConfigDict(
        # If using a .env file, uncomment below
        # env_file = ".env",
        case_sensitive=True,
        extra='ignore' # Ignore extra fields from env vars if needed
    )

# Use lru_cache to load settings only once
@lru_cache()
def get_settings() -> Settings:
    # Ensure data and logs directories exist when settings are first accessed
    # This is slightly better placed than top-level for module import reasons
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(LOGS_DIR, exist_ok=True)
    return Settings()

settings = get_settings()