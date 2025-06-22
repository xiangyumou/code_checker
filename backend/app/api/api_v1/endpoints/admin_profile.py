import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud, models, schemas
from app.api import deps

logger = logging.getLogger(__name__)
router = APIRouter()

@router.put("/me", response_model=schemas.AdminUser)
async def update_current_user(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: models.AdminUser = Depends(deps.get_current_active_user),
    user_in: schemas.AdminUserUpdate, # Use the existing AdminUserUpdate schema for input
) -> Any:
    """
    Update the profile (username and/or password) for the currently authenticated admin user.
    """
    logger.info(f"User '{current_user.username}' attempting to update their profile.")

    # Get the data submitted for update, excluding fields that were not set
    update_data = user_in.model_dump(exclude_unset=True)

    # If no data was submitted for update, return the current user without changes
    if not update_data:
        logger.info("No update data provided.")
        return current_user

    # --- Username Uniqueness Check ---
    new_username = update_data.get("username")
    if new_username and new_username != current_user.username:
        logger.info(f"Attempting to change username from '{current_user.username}' to '{new_username}'.")
        existing_user = await crud.crud_admin_user.get_by_username(db, username=new_username)
        if existing_user:
            logger.warning(f"Username '{new_username}' already exists. Update rejected for user '{current_user.username}'.")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already exists. Please choose a different one.",
            )
        logger.info(f"New username '{new_username}' is available.")
    elif new_username == current_user.username:
        # If user submitted the same username, remove it from update_data to avoid unnecessary processing
        del update_data["username"]
        if not update_data: # Check again if only username (same) was provided
             logger.info("No actual changes provided (only same username).")
             return current_user


    # --- Password Update Check ---
    if "password" in update_data:
        # Log if password field is present, CRUD layer handles hashing if value is not None
        logger.info(f"Password update included in request for user '{current_user.username}'.")
        if not update_data["password"]: # Handle case where password is empty string ""
             logger.info("Empty password provided, removing from update data.")
             del update_data["password"] # Don't update password if empty string is sent

    # If after checks, update_data is empty, return
    if not update_data:
        logger.info("No actual changes to apply after checks.")
        return current_user

    # --- Perform Update ---
    try:
        # The CRUD update method handles hashing the password if it's present in update_data
        updated_user = await crud.crud_admin_user.update(db=db, db_obj=current_user, obj_in=update_data)
        # Note: crud.base.update already calls db.add(db_obj) and db.commit()
        # We might need to adjust crud.base.update if we want transaction control here.
        # Assuming crud.base.update commits per update for now.
        # Let's add commit and refresh here for explicit control if crud doesn't commit.
        await db.commit()
        await db.refresh(updated_user)
        log_username = updated_user.username # Use potentially new username for logging success
        logger.info(f"User '{log_username}' profile updated successfully.")
        return updated_user
    except Exception as e:
        await db.rollback() # Ensure rollback on any exception during update process
        logger.error(f"Error updating profile for user '{current_user.username}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while updating the profile.",
        )