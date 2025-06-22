from pydantic import BaseModel
from typing import Optional

class Token(BaseModel):
    """
    Schema for returning JWT access token.
    """
    access_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):
    """
    Schema for the data encoded within the JWT token.
    'sub' typically holds the user identifier (e.g., username or user ID).
    """
    sub: Optional[str] = None # Subject (user identifier)
    # Add other claims like expiration (exp), issued at (iat) if needed for client-side checks
    # exp: Optional[int] = None
    # iat: Optional[int] = None