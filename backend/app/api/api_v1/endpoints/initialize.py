from typing import Any, Dict, Optional, Text # Added Optional, Text

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError # Import SQLAlchemyError
import logging # Import logging
import re # For regex validation

from app import crud, models, schemas
from app.api import deps
from app.core.config import settings as core_settings # Rename to avoid conflict, use core settings for defaults if needed
from app.core.logging import get_db_logger
from pydantic import Field, field_validator, PositiveInt # Import field_validator, PositiveInt


# Schema combining initial settings and admin user
class InitializeData(schemas.AdminUserCreate): # Inherits username/password validation from AdminUserCreate if defined there
    # Add OpenAI settings fields with validation
    openai_api_key: str = Field(..., description="OpenAI API Key")
    openai_base_url: Optional[str] = Field(None, description="Optional OpenAI Base URL")
    openai_model: str = Field("gpt-4-turbo", description="OpenAI Model to use") # Hardcoded default

    # Add other settings fields with hardcoded defaults
    system_prompt: Text = Field("You are a helpful assistant.", description="Default System Prompt for OpenAI requests") # Hardcoded default
    max_concurrent_analysis_tasks: PositiveInt = Field(5, description="Maximum concurrent analysis tasks allowed") # Hardcoded default (matches config.py)
    parallel_openai_requests_per_prompt: PositiveInt = Field(5, description="Number of parallel OpenAI requests per user prompt") # Hardcoded default
    max_total_openai_attempts_per_prompt: PositiveInt = Field(20, description="Maximum total OpenAI attempts per user prompt") # Hardcoded default
    request_timeout_seconds: PositiveInt = Field(500, description="Timeout for processing a single request in seconds") # Hardcoded default


    # --- Field Validators ---

    # Password complexity validation (example)
    @field_validator('password')
    @classmethod # Keep classmethod
    def password_complexity(cls, v: str) -> str: # Add type hint
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        # Add more checks (uppercase, lowercase, number, symbol) if desired
        # if not re.search(r"[A-Z]", v): raise ValueError(...)
        # if not re.search(r"[a-z]", v): raise ValueError(...)
        # if not re.search(r"[0-9]", v): raise ValueError(...)
        return v

    # Validate OpenAI API Key format
    @field_validator('openai_api_key')
    @classmethod
    def validate_openai_key(cls, v: str) -> str:
        if not v.startswith("sk-"):
            raise ValueError("Invalid OpenAI API Key format. Must start with 'sk-'.")
        return v

    # Validate OpenAI Base URL format (if provided)
    @field_validator('openai_base_url')
    @classmethod
    def validate_openai_base_url(cls, v: Optional[str]) -> Optional[str]:
        if v and not re.match(r'^https?://', v):
             raise ValueError("Invalid OpenAI Base URL format. Must start with http:// or https://.")
        return v

    # Validate OpenAI Model is not empty
    @field_validator('openai_model')
    @classmethod
    def validate_openai_model(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("OpenAI Model cannot be empty.")
        return v

    # Validate System Prompt is not empty
    @field_validator('system_prompt')
    @classmethod
    def validate_system_prompt(cls, v: Text) -> Text:
        if not v or not str(v).strip(): # Check if empty or only whitespace
            raise ValueError("System Prompt cannot be empty.")
        return v

    # No specific validation needed for PositiveInt fields beyond Pydantic's check

router = APIRouter()
logger = logging.getLogger("app." + __name__) # Add logger instance
db_logger = get_db_logger("api.initialize")

# We need a way to store/check the initialization status persistently.
# A simple approach is a dedicated table or a specific row in a settings table.
# For now, we'll simulate this check. A proper DB check will replace this.
async def check_initialization_status(db: AsyncSession = Depends(deps.get_db)) -> bool:
    """
    Checks if the application has been initialized by checking if any admin user exists.
    Returns True if at least one admin user exists, False otherwise.
    """
    try:
        # Check if any admin user exists using get_multi
        logger.debug("Checking for existing admin users...")
        admin_users = await crud.crud_admin_user.get_multi(db, limit=1) # Fetch at most one user
        is_initialized = len(admin_users) > 0
        logger.debug(f"Admin user check complete. Found users: {len(admin_users)}. Initialized: {is_initialized}")
        return is_initialized # Check if the list is non-empty
    except SQLAlchemyError as e:
        logger.error(f"Database error during initialization check: {e}", exc_info=True)
        # Decide how to handle this. Returning False might allow initialization attempt.
        # Raising an HTTP exception might be safer but blocks initialization.
        # Let's raise for now to make the error visible.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database error during initialization check: {e}"
        )
    except Exception as e: # Catch other potential errors
        # Log the specific exception type and message for better debugging
        logger.error(f"Unexpected error during initialization check: {type(e).__name__} - {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            # Keep the detail generic for the client, but log specifics server-side
            detail="An unexpected error occurred during initialization check."
        )


@router.get("/status", response_model=Dict[str, bool])
async def get_initialization_status(
    initialized: bool = Depends(check_initialization_status)
) -> Any:
    """
    Check if the application has already been initialized.
    """
    return {"initialized": initialized}


@router.post("/", response_model=schemas.AdminUser, status_code=status.HTTP_201_CREATED)
async def initialize_application(
    *,
    request: Request,
    db: AsyncSession = Depends(deps.get_db),
    init_data: InitializeData,
    initialized: bool = Depends(check_initialization_status)
) -> Any:
    """
    Perform initial setup: create the first admin user and save initial settings.
    This endpoint should only be accessible if the application is not yet initialized.
    """
    if initialized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Application has already been initialized.",
        )

    # Check if username already exists (shouldn't happen if not initialized, but good practice)
    user = await crud.crud_admin_user.get_by_username(db, username=init_data.username)
    if user:
        # This case should ideally not be reachable if initialized check is robust
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists.",
        )

    # Create the first admin user
    admin_user_in = schemas.AdminUserCreate(
        username=init_data.username,
        password=init_data.password,
        is_active=True # First user is active by default
    )
    created_user = await crud.crud_admin_user.create(db, obj_in=admin_user_in)
    
    # Log admin user creation
    client_ip = request.client.host if request.client else "unknown"
    await db_logger.info(
        db,
        f"Initial admin user created: {created_user.username}",
        extra_data={
            "username": created_user.username,
            "user_id": created_user.id,
            "client_ip": client_ip
        }
    )

    # --- Save initial settings using crud_setting ---
    # Note: API Key is stored as provided. Consider encryption/obfuscation in a real-world scenario.
    await crud.crud_setting.create_or_update(db, key="openai_api_key", value=init_data.openai_api_key)
    if init_data.openai_base_url: # Only save if provided
        await crud.crud_setting.create_or_update(db, key="openai_base_url", value=init_data.openai_base_url)
    if init_data.openai_model: # Only save if provided (should have default in schema)
        await crud.crud_setting.create_or_update(db, key="openai_model", value=init_data.openai_model)

    # Save the new settings
    await crud.crud_setting.create_or_update(db, key="system_prompt", value=str(init_data.system_prompt)) # Ensure Text is saved as string
    await crud.crud_setting.create_or_update(db, key="max_concurrent_analysis_tasks", value=init_data.max_concurrent_analysis_tasks)
    await crud.crud_setting.create_or_update(db, key="parallel_openai_requests_per_prompt", value=init_data.parallel_openai_requests_per_prompt)
    await crud.crud_setting.create_or_update(db, key="max_total_openai_attempts_per_prompt", value=init_data.max_total_openai_attempts_per_prompt)
    await crud.crud_setting.create_or_update(db, key="request_timeout_seconds", value=init_data.request_timeout_seconds)


    # Mark initialization as complete (optional, as check now relies on user existence)
    # Setting this might still be useful for other checks or informational purposes.
    await crud.crud_setting.create_or_update(db, key="is_initialized", value=True)

    # --- End Settings Saving ---
    
    # Log successful initialization
    await db_logger.info(
        db,
        f"System initialized successfully by {created_user.username}",
        extra_data={
            "admin_user_id": created_user.id,
            "settings_configured": [
                "openai_api_key",
                "openai_model",
                "system_prompt",
                "max_concurrent_analysis_tasks",
                "parallel_openai_requests_per_prompt",
                "max_total_openai_attempts_per_prompt",
                "request_timeout_seconds"
            ]
        }
    )

    # We return the created admin user info (excluding password)
    return created_user

# Need to import func from sqlalchemy (already imported earlier, but keep for clarity if needed)
# from sqlalchemy import func, select # No longer needed for the updated check_initialization_status