import logging
from typing import List, Optional

import os
import uuid
import aiofiles
from pathlib import Path
import shutil
import asyncio # Keep for Queue type hint
import base64 # ADDED for encoding

from fastapi import UploadFile, HTTPException, status # Import UploadFile for type hint, add status
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud, schemas, models # Import models for db object type hint
from app.core.config import settings as app_settings # Import settings for upload dir
from app.websockets.connection_manager import ConnectionManager # Import for type hint
# Import RequestStatus if needed for type hints or logic later
# from app.models.request import RequestStatus

logger = logging.getLogger("app." + __name__) # Match logger name convention

class RequestService:
    """
    Service layer for handling business logic related to analysis requests.
    Decouples endpoint logic from data access logic (CRUD).
    """
    def __init__(self, db: AsyncSession, analysis_queue: asyncio.Queue, manager: ConnectionManager):
        """
        Initializes the RequestService with a database session, analysis queue,
        and WebSocket connection manager.

        Args:
            db: The asynchronous database session.
            analysis_queue: The queue for pending analysis tasks.
            manager: The WebSocket connection manager.
        """
        self.db = db
        self.queue = analysis_queue
        self.manager = manager
        # You might initialize crud instances here if used across multiple methods
        # self.crud_request = crud.crud_request

    async def _save_uploaded_image(self, image: UploadFile, destination_dir: Path) -> str:
        """Saves a single uploaded image to the destination directory."""
        try:
            # Create a unique filename to avoid collisions
            file_extension = Path(image.filename).suffix
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            destination_path = destination_dir / unique_filename

            # Ensure the directory exists
            destination_dir.mkdir(parents=True, exist_ok=True)

            # Asynchronously write the file content
            async with aiofiles.open(destination_path, 'wb') as out_file:
                while content := await image.read(1024 * 1024):  # Read in 1MB chunks
                    await out_file.write(content)

            # Return the relative path for storage in the database
            # Calculate relative path based on the '/app/data' directory
            data_base_path = Path(app_settings.BASE_DIR) / "data"
            relative_path = destination_path.relative_to(data_base_path).as_posix() # Store relative path (e.g., uploads/images/...)
            logger.info(f"Successfully saved image: {image.filename} to {relative_path}")
            return relative_path
        except IOError as e:
            logger.error(f"IOError saving image {image.filename}: {e}", exc_info=True)
            # Clean up potentially partially written file
            if 'destination_path' in locals() and destination_path.exists():
                try:
                    os.remove(destination_path)
                except OSError as remove_err:
                    logger.error(f"Error removing partially saved file {destination_path}: {remove_err}")
            raise # Re-raise the IOError to be caught by the endpoint
        except Exception as e:
            logger.error(f"Unexpected error saving image {image.filename}: {e}", exc_info=True)
            raise # Re-raise unexpected errors

    async def create_request(
        self,
        *,
        user_prompt: Optional[str],
        images: Optional[List[UploadFile]]
        # analysis_queue and manager are now instance attributes
    ) -> models.Request: # Return the DB model instance, endpoint handles refresh/schema conversion
        """
        Handles the business logic for creating a new analysis request.
        - Saves uploaded images.
        - Creates the request record in the database.
        - Adds the request ID to the analysis queue using self.queue.
        - Broadcasts the creation event via WebSocket using self.manager.

        Args:
            user_prompt: The user's text prompt.
            images: A list of uploaded image files.
            # analysis_queue: (Removed) Now accessed via self.queue.
            # manager: (Removed) Now accessed via self.manager.

        Returns:
            The created database Request object.

        Raises:
            ValueError: If input data is invalid (e.g., no prompt and no images).
            IOError: If there's an error saving uploaded images.
            Exception: For other unexpected errors during processing.
        """
        logger.info(f"RequestService.create_request called with prompt: {'yes' if user_prompt else 'no'}, images: {len(images) if images else 0}")

        if (user_prompt is None or user_prompt.strip() == "") and not images:
            logger.warning("Create request attempt with effectively empty prompt and no images.")
            raise ValueError("Request must include either a non-empty text prompt or at least one image.") # Update error message slightly

        image_references: List[str] = []
        upload_dir = Path(app_settings.IMAGE_UPLOAD_DIR)

        # 1. Save Images (if any)
        if images:
            save_tasks = [self._save_uploaded_image(img, upload_dir) for img in images]
            try:
                # Run save operations concurrently
                image_references = await asyncio.gather(*save_tasks)
                logger.info(f"Saved {len(image_references)} images.")
            except (IOError, Exception) as e:
                # If any image save fails, log and re-raise. Endpoint handles rollback.
                logger.error(f"Error during image saving process: {e}", exc_info=True)
                # Note: asyncio.gather might not guarantee cleanup of successfully saved files
                # before the error occurred. More robust cleanup might be needed if partial success is unacceptable.
                raise # Re-raise the original error (IOError or other)

        # 2. Create Request object in DB
        request_create_data = schemas.RequestCreate(user_prompt=user_prompt) # images_base64 removed
        try:
            # Assuming crud_request.create handles basic creation
            # We'll add image references separately or modify CRUD later if needed
            # For now, let's create then update. Consider a dedicated CRUD method later.
            db_request = await crud.crud_request.create(db=self.db, obj_in=request_create_data)
            if image_references:
                db_request.image_references = image_references
                self.db.add(db_request) # Add again to session to mark for update
                await self.db.flush() # Flush to ensure the update is pending before queueing/broadcasting
                await self.db.refresh(db_request, attribute_names=['image_references']) # Refresh to get updated refs if needed
            logger.info(f"Created request record with ID: {db_request.id}")
        except Exception as e:
            logger.error(f"Database error creating request: {e}", exc_info=True)
            # No need to rollback here, endpoint handles it. Just re-raise.
            raise HTTPException(status_code=500, detail="Database error during request creation.") from e


        # 3 & 4: Handle post-creation steps (queueing and broadcasting) using instance attributes
        await self._handle_request_post_creation(db_request)

        # 5. Return the created DB object (endpoint will commit and refresh)
        return db_request

    async def _handle_request_post_creation(
        self,
        db_request: models.Request
        # analysis_queue and manager are now instance attributes
    ):
        """Handles queueing (using self.queue) and broadcasting (using self.manager)
           after request creation/regeneration."""
        # Add request ID to the analysis queue using self.queue
        try:
            await self.queue.put(db_request.id)
            logger.info(f"Request ID {db_request.id} added to analysis queue.")
        except Exception as e:
            logger.critical(f"CRITICAL: Failed to add request ID {db_request.id} to analysis queue: {e}", exc_info=True)
            # Raise specific exception for endpoint to handle rollback
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to queue request for processing.") from e

        # Broadcast the creation event via WebSocket using self.manager
        try:
            await self.db.refresh(db_request) # Ensure object is up-to-date

            # Derive filename from image_references
            filename = None
            if db_request.image_references and isinstance(db_request.image_references, list) and len(db_request.image_references) > 0:
                try:
                    # Extract only the filename from the first reference path
                    first_ref_path = Path(db_request.image_references[0])
                    filename = first_ref_path.name
                except Exception as path_err:
                    logger.warning(f"Could not parse filename from image reference '{db_request.image_references[0]}' for request {db_request.id}: {path_err}")
                    filename = db_request.image_references[0] # Fallback to full reference if parsing fails

            # Construct data compatible with RequestSummary
            summary_data = {
                "id": db_request.id,
                "status": db_request.status.value, # Send enum value
                "created_at": db_request.created_at.isoformat(), # Send ISO string
                "updated_at": db_request.updated_at.isoformat(), # Send ISO string
                "filename": filename,
                "error_message": db_request.error_message
            }

            # Validate against RequestSummary schema before sending (optional but good practice)
            try:
                validated_summary = schemas.RequestSummary.model_validate(summary_data)
                payload_to_send = validated_summary.model_dump(mode='json')
            except Exception as validation_err:
                logger.error(f"Failed to validate RequestSummary data for broadcast (ID: {db_request.id}): {validation_err}. Sending raw data.", exc_info=True)
                payload_to_send = summary_data # Fallback to sending raw dict

            await self.manager.broadcast_request_created(payload_to_send)
            logger.info(f"Broadcasted request creation (summary) for ID: {db_request.id}")
        except Exception as e:
            logger.error(f"Failed to broadcast request creation (summary) for ID {db_request.id}: {e}", exc_info=True)
            # Don't fail the request for broadcast errors

    async def regenerate_request(
        self,
        *,
        original_request_id: int
        # analysis_queue and manager are now instance attributes
    ) -> models.Request: # Return DB model
        """
        Handles the business logic for regenerating an analysis request based on a previous one.
        - Fetches the original request.
        - Creates a new request record copying relevant data (prompt, image references).
        - Queues the new request for analysis using self.queue.
        - Broadcasts the creation event using self.manager.

        Args:
            original_request_id: The ID of the original request to regenerate from.
            # analysis_queue: (Removed) Now accessed via self.queue.
            # manager: (Removed) Now accessed via self.manager.

        Returns:
            The created database Request object.

        Raises:
            HTTPException: If the original request is not found (404) or if there's a
                           database error (500) or queueing error (500).
        """
        logger.info(f"RequestService.regenerate_request called for original ID: {original_request_id}")

        # 1. Get the original request data (raises 404 if not found)
        original_request = await crud.crud_request.get_or_404(self.db, id=original_request_id)

        # 2. Prepare data for the new request
        new_request_data = schemas.RequestCreate(
            user_prompt=original_request.user_prompt,
            # image_references are copied after creation
        )

        # 3. Create the new request in the database
        try:
            new_db_request = await crud.crud_request.create(db=self.db, obj_in=new_request_data)
            # Copy image references from the original request
            if original_request.image_references:
                new_db_request.image_references = original_request.image_references
                self.db.add(new_db_request) # Mark for update
                await self.db.flush() # Ensure update is flushed before proceeding
                # Refreshing here might not be strictly necessary unless needed immediately
                # await self.db.refresh(new_db_request, attribute_names=['image_references'])
            logger.info(f"Regenerated request record created with ID: {new_db_request.id}")
        except Exception as e:
            logger.error(f"Database error creating regenerated request: {e}", exc_info=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error during request regeneration.") from e

        # 4. Handle post-creation steps (queueing and broadcasting) using the helper
        # This raises HTTPException on queueing failure, which endpoint should catch for rollback
        await self._handle_request_post_creation(new_db_request)

        # 5. Return the newly created DB object (endpoint will commit and refresh)
        return new_db_request

    async def get_request(self, *, request_id: int) -> Optional[schemas.Request]:
        """
        Retrieves a single request by its ID, including the base64 encoded
        content of all associated images.

        Args:
            request_id: The ID of the request to retrieve.

        Returns:
            The request schema (including images_base64 list and the deprecated
            image_base64 for the first image) if found, otherwise None.
            Raises HTTPException 404 if not found by CRUD.
        """
        logger.info(f"RequestService.get_request called for ID: {request_id}")
        # Use get_or_404 to handle not found case consistently
        request_obj = await crud.crud_request.get_or_404(self.db, id=request_id)

        images_base64_list: List[str] = []
        base_data_path = Path(app_settings.BASE_DIR) / "data"

        # Check if there are image references associated with the request
        if request_obj.image_references and isinstance(request_obj.image_references, list):
            logger.info(f"Processing {len(request_obj.image_references)} image references for request {request_id}.")
            for image_ref in request_obj.image_references:
                full_image_path = None # Initialize path variable for each iteration
                try:
                    # Construct the full path relative to the '/app/data' directory
                    # Ensure image_ref is treated as relative path from base_data_path
                    safe_image_ref = image_ref.lstrip('/')
                    full_image_path = (base_data_path / safe_image_ref).resolve()
                    logger.debug(f"Attempting to read image for request {request_id}. Reference: '{image_ref}', Resolved Path: '{full_image_path}'")

                    # Security check: Ensure the resolved path is still within the intended data directory
                    if not str(full_image_path).startswith(str(base_data_path.resolve())):
                        logger.error(f"Attempted path traversal detected for image path: {image_ref} (Resolved: {full_image_path}) in request {request_id}")
                        # Skip this image, log error, continue with others
                        continue

                    # Use asyncio.to_thread for synchronous os.path.exists check
                    file_exists = await asyncio.to_thread(full_image_path.exists)
                    logger.debug(f"Checking existence of '{full_image_path}': {file_exists}")

                    if file_exists:
                        async with aiofiles.open(full_image_path, mode='rb') as image_file:
                            image_content = await image_file.read()
                        image_base64_str = base64.b64encode(image_content).decode('utf-8')
                        images_base64_list.append(image_base64_str)
                        logger.debug(f"Successfully read and encoded image '{full_image_path}' for request {request_id}")
                    else:
                        # Log the specific path that was checked and not found
                        logger.warning(f"Image file not found at resolved path: '{full_image_path}' for request {request_id} (Reference: '{image_ref}')")
                        # Optionally append a placeholder or None if needed, or just skip

                except FileNotFoundError as e:
                    # Log the path that caused the error
                    log_path = full_image_path if full_image_path else image_ref
                    logger.warning(f"Image file not found or invalid path for request {request_id}. Reference: '{image_ref}', Checked Path: '{log_path}'. Error: {e}")
                except IOError as e:
                    # Log the path that caused the error
                    log_path = full_image_path if full_image_path else image_ref
                    logger.error(f"IOError reading image file for request {request_id}. Reference: '{image_ref}', Path: '{log_path}'. Error: {e}", exc_info=False)
                except Exception as e:
                    # Log the path that caused the error
                    log_path = full_image_path if full_image_path else image_ref
                    logger.error(f"Unexpected error reading or encoding image for request {request_id}. Reference: '{image_ref}', Path: '{log_path}'. Error: {e}", exc_info=True)
                # Continue to the next image even if one fails

        # Convert DB model to Pydantic schema
        request_schema = schemas.Request.model_validate(request_obj)

        # Add the list of base64 strings to the schema
        request_schema.images_base64 = images_base64_list
        logger.debug(f"Added {len(images_base64_list)} base64 image(s) to response list for request {request_id}")

        # For backward compatibility, set the old field to the first image's base64 if available
        if images_base64_list:
            request_schema.image_base64 = images_base64_list[0]
            logger.debug(f"Set deprecated image_base64 field for backward compatibility for request {request_id}")
        else:
             request_schema.image_base64 = None # Ensure it's None if no images were processed

        return request_schema


    async def get_all_requests(self, *, skip: int = 0, limit: int = 100, status: Optional[schemas.RequestStatus] = None) -> List[schemas.Request]:
        """
        Retrieves a list of requests, wrapping the CRUD operation, optionally filtering by status.

        Args:
            skip: Number of requests to skip.
            limit: Maximum number of requests to return.
            status: Optional status to filter requests by.

        Returns:
            A list of request schemas.
        """
        logger.info(f"RequestService.get_all_requests called (skip={skip}, limit={limit}, status={status})")
        # Use get_multi_with_status if status is provided, otherwise get_multi
        if status:
             request_objs = await crud.crud_request.get_multi_with_status(
                 self.db, status=status, skip=skip, limit=limit
             )
        else:
            request_objs = await crud.crud_request.get_multi(
                self.db, skip=skip, limit=limit
            )

        # Use model_validate for Pydantic v2 compatibility
        return [schemas.Request.model_validate(req) for req in request_objs]

# Note: Dependency function get_request_service is defined in app.api.deps