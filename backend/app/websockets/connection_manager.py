import logging
import copy # Import the copy module
import datetime # Added for type hinting
from typing import Dict, List, Optional # Import Optional
from fastapi import WebSocket

from app.models.request import RequestStatus # Added for type hinting

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manages active WebSocket connections."""
    def __init__(self):
        # Stores active connections using a client_id as the key
        self.active_connections: Dict[str, WebSocket] = {}
        # TODO: Consider mapping requests/users to client_ids if needed for targeted updates

    async def connect(self, websocket: WebSocket, client_id: str):
        """Accepts a new WebSocket connection."""
        # logger.info(f"Manager attempting to accept connection for {client_id}...") # Remove log
        await websocket.accept()
        # logger.info(f"Manager accepted connection for {client_id}. Storing...") # Remove log
        self.active_connections[client_id] = websocket
        logger.info(f"WebSocket client connected: {client_id}") # Keep original log

    def disconnect(self, client_id: str):
        """Disconnects a WebSocket client."""
        if client_id in self.active_connections:
            # Note: The actual websocket closing should be handled in the endpoint
            # This just removes it from the manager's tracking
            del self.active_connections[client_id]
            logger.info(f"WebSocket client disconnected: {client_id}")

    async def send_personal_message(self, message: dict, client_id: str):
        """Sends a JSON message to a specific client."""
        websocket = self.active_connections.get(client_id)
        if websocket:
            try:
                await websocket.send_json(message)
                logger.debug(f"Sent message to client {client_id}: {message}")
            except Exception as e:
                # Handle potential errors if client disconnected abruptly
                logger.warning(f"Failed to send message to client {client_id}: {e}. Removing connection.")
                self.disconnect(client_id) # Clean up broken connection
        else:
            logger.warning(f"Attempted to send message to disconnected client: {client_id}")

    async def broadcast(self, message: dict):
        """Sends a JSON message to all connected clients."""
        # Create a list of client IDs to iterate over, as the dict might change during iteration
        client_ids = list(self.active_connections.keys())
        # Prepare message for logging, truncating image data if present
        message_for_log = copy.deepcopy(message) # Use deepcopy for safety
        if isinstance(message_for_log.get("payload"), dict) and "images_base64" in message_for_log["payload"]:
            # Check if it's a list and not empty before accessing index 0, or just replace the whole list
            if isinstance(message_for_log["payload"]["images_base64"], list) and message_for_log["payload"]["images_base64"]:
                 message_for_log["payload"]["images_base64"] = ["[图片数据省略]"] * len(message_for_log["payload"]["images_base64"]) # Replace each item if it's a list
            else:
                 message_for_log["payload"]["images_base64"] = "[图片数据省略]" # Or replace if it's not a list (or empty list)

        logger.info(f"Broadcasting message to {len(client_ids)} clients: {message_for_log}")
        for client_id in client_ids:
            await self.send_personal_message(message, client_id)

    async def broadcast_request_created(self, request_data: dict):
        """Broadcasts a new request creation event to all clients."""
        message = {
            "type": "request_created",
            "payload": request_data
        }
        logger.info(f"Broadcasting request creation: ID {request_data.get('id', 'N/A')}")
        await self.broadcast(message)

    async def broadcast_request_updated(
        self,
        request_id: int,
        status: RequestStatus,
        updated_at: datetime.datetime,
        error_message: Optional[str]
    ):
        """Broadcasts a request update event with specific fields."""
        payload = {
            "id": request_id,
            "status": status.value, # Send the string value of the enum
            "updated_at": updated_at.isoformat(), # Send ISO format string
            "error_message": error_message,
        }
        message = {
            "type": "request_updated", # Keep existing key 'type'
            "payload": payload
        }
        logger.info(f"Broadcasting request update: ID {request_id}, Status: {status.value}")
        await self.broadcast(message)

    async def broadcast_request_deleted(self, request_id: int):
        """Broadcasts a request deletion event to all clients."""
        message = {
            "type": "request_deleted", # Keep existing key 'type'
            "payload": {"id": request_id} # Change key to 'id' for consistency
        }
        logger.info(f"Broadcasting request deletion: ID {request_id}")
        await self.broadcast(message)

# Singleton instance of the connection manager
manager = ConnectionManager()