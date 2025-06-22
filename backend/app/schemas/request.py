from pydantic import BaseModel, Field, field_validator, ConfigDict # Import ConfigDict
from typing import Optional, List, Any
import datetime
import base64 # For base64 validation

# Re-import Enum from models to use in schemas
from app.models.request import RequestStatus
# AnalysisVersion schema is no longer needed

# Shared properties
class RequestBase(BaseModel):
    user_prompt: Optional[str] = Field(None, max_length=10000) # Limit prompt length
    # images_base64: Optional[List[str]] = Field(None, max_items=5) # REMOVED: API still accepts this, but it's not part of the base response/DB model anymore
    # REMOVED: validator for images_base64

# Properties to receive via API on creation
class RequestCreate(RequestBase):
    # Inherits user_prompt from RequestBase
    # images_base64 is removed as images will be uploaded via File(...) parameter in the endpoint
    pass # No additional fields needed here for now

# Properties to receive via API on update (usually internal status updates)
class RequestUpdate(BaseModel):
    status: Optional[RequestStatus] = None
    error_message: Optional[str] = None
    # Analysis results can also be updated internally
    gpt_raw_response: Optional[Any] = None # Changed type hint from str to Any/dict
    # Removed: organized_problem_json, modified_code, modification_analysis_json
    # gpt_raw_response and is_success are kept as they are updated by the background task
    is_success: Optional[bool] = None

# Properties stored in DB (Does NOT inherit images_base64 from RequestBase anymore)
class RequestInDBBase(RequestBase):
    # Inherits user_prompt from RequestBase
    id: int
    status: RequestStatus
    image_references: Optional[List[str]] = None # ADDED: Stores list of relative image paths
    error_message: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    # Analysis Results (matching the model)
    gpt_raw_response: Optional[Any] = None # Changed type hint from str to Any/dict
    # Removed: organized_problem_json, modified_code, modification_analysis_json
    # gpt_raw_response and is_success are kept
    is_success: bool = False # Default to False

    # Use ConfigDict for Pydantic V2 compatibility
    model_config = ConfigDict(from_attributes=True)

# Additional properties stored in DB (not usually returned directly)
# class RequestInDB(RequestInDBBase):
#     pass

# Properties to return to client
class Request(RequestInDBBase):
    # No longer returning versions or current_version
    # Analysis results are now part of RequestInDBBase
    image_base64: Optional[str] = None # DEPRECATED: Use images_base64 instead. Holds base64 of the first image.
    images_base64: List[str] = [] # ADDED: To hold base64 encoded data for all images
    # Inherits other fields from RequestInDBBase

# Properties for summary view (e.g., list endpoints)
class RequestSummary(BaseModel):
    id: int
    status: RequestStatus
    created_at: datetime.datetime
    updated_at: datetime.datetime
    filename: Optional[str] = None # Derived from image_references, e.g., the first image
    error_message: Optional[str] = None

    # Use ConfigDict for Pydantic V2 compatibility
    model_config = ConfigDict(from_attributes=True)
# Schema for the list response
class RequestList(BaseModel):
    requests: List[Request]
    total: int