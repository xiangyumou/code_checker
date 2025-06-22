from pydantic import BaseModel, Field, ConfigDict, HttpUrl, SecretStr, AfterValidator, model_validator
from typing import Optional, Any, Dict, List, Literal, Union, Annotated # Import Annotated and AfterValidator
import re

# Shared properties
class SettingBase(BaseModel):
    key: str = Field(..., description="Unique key for the setting")
    value: Optional[Any] = Field(None, description="Value of the setting (can be any type, stored as string/JSON)")

# Properties to receive via API on creation
class SettingCreate(SettingBase):
    pass

# Properties to receive via API on update
class SettingUpdate(BaseModel):
    # Only allow updating the value, not the key
    value: Optional[Any] = Field(None, description="New value for the setting")

# Properties stored in DB
class SettingInDBBase(SettingBase):
    id: int

    # Use ConfigDict for Pydantic V2 compatibility
    model_config = ConfigDict(from_attributes=True)

# Properties to return to client
class Setting(SettingInDBBase):
    pass

# Schema for returning multiple settings (e.g., for admin panel)
class SettingList(BaseModel):
    settings: List[Setting]

# --- Custom Exceptions ---
class SettingValueError(ValueError):
    """Custom exception for setting validation errors."""
    def __init__(self, message: str, field_name: str):
        super().__init__(message)
        self.field_name = field_name

# --- Validation Functions ---
def validate_sk_format(v: Optional[SecretStr]) -> Optional[SecretStr]:
    """Checks if the OpenAI API key starts with 'sk-'."""
    if v is not None and not v.get_secret_value().startswith('sk-'):
        # Raise standard ValueError, Pydantic/FastAPI should handle this
        raise ValueError("Invalid OpenAI API Key format. Must start with 'sk-'.")
    return v

# --- Schemas ---

# Define individual fields for settings that can be updated.
# This allows leveraging Pydantic's built-in validation.
class SettingsUpdatePayload(BaseModel):
    # Use Annotated with AfterValidator for the custom format check
    openai_api_key: Annotated[Optional[SecretStr], AfterValidator(validate_sk_format)] = Field(None, description="OpenAI API Key (must start with 'sk-')")
    openai_model: Optional[str] = Field(None, min_length=1, description="Default OpenAI model name")
    openai_base_url: Optional[Union[HttpUrl, Literal[""]]] = Field(None, description="Optional OpenAI Base URL (must be valid HTTP/HTTPS or empty string)")
    system_prompt: Optional[str] = Field(None, min_length=1, description="The instruction given to the AI model")
    # Renamed from max_concurrent_requests. Controls system-wide analysis task concurrency. Requires backend restart to apply.
    max_concurrent_analysis_tasks: Optional[int] = Field(None, gt=0, description="Maximum concurrent user analysis tasks system-wide (must be > 0, requires restart)")
    # New setting for parallel requests per prompt
    openai_parallel_requests_per_prompt: Optional[int] = Field(None, gt=0, description="Number of parallel OpenAI requests per user prompt (must be > 0)")
    # New setting for total attempts per prompt
    openai_total_attempts_per_prompt: Optional[int] = Field(None, gt=0, description="Maximum total OpenAI attempts per user prompt (must be > 0)")
    request_timeout_seconds: Optional[int] = Field(None, gt=0, description="Maximum time for a single OpenAI response in seconds (must be > 0)")
    max_analysis_versions: Optional[int] = Field(None, gt=0, description="Maximum analysis versions per request (must be > 0)") # Kept this, assuming it's still relevant but not on the form? Or should it be removed?
    log_level: Optional[Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]] = Field(None, description="Logging level") # Kept this, assuming it's still relevant but not on the form? Or should it be removed?
    # Add other updatable settings here if needed, e.g., admin password update would need a separate schema/logic

    # Use ConfigDict for Pydantic V2 model configuration
    model_config = ConfigDict(
        extra='forbid', # Disallow extra fields not defined above
    )

    @model_validator(mode='after')
    def check_attempts_vs_parallel(cls, values: 'SettingsUpdatePayload') -> 'SettingsUpdatePayload':
        parallel = values.openai_parallel_requests_per_prompt
        total = values.openai_total_attempts_per_prompt
        if parallel is not None and total is not None and total < parallel:
            raise ValueError("Total attempts limit cannot be less than the number of parallel requests.")
        return values

    # Removed the @field_validator, using Annotated instead

# Schema for the PUT request body, containing the nested settings payload
class SettingsUpdate(BaseModel):
    settings: SettingsUpdatePayload = Field(..., description="Dictionary of settings to update.")

    model_config = ConfigDict(
        extra='forbid',
    )