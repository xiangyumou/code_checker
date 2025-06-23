import logging
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query, Body, FastAPI # Removed Request, Added FastAPI
from sqlalchemy.ext.asyncio import AsyncSession
# Import the new dependency
from app.api.deps import get_app

from app import crud, models, schemas
from app.api import deps
from app.services.openai_processor import process_analysis_request # For retry
from app.services.request_service import RequestService # ADDED: Import RequestService
# Import the WebSocket manager
from app.websockets.connection_manager import manager
from app.core.logging import get_db_logger

logger = logging.getLogger(__name__)
db_logger = get_db_logger("api.admin_requests")
router = APIRouter()

from pydantic import BaseModel # Import BaseModel
from typing import Dict # Import Dict

# Schema for batch operations
class BatchRequestAction(BaseModel):
    action: str # e.g., "delete", "retry"
    request_ids: List[int]

@router.get("/", response_model=List[schemas.RequestSummary]) # Use RequestSummary for list view
async def read_admin_requests(
    db: AsyncSession = Depends(deps.get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500), # Allow larger limit for admin
    status: Optional[schemas.RequestStatus] = Query(None),
    current_user: models.AdminUser = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve analysis requests for admin panel.
    Supports filtering by status and pagination.
    Requires admin privileges.
    """
    # Uses the same CRUD method as public endpoint for now, could be extended later
    requests = await crud.crud_request.get_multi_with_status(
        db, status=status, skip=skip, limit=limit
    )
    return requests

@router.get("/{request_id}", response_model=schemas.Request) # Consider a more detailed admin schema later
async def read_admin_request(
    *,
    # db: AsyncSession = Depends(deps.get_db), # REMOVED: DB session handled by service
    request_id: int,
    request_service: RequestService = Depends(deps.get_request_service), # ADDED: Inject RequestService
    current_user: models.AdminUser = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get specific request by ID for admin panel using RequestService.
    Includes Base64 image data if available.
    Requires admin privileges.
    """
    # Call service layer to get the request (handles 404 and Base64 encoding)
    request_obj = await request_service.get_request(request_id=request_id)
    # Service layer returns the Pydantic model directly.
    return request_obj

@router.delete("/{request_id}", response_model=schemas.Request)
async def delete_request(
    *,
    db: AsyncSession = Depends(deps.get_db),
    request_id: int,
    current_user: models.AdminUser = Depends(deps.get_current_active_user),
) -> Any:
    """
    Delete an analysis request and its associated versions.
    Requires admin privileges.
    """
    logger.info(f"Admin user {current_user.username} attempting to delete request ID: {request_id}")
    # Use get_or_404 to ensure request exists before attempting removal
    request_to_delete = await crud.crud_request.get_or_404(db, id=request_id)
    
    # Log deletion to database
    await db_logger.warning(
        db,
        f"Request {request_id} deleted by admin user {current_user.username}",
        extra_data={
            "request_id": request_id,
            "deleted_by": current_user.username,
            "user_id": current_user.id
        }
    )

    # remove method in CRUDBase likely returns the deleted object or None/True/False
    # Assuming it returns the deleted object based on response_model
    deleted_request = await crud.crud_request.remove(db=db, id=request_to_delete.id) # Pass the found ID
    # Note: Cascade delete should handle versions due to relationship setting
    logger.info(f"Request ID: {request_id} deleted successfully.")

    # Broadcast the deletion event via WebSocket
    try:
        await manager.broadcast_request_deleted(request_id)
        logger.info(f"Broadcasted request deletion for ID: {request_id}")
    except Exception as e:
        logger.error(f"Failed to broadcast request deletion for ID {request_id}: {e}", exc_info=True)

    # Return the deleted object data (or a success message)
    return deleted_request # Schema needs to handle this potentially detached object

@router.post("/{request_id}/retry", response_model=schemas.Request)
async def retry_request_analysis(
    *,
    db: AsyncSession = Depends(deps.get_db),
    request_id: int,
    app: FastAPI = Depends(get_app), # Inject app instance
    current_user: models.AdminUser = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retry a failed analysis request.
    Sets status to Queued and adds background task.
    Requires admin privileges.
    """
    logger.info(f"Admin user {current_user.username} attempting to retry request ID: {request_id}")
    # Use get_or_404
    request = await crud.crud_request.get_or_404(db, id=request_id)
    
    # Log retry attempt
    await db_logger.info(
        db,
        f"Request {request_id} retry initiated by admin user {current_user.username}",
        extra_data={
            "request_id": request_id,
            "retried_by": current_user.username,
            "user_id": current_user.id,
            "previous_status": request.status.value
        }
    )

    # Allow retrying only failed requests? Or any non-completed?
    if request.status != schemas.RequestStatus.FAILED:
         logger.warning(f"Attempting to retry request {request_id} which is not in FAILED state (current: {request.status}). Proceeding anyway.")
        # raise HTTPException(
        #     status_code=status.HTTP_400_BAD_REQUEST,
        #     detail="Only failed requests can be retried.",
        # )

    # Update status to Queued
    updated_request = await crud.crud_request.update_status(db, db_obj=request, status=schemas.RequestStatus.QUEUED)

    # Put the request ID into the analysis queue via app.state
    queue = getattr(app.state, 'analysis_queue', None) # Use app.state
    if queue:
        await queue.put(updated_request.id)
        logger.info(f"Request ID {request_id} added to analysis queue for retry.")
        await db_logger.info(
            db,
            f"Request {request_id} queued for retry",
            extra_data={"request_id": request_id}
        )
    else:
        logger.error(f"Analysis queue not available via app.state. Failed to queue request ID {request_id} for retry.")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal error: Task queue unavailable.")

    # Broadcast the update event (status change) via WebSocket
    try:
        # Ensure the data sent is JSON serializable
        request_data = schemas.Request.model_validate(updated_request).model_dump(mode='json')
        await manager.broadcast_request_updated(request_data)
        logger.info(f"Broadcasted request update (retry queued) for ID: {updated_request.id}")
    except Exception as e:
        logger.error(f"Failed to broadcast request update (retry) for ID {updated_request.id}: {e}", exc_info=True)

    # Return the updated request (no need to reload versions)
    return updated_request


@router.post("/batch", response_model=Dict[str, Any])
async def batch_request_action(
    *,
    db: AsyncSession = Depends(deps.get_db),
    action_data: BatchRequestAction = Body(...),
    app: FastAPI = Depends(get_app), # Inject app instance
    current_user: models.AdminUser = Depends(deps.get_current_active_user),
) -> Any:
    """
    Perform batch actions (delete or retry) on multiple requests.
    Requires admin privileges.
    """
    logger.info(f"Admin user {current_user.username} performing batch action '{action_data.action}' on requests: {action_data.request_ids}")
    results = {"success": [], "failed": []}
    processed_count = 0
    
    # Log batch operation start
    await db_logger.info(
        db,
        f"Batch {action_data.action} operation started by {current_user.username}",
        extra_data={
            "action": action_data.action,
            "request_count": len(action_data.request_ids),
            "user_id": current_user.id,
            "request_ids": action_data.request_ids
        }
    )

    if not action_data.request_ids:
        return {"message": "No request IDs provided.", "results": results}

    if action_data.action == "delete":
        for req_id in action_data.request_ids:
            try:
                # Use get_or_404 to check existence before remove
                request_to_delete = await crud.crud_request.get_or_404(db, id=req_id)
                deleted = await crud.crud_request.remove(db=db, id=request_to_delete.id)
                # Assuming remove returns the object or raises if fails internally
                results["success"].append(req_id)
                processed_count += 1
                # Broadcast deletion for this ID
                try:
                    await manager.broadcast_request_deleted(req_id)
                    logger.debug(f"Broadcasted batch request deletion for ID: {req_id}")
                except Exception as broadcast_e:
                    logger.error(f"Failed to broadcast batch request deletion for ID {req_id}: {broadcast_e}", exc_info=True)
            except crud.NotFoundError: # Catch specific NotFoundError from get_or_404
                 results["failed"].append({"id": req_id, "reason": "Not found"})
            except Exception as e: # Catch potential errors during deletion itself
                 logger.error(f"Failed to delete request {req_id} during batch operation: {e}")
                 results["failed"].append({"id": req_id, "reason": f"Deletion failed: {e}"})
        # Consider committing after each successful delete or all at the end
        # Committing at the end is usually better for performance but less atomic per item
        await db.commit()
        message = f"Batch delete attempted. {processed_count} requests deleted."
        
        # Log batch delete completion
        await db_logger.warning(
            db,
            f"Batch delete completed: {processed_count} requests deleted",
            extra_data={
                "deleted_count": processed_count,
                "failed_count": len(results["failed"]),
                "success_ids": results["success"],
                "failed_ids": [f["id"] for f in results["failed"]]
            }
        )

    elif action_data.action == "retry":
        ids_to_process = [] # Collect IDs to process after the loop
        for req_id in action_data.request_ids:
            try:
                # Use get_or_404
                request = await crud.crud_request.get_or_404(db, id=req_id)

                # Allow retrying only failed requests? Or any non-completed?
                # Current logic: only allow FAILED. If allowing others, adjust condition.
                if request.status != schemas.RequestStatus.FAILED:
                     logger.warning(f"Batch retry skipped for request {req_id}: Not in FAILED state (current: {request.status}).")
                     results["failed"].append({"id": req_id, "reason": f"Not in FAILED state (status: {request.status})"})
                     continue # Skip to the next request ID

                # Update status to Queued
                updated_request = await crud.crud_request.update_status(db, db_obj=request, status=schemas.RequestStatus.QUEUED)
                # Don't add background task here yet
                ids_to_process.append(updated_request.id) # Collect the ID
                results["success"].append(req_id)
                processed_count += 1
                # Broadcast update for this ID immediately after status change
                try:
                    request_data = schemas.Request.model_validate(updated_request).model_dump(mode='json')
                    await manager.broadcast_request_updated(request_data)
                    logger.debug(f"Broadcasted batch request update (retry queued) for ID: {updated_request.id}")
                except Exception as broadcast_e:
                    logger.error(f"Failed to broadcast batch request update (retry) for ID {updated_request.id}: {broadcast_e}", exc_info=True)

            except crud.NotFoundError:
                 results["failed"].append({"id": req_id, "reason": "Not found"})
            except Exception as e:
                 logger.error(f"Failed to queue retry for request {req_id} during batch operation: {e}")
                 results["failed"].append({"id": req_id, "reason": f"Retry failed: {e}"})

        # Commit all status changes after the loop
        if processed_count > 0: # Only commit if something was actually updated
             try:
                 await db.commit()
                 logger.info(f"Committed status updates for {processed_count} requests marked for retry.")
             except Exception as commit_e:
                 logger.error(f"Failed to commit status updates during batch retry: {commit_e}")
                 # Handle commit failure - potentially rollback or mark collected IDs as failed?
                 # For now, log the error and don't proceed with adding tasks.
                 # Add failed IDs back to the results?
                 for success_id in results["success"]:
                     results["failed"].append({"id": success_id, "reason": "DB commit failed after status update"})
                 results["success"] = [] # Clear success list as commit failed
                 ids_to_process = [] # Don't process tasks if commit failed
                 processed_count = 0 # Reset count

        # Put request IDs into the queue via app.state *after* the loop and commit
        # Removed inspection logs for request object
        queue = getattr(app.state, 'analysis_queue', None) # Use app.state
        if ids_to_process:
            if queue:
                logger.info(f"Adding {len(ids_to_process)} requests to analysis queue.")
                queued_count = 0
                failed_to_queue_ids = [] # Track IDs that failed queuing
                for process_id in ids_to_process:
                    try:
                        await queue.put(process_id)
                        queued_count += 1
                    except Exception as queue_err:
                         logger.error(f"Failed to add request ID {process_id} to analysis queue: {queue_err}")
                         failed_to_queue_ids.append(process_id)

                # Update results based on queuing failures
                if failed_to_queue_ids:
                    # Remove failed IDs from success list and add to failed list
                    original_success_count = len(results["success"])
                    results["success"] = [sid for sid in results["success"] if sid not in failed_to_queue_ids]
                    for fid in failed_to_queue_ids:
                        results["failed"].append({"id": fid, "reason": f"Failed to add to queue after commit"})
                    logger.warning(f"Removed {len(failed_to_queue_ids)} IDs from success list due to queueing failure.")
                    processed_count = len(results["success"]) # Update processed count based on actual success

                logger.info(f"Successfully added {queued_count} out of {len(ids_to_process)} requests to the analysis queue.")
                message = f"Batch retry attempted. {processed_count} requests successfully updated and {queued_count} added to processing queue."

            else:
                logger.error(f"Analysis queue not available via app.state. Failed to queue {len(ids_to_process)} requests.")
                # Mark all intended successes as failed because queue is down
                for success_id in results["success"]:
                     results["failed"].append({"id": success_id, "reason": "Queue unavailable after commit"})
                results["success"] = []
                processed_count = 0
                message = f"Batch retry failed: Task queue is unavailable."
        else:
             message = f"Batch retry attempted. No requests were eligible or successfully updated for queuing."

    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid batch action specified.")

    logger.info(f"Batch action '{action_data.action}' completed. Success: {len(results['success'])}, Failed: {len(results['failed'])}")
    return {"message": message, "results": results}