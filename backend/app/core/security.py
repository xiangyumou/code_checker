from datetime import datetime, timedelta, timezone
from typing import Any, Union, Optional

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.core.config import settings
from app.schemas.token import TokenPayload # Import the TokenPayload schema

# Configure password hashing context using passlib
# bcrypt is a good default choice
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = settings.ALGORITHM

def create_access_token(
    subject: Union[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    """
    Creates a JWT access token.

    :param subject: The subject of the token (e.g., username or user ID).
    :param expires_delta: Optional timedelta for token expiration. If None, uses default from settings.
    :return: The encoded JWT access token.
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain password against a hashed password.

    :param plain_password: The plain text password.
    :param hashed_password: The hashed password from the database.
    :return: True if the password matches, False otherwise.
    """
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """
    Hashes a plain password.

    :param password: The plain text password.
    :return: The hashed password.
    """
    return pwd_context.hash(password)

def decode_token(token: str) -> Optional[TokenPayload]:
    """
    Decodes a JWT token and returns the payload if valid.

    :param token: The JWT token string.
    :return: TokenPayload schema object if valid, None otherwise.
    """
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[ALGORITHM]
        )
        # Validate payload structure using Pydantic schema
        token_data = TokenPayload(**payload)
        # Optional: Check if token is expired (although jwt.decode handles 'exp')
        # if token_data.exp < datetime.now(timezone.utc):
        #     return None # Or raise specific exception
        return token_data
    except JWTError:
        # Could log the error here
        return None