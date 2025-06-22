import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession # If DB access is needed in WS

from app.websockets.connection_manager import manager
# from app.api import deps # If authentication or DB session is needed

logger = logging.getLogger(__name__)

router = APIRouter()

@router.websocket("/ws/status/{client_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    client_id: str,
    # db: AsyncSession = Depends(deps.get_db) # Example: If DB needed
):
    """
    WebSocket endpoint for status updates.
    Clients connect with a unique client_id.
    The server broadcasts status updates to all connected clients.
    """
    # logger.info(f"WebSocket connection attempt received for client_id: {client_id}") # Remove log
    await manager.connect(websocket, client_id)
    # logger.info(f"WebSocket manager.connect completed for client_id: {client_id}") # Remove log
    try:
        # logger.info(f"WebSocket connection for {client_id} entering receive loop.") # Remove log
        # Optional: Send initial state or confirmation message upon connection
        # await manager.send_personal_message({"message": "Connected"}, client_id)

        # Keep the connection alive and listen for potential client messages (optional)
        while True:
            # You might not need to receive data if it's just for server->client push
            # data = await websocket.receive_text()
            # logger.debug(f"Received message from {client_id}: {data}")
            # await manager.send_personal_message(f"You wrote: {data}", client_id)

            # Keep connection open without active listening if only broadcasting
            await websocket.receive_text() # This will raise WebSocketDisconnect if client closes

    except WebSocketDisconnect:
        manager.disconnect(client_id)
        logger.info(f"WebSocket client {client_id} disconnected gracefully.")
    except Exception as e:
        # Log unexpected errors
        logger.error(f"WebSocket error for client {client_id}: {e}", exc_info=True)
        manager.disconnect(client_id) # Ensure cleanup on error
        # Optionally try to close the websocket gracefully
        try:
            await websocket.close(code=1011) # Internal Error
        except Exception:
            pass # Ignore errors during close after another error

# Note: The actual sending of status updates will happen from within the
# background task (process_analysis_request) by calling manager.update_request_status()
# after each significant status change (Processing, Completed, Failed).