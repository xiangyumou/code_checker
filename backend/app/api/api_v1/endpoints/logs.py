import os
import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, Depends
from starlette.responses import PlainTextResponse

# Import settings instance and LOGS_DIR constant separately
from app.core.config import settings as app_settings, LOGS_DIR
from app.api import deps # For admin dependency
from app import models # Import models for type hinting

logger = logging.getLogger("app." + __name__) # Use 'app' namespace
router = APIRouter()

LOG_DIRECTORY = LOGS_DIR # Use the imported constant
ALLOWED_LOG_FILES = ["app.log"] # Define allowed files for security

def get_log_file_path(filename: str) -> str:
    """Validates filename and returns the full path."""
    if filename not in ALLOWED_LOG_FILES:
        raise HTTPException(status_code=404, detail=f"Log file '{filename}' not found or not accessible.")
    path = os.path.join(LOG_DIRECTORY, filename)
    if not os.path.exists(path) or not os.path.isfile(path):
         raise HTTPException(status_code=404, detail=f"Log file '{filename}' not found.")
    return path

@router.get("/", response_model=List[str])
async def list_log_files(
    current_user: models.AdminUser = Depends(deps.get_current_active_user) # Corrected dependency name
) -> List[str]:
    """
    List available log files.
    """
    # For now, just return the allowed list if they exist
    available_files = []
    for filename in ALLOWED_LOG_FILES:
        path = os.path.join(LOG_DIRECTORY, filename)
        if os.path.exists(path) and os.path.isfile(path):
            available_files.append(filename)
    return available_files

@router.get("/{filename}", response_class=PlainTextResponse)
async def get_log_content(
    filename: str,
    tail: Optional[int] = Query(None, description="Return the last N lines of the log file.", ge=1),
    head: Optional[int] = Query(None, description="Return the first N lines of the log file.", ge=1),
    # TODO: Add start_line/end_line support if needed (more complex file reading)
    current_user: models.AdminUser = Depends(deps.get_current_active_user) # Corrected dependency name
) -> str:
    """
    Retrieve the content of a specific log file.
    Supports retrieving the head or tail N lines.
    """
    log_path = get_log_file_path(filename)
    try:
        with open(log_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        if tail:
            content = "".join(lines[-tail:])
        elif head:
            content = "".join(lines[:head])
        else:
            # Return full content if no tail/head specified (might be large!)
            # Consider adding a default limit or requiring tail/head
            content = "".join(lines)
            if len(lines) > 1000: # Add a warning or limit if file is too large
                 logger.warning(f"Returning full log file '{filename}' which has {len(lines)} lines.")
                 # Optionally truncate here or raise an error
                 # content = "".join(lines[-1000:]) # Example: return last 1000 lines only

        return content
    except Exception as e:
        logger.error(f"Error reading log file '{filename}': {e}")
        raise HTTPException(status_code=500, detail=f"Could not read log file: {e}")

# Need to import models for dependency
from app import models