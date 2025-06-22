from pydantic import BaseModel, Field, EmailStr, ConfigDict # Import ConfigDict
from typing import Optional

# Shared properties
class AdminUserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    is_active: Optional[bool] = True

# Properties to receive via API on creation
class AdminUserCreate(AdminUserBase):
    password: str = Field(..., min_length=8)

# Properties to receive via API on update
class AdminUserUpdate(AdminUserBase):
    password: Optional[str] = Field(None, min_length=8) # Optional password update
    username: Optional[str] = Field(None, min_length=3, max_length=50) # Optional username update
    is_active: Optional[bool] = None

# Properties stored in DB (inherits from Base)
class AdminUserInDBBase(AdminUserBase):
    id: int

    # Use ConfigDict for Pydantic V2 compatibility
    model_config = ConfigDict(from_attributes=True)

# Additional properties stored in DB
class AdminUserInDB(AdminUserInDBBase):
    hashed_password: str

# Properties to return to client (never return password hashes)
class AdminUser(AdminUserInDBBase):
    pass # Excludes hashed_password by default