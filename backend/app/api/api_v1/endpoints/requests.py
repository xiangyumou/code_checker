from sqlalchemy.ext.asyncio import AsyncSession
# backend/app/api/api_v1/endpoints/requests.py (完整内容)
from typing import Any, List, Optional # Removed Dict as it's not used
import asyncio # Needed for Queue type hint

from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile, Form, Request # Added Request
# Removed AsyncSession import
import logging
# Removed settings import

from app import models, schemas # Removed crud
from app.api import deps # Import deps to use deps.get_request_service
# Removed unused imports
from app.websockets.connection_manager import ConnectionManager # Import manager type hint for DI
# Import RequestService
from app.services.request_service import RequestService
from app.models.admin_user import AdminUser
from typing import Optional

router = APIRouter()
logger = logging.getLogger("app." + __name__)


# REMOVED old get_request_service dependency function, now using deps.get_request_service


@router.post("/", response_model=schemas.Request, status_code=status.HTTP_201_CREATED)
async def create_request(
    *,
    request: Request, # Receive raw request
    db: AsyncSession = Depends(deps.get_db),
    request_service: RequestService = Depends(deps.get_request_service),
    current_user: Optional[AdminUser] = Depends(deps.get_optional_current_user)
) -> Any:
    """
    Create new analysis request. Manually parses form data for debugging.
    Logs unauthorized access attempts.
    """
    # Log access attempt
    client_ip = request.client.host if request.client else "unknown"
    if current_user:
        logger.info(f"Request creation attempt by authenticated user: {current_user.username} from IP: {client_ip}")
    else:
        logger.warning(f"Request creation attempt by unauthenticated user from IP: {client_ip}")
    
    try:
        # Manually parse the form data
        form_data = await request.form()

        # Extract user_prompt and images manually
        user_prompt_value = form_data.get("user_prompt")
        image_files = form_data.getlist("images") # Use getlist for potentially multiple files


        # --- TEMPORARY: Return dummy response for debugging ---
        # We stop here for now to just see the parsed data in logs.
        # The actual logic below needs to be adapted later based on findings.
        # return {"message": "Debug: Parsed form data logged."}
        # --- END TEMPORARY ---

        # --- ORIGINAL LOGIC (Needs Adaptation) ---
        # The following logic needs to be adapted to use user_prompt_value and image_files
        # For now, we comment it out or bypass it for debugging the parsing step.

        # Basic check at endpoint level (using manually parsed values)
        if (user_prompt_value is None or str(user_prompt_value).strip() == "") and not image_files:
             logger.warning("Create request attempt with effectively empty prompt and no images at endpoint (manual parse).")
             raise HTTPException(
                 status_code=status.HTTP_400_BAD_REQUEST,
                 detail="Request must include either a non-empty text prompt or at least one image.",
             )

        try:
            # Call the service layer, passing manually parsed data
            # Ensure service expects List[starlette.datastructures.UploadFile] or compatible
            created_db_request = await request_service.create_request(
                user_prompt=str(user_prompt_value) if user_prompt_value is not None else None, # Convert if needed, handle None
                images=image_files, # Pass the list of Starlette UploadFile objects
            )

            # If service layer completes without raising an exception, commit the transaction
            await db.commit()
            await db.refresh(created_db_request) # Refresh to get final state after commit
            logger.info(f"Request {created_db_request.id} created successfully via service (manual parse) and committed.")
            # Convert to Pydantic model before returning
            return schemas.Request.model_validate(created_db_request)

        except ValueError as ve: # Catch specific validation/processing errors raised by the service
            logger.error(f"Error during request creation service call: {ve}", exc_info=False)
            await db.rollback() # Ensure rollback on handled errors from service
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
        except IOError as ioe: # Specifically catch IOErrors (like image saving) from service
            logger.error(f"IO Error during request creation service call: {ioe}", exc_info=True)
            await db.rollback() # Ensure rollback
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to save uploaded files.")
        except HTTPException as http_exc: # Catch HTTPExceptions raised by the service (e.g., queueing error)
            logger.error(f"HTTP Exception during request creation service call: {http_exc.detail}", exc_info=False)
            await db.rollback() # Ensure rollback
            raise http_exc # Re-raise the exception
        except Exception as e:
            # Catch unexpected errors from the service layer or commit
            logger.exception(f"Unexpected error during request creation endpoint (manual parse path): {e}", exc_info=True)
            await db.rollback() # Ensure rollback on any unexpected error
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error during request creation.")


    except Exception as e:
        logger.exception(f"Error during manual form parsing or endpoint execution: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during request processing.")


@router.get("/", response_model=List[schemas.RequestSummary]) # Use RequestSummary for list view
async def read_requests(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    status: Optional[schemas.RequestStatus] = Query(None),
    request_service: RequestService = Depends(deps.get_request_service), # Inject service
    current_user: Optional[AdminUser] = Depends(deps.get_optional_current_user)
) -> Any:
    """
    Retrieve analysis requests using RequestService. Publicly accessible.
    Supports filtering by status and pagination. Logs unauthorized access attempts.
    """
    # Log access attempt
    client_ip = request.client.host if request.client else "unknown"
    if current_user:
        logger.info(f"Request list access by authenticated user: {current_user.username} from IP: {client_ip}")
    else:
        logger.warning(f"Request list access by unauthenticated user from IP: {client_ip}")
    # Call service layer to get requests
    requests = await request_service.get_all_requests(
        status=status, skip=skip, limit=limit
    )
    # Service layer should already return Pydantic models if designed that way,
    # but we validate here to ensure the contract.
    # If service returns DB models, validation is necessary. Assuming service returns Pydantic models.
    # return [schemas.Request.model_validate(req) for req in requests] # Keep validation if service returns DB models
    return requests # Assuming service returns List[schemas.Request]


@router.get("/{request_id}", response_model=schemas.Request)
async def read_request(
    *,
    request: Request,
    request_id: int,
    request_service: RequestService = Depends(deps.get_request_service), # Inject service
    current_user: Optional[AdminUser] = Depends(deps.get_optional_current_user)
) -> Any:
    """
    Get specific request by ID using RequestService. Publicly accessible.
    Logs unauthorized access attempts.
    """
    # Log access attempt
    client_ip = request.client.host if request.client else "unknown"
    if current_user:
        logger.info(f"Request {request_id} access by authenticated user: {current_user.username} from IP: {client_ip}")
    else:
        logger.warning(f"Request {request_id} access by unauthenticated user from IP: {client_ip}")
    # Call service layer to get the request
    # Service method handles the "not found" case and raises HTTPException
    request_obj = await request_service.get_request(request_id=request_id)
    # Service layer should return the Pydantic model directly.
    # return schemas.Request.model_validate(request_obj) # Keep validation if service returns DB model
    return request_obj # Assuming service returns schemas.Request


@router.post("/{request_id}/regenerate", response_model=schemas.Request)
async def regenerate_request_analysis(
    *,
    request: Request, # Add Request object to access app state
    db: AsyncSession = Depends(deps.get_db), # Keep for transaction management
    request_id: int,
    request_service: RequestService = Depends(deps.get_request_service), # Inject service
    current_user: Optional[AdminUser] = Depends(deps.get_optional_current_user)
) -> Any:
    """
    Create a *new* analysis request based on an existing one by calling the RequestService.
    Handles transaction commit/rollback at the endpoint level. Logs unauthorized access attempts.
    """
    # Log access attempt
    client_ip = request.client.host if request.client else "unknown"
    if current_user:
        logger.info(f"Request {request_id} regeneration by authenticated user: {current_user.username} from IP: {client_ip}")
    else:
        logger.warning(f"Request {request_id} regeneration attempt by unauthenticated user from IP: {client_ip}")
    
    logger.info(f"Received request to regenerate analysis for request ID: {request_id}")

    try:
        # Call the service layer to handle regeneration logic
        new_db_request = await request_service.regenerate_request(
            original_request_id=request_id
            # Removed manager=websocket_manager, service handles it internally
            # Removed analysis_queue parameter, will be added after commit
        )

        # If service layer completes without raising an exception, commit the transaction
        await db.commit()
        await db.refresh(new_db_request) # Refresh to get final state after commit
        logger.info(f"Regenerated request {new_db_request.id} created successfully via service and committed.")

        # Put the new request ID into the analysis queue after successful commit
        try:
            await request.app.state.analysis_queue.put(new_db_request.id)
            logger.info(f"Successfully queued regenerated request ID {new_db_request.id} for analysis.")
        except Exception as queue_err:
            # Log the queuing error but don't fail the request, as the request object is already created.
            # This might require manual intervention or a separate monitoring mechanism.
            logger.error(f"Failed to queue regenerated request ID {new_db_request.id} after creation: {queue_err}", exc_info=True)
            # Optionally, update the request status to indicate a queuing issue if the model supports it.

        # Convert the final DB object to Pydantic schema for the response
        return schemas.Request.model_validate(new_db_request)

    except HTTPException as http_exc:
        # Catch HTTPExceptions raised by the service (e.g., 404 Not Found, 500 Queueing error)
        logger.error(f"HTTP Exception during request regeneration service call: {http_exc.detail}", exc_info=False)
        await db.rollback() # Ensure rollback
        raise http_exc # Re-raise the exception
    except Exception as e:
        # Catch unexpected errors from the service layer or commit
        logger.exception(f"Unexpected error during request regeneration endpoint: {e}", exc_info=True)
        await db.rollback() # Ensure rollback on any unexpected error
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error during request regeneration.")

# Note: GET endpoint for specific version is implicitly handled by GET /{request_id}
# as it returns all versions. Frontend can select the desired one.
# If a dedicated endpoint is needed:
# @router.get("/{request_id}/versions/{version_id}", response_model=schemas.AnalysisVersion)
# async def read_request_version(...): ...