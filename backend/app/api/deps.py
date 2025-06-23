import asyncio # Add asyncio import for Queue type hint if needed later
from typing import Generator, Optional, AsyncGenerator
from fastapi import Request, FastAPI, Depends, HTTPException, status # Consolidate imports
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core import security
from app.db.session import get_db
from app.models.admin_user import AdminUser
from app.crud.crud_admin_user import crud_admin_user
from app.schemas.token import TokenPayload

from app.services.request_service import RequestService # Import the service
from app.websockets.connection_manager import ConnectionManager # Import ConnectionManager

# OAuth2PasswordBearer scheme pointing to the login endpoint
# auto_error=False allows the token to be optional
reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token",
    auto_error=False
)

async def get_current_user(
    db: AsyncSession = Depends(get_db), token: Optional[str] = Depends(reusable_oauth2)
) -> AdminUser:
    """
    Dependency to get the current user from the token.
    Raises HTTPException if token is invalid or user not found.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token_data = security.decode_token(token)
    if not token_data or not token_data.sub:
        raise credentials_exception
    user = await crud_admin_user.get_by_username(db, username=token_data.sub)
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(
    current_user: AdminUser = Depends(get_current_user),
) -> AdminUser:
    """
    Dependency to get the current active user.
    Raises HTTPException if the user is inactive.
    """
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
    return current_user

async def get_optional_current_user(
    db: AsyncSession = Depends(get_db), 
    token: Optional[str] = Depends(reusable_oauth2)
) -> Optional[AdminUser]:
    """
    Dependency to optionally get the current user from the token.
    Returns None if no token provided or token is invalid.
    Used for endpoints that should log but not require authentication.
    """
    if not token:
        return None
    
    try:
        token_data = security.decode_token(token)
        if not token_data or not token_data.sub:
            return None
        user = await crud_admin_user.get_by_username(db, username=token_data.sub)
        return user
    except Exception:
        return None

# Placeholder for other potential dependencies
# def get_some_service():
#     pass

# Dependency to get the FastAPI app instance
# This relies on the 'app' key being present in the request scope, which is standard.
def get_app(request: Request) -> FastAPI:
    """
    Dependency to get the main FastAPI application instance.
    """
    return request.app
# Dependency function to get RequestService instance
async def get_request_service(
    request: Request, # Add request to access app state
    db: AsyncSession = Depends(get_db)
) -> RequestService:
    """
    Dependency function to get an instance of RequestService with db session,
    analysis queue, and websocket manager from app state.
    """
    # Retrieve dependencies from application state
    analysis_queue = request.app.state.analysis_queue
    websocket_manager = request.app.state.websocket_manager # Assuming it's stored here

    # Check if dependencies exist in state (optional but recommended)
    if not hasattr(request.app.state, 'analysis_queue'):
         raise HTTPException(status_code=500, detail="Analysis queue not initialized in app state.")
    if not hasattr(request.app.state, 'websocket_manager'):
         raise HTTPException(status_code=500, detail="WebSocket manager not initialized in app state.")

    return RequestService(db=db, analysis_queue=analysis_queue, manager=websocket_manager)