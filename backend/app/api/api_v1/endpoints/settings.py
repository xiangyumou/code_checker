import logging
from typing import Any, Dict, List
from pydantic import SecretStr # Import SecretStr

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud, models, schemas
from app.api import deps
# Import config settings to know which keys are expected/managed
from app.core.config import settings as default_settings
from app.core.logging import get_db_logger

logger = logging.getLogger(__name__)
router = APIRouter()
db_logger = get_db_logger("api.settings")

# Define keys that are considered sensitive and should not be returned directly
# Or implement more granular control based on user roles if needed later
SENSITIVE_KEYS = {"openai_api_key", "secret_key"} # Add other sensitive keys if any

@router.get("/", response_model=Dict[str, Any])
async def read_settings(
    db: AsyncSession = Depends(deps.get_db),
    current_user: models.AdminUser = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve all application settings.
    Sensitive keys like API keys might be masked or omitted.
    Requires admin privileges.
    """
    settings_dict = await crud.crud_setting.get_all_settings_as_dict(db)

    # Define keys expected to be integers or booleans
    # Define keys expected to be integers. Updated based on new/renamed settings.
    INT_KEYS = {
        "max_analysis_versions", # Keep existing relevant int key
        "openai_parallel_requests_per_prompt",
        "openai_total_attempts_per_prompt",
        "max_concurrent_analysis_tasks", # Renamed from max_concurrent_requests
        "request_timeout_seconds", # Also an integer
    }
    BOOL_KEYS = {"is_initialized"} # Add more if needed

    processed_settings = {}
    for key, value in settings_dict.items():
        if key in SENSITIVE_KEYS and value:
            processed_settings[key] = "**** MASKED ****"
        elif value is not None: # Attempt conversion only if value is not None
            try:
                if key in INT_KEYS:
                    processed_settings[key] = int(value)
                elif key in BOOL_KEYS:
                    # Handle common boolean string representations
                    if isinstance(value, str):
                        if value.lower() in ('true', '1', 'yes', 'on'):
                            processed_settings[key] = True
                        elif value.lower() in ('false', '0', 'no', 'off'):
                            processed_settings[key] = False
                        else:
                            processed_settings[key] = bool(value) # Fallback, might be unexpected
                    else:
                         processed_settings[key] = bool(value) # Handle non-string bools
                else:
                    processed_settings[key] = value # Keep as string or original type
            except (ValueError, TypeError):
                 logger.warning(f"Could not convert setting '{key}' value '{value}' to expected type. Returning raw value.")
                 processed_settings[key] = value # Return raw value on conversion error
        else:
             processed_settings[key] = value # Keep None as is

    return processed_settings

@router.put("/", response_model=Dict[str, Any])
async def update_settings(
    *,
    db: AsyncSession = Depends(deps.get_db),
    settings_in: schemas.SettingsUpdate, # Use the schema for bulk updates
    current_user: models.AdminUser = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update multiple application settings.
    Requires admin privileges.
    The input should be a dictionary where keys are setting keys and values are new values.
    """
    logger.info(f"Admin user {current_user.username} updating settings.")
    updated_settings = {}
    # TODO: Add validation for specific setting values (e.g., integer ranges, valid choices)
    # TODO: Handle potential encryption/decryption for sensitive keys like openai_api_key

    # Iterate through the fields defined in the SettingsUpdatePayload model
    # Use model_dump to get a dict of provided fields, excluding None values
    update_payload = settings_in.settings.model_dump(exclude_unset=True)

    for key, value in update_payload.items():
        # Basic check: prevent updating sensitive keys via this bulk endpoint if needed?
        # Or handle sensitive keys specifically (e.g., require separate endpoint or confirmation)
        # if key in SENSITIVE_KEYS:
        #     logger.warning(f"Attempt to update sensitive key '{key}' via bulk update ignored.")
        #     continue

        # Determine value for validation (handle SecretStr)
        value_for_validation = value
        if key == "openai_api_key" and isinstance(value, SecretStr):
            value_for_validation = value.get_secret_value()

        # Implement settings validation
        if key == "log_level":
            valid_log_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
            if str(value_for_validation).upper() not in valid_log_levels:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid log level. Must be one of: {', '.join(valid_log_levels)}"
                )
        elif key == "openai_parallel_requests_per_prompt": # Assuming this maps to "max_parallel_requests" in the instruction
            try:
                parallel_val = int(value_for_validation)
                if not 1 <= parallel_val <= 10:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="openai_parallel_requests_per_prompt must be between 1 and 10"
                    )
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="openai_parallel_requests_per_prompt must be an integer"
                )
        elif key == "openai_total_attempts_per_prompt": # Assuming this maps to "max_total_attempts" in the instruction
            try:
                attempts_val = int(value_for_validation)
                if not 1 <= attempts_val <= 20:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="openai_total_attempts_per_prompt must be between 1 and 20"
                    )
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="openai_total_attempts_per_prompt must be an integer"
                )
        
        # Note: For openai_api_key, encryption should be implemented here in production
        # For now, storing as plain text with a warning in logs
        if key == "openai_api_key":
            logger.warning("Storing openai_api_key in plain text. Consider implementing encryption.")

        # Handle SecretStr for API key before saving
        if key == "openai_api_key" and isinstance(value, SecretStr):
            value_to_save = value.get_secret_value()
        else:
            value_to_save = value

        try:
            setting = await crud.crud_setting.create_or_update(db, key=key, value=value_to_save)
            updated_settings[key] = setting.value # Store the raw saved value (string from DB)
            logger.info(f"Setting '{key}' updated successfully.")
            
            # Log to database (mask sensitive values)
            log_value = "**** MASKED ****" if key in SENSITIVE_KEYS else str(value_to_save)
            await db_logger.info(db, f"Setting '{key}' updated by {current_user.username} to: {log_value}")

            # Broadcast setting update via WebSocket for each updated setting
            from app.websockets.connection_manager import manager
            await manager.broadcast(
                {
                    "type": "setting_updated",
                    "setting_key": key,
                    "message": f"Setting '{key}' has been updated"
                }
            )

        except Exception as e:
            logger.error(f"Failed to update setting '{key}': {e}")
            # Decide on error handling: continue or raise exception?
            # For now, log and continue, but report failure in response?
            # Let's raise an error for simplicity now.
            await db.rollback() # Rollback transaction on error
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update setting '{key}'."
            )

    await db.commit() # Commit all changes if loop completes successfully

    # Return the updated settings (potentially masked)
    final_settings = await crud.crud_setting.get_all_settings_as_dict(db)
    for key in SENSITIVE_KEYS:
        if key in final_settings and final_settings[key]:
            final_settings[key] = "**** MASKED ****"

    # TODO: Trigger application components to reload settings if necessary
    # (e.g., update OpenAI client, logging level, semaphore limit)
    # This might involve global state, singletons, or specific reload functions.
    logger.warning("Settings updated in DB. Application components may need a restart or reload mechanism to apply changes.")

    return final_settings