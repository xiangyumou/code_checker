from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud, models, schemas
from app.api import deps
from app.core import security
from app.core.config import settings

router = APIRouter()

@router.post("/login/access-token", response_model=schemas.Token)
async def login_access_token(
    db: AsyncSession = Depends(deps.get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests.
    Used by the admin frontend.
    """
    user = await crud.crud_admin_user.authenticate(
        db, username=form_data.username, password=form_data.password
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    elif not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        user.username, expires_delta=access_token_expires # Use username as subject
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login/test-token", response_model=schemas.AdminUser)
async def test_token(
    current_user: models.AdminUser = Depends(deps.get_current_active_user),
) -> Any:
    """
    Test access token validity. Returns the current user if token is valid.
    """
    return current_user

# Optional: Logout endpoint (if using server-side sessions or token blocklist)
# @router.post("/logout")
# async def logout():
#     # Implementation depends on session/token strategy
#     return {"message": "Logout successful"}