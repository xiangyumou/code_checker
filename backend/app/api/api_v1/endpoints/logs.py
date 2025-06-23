import logging
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app import models, schemas
from app.models.log import LogLevel
from app.services.log_service import log_service

logger = logging.getLogger("app." + __name__)
router = APIRouter()


@router.get("/", response_model=schemas.PaginatedLogs)
async def get_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    level: Optional[LogLevel] = Query(None, description="Filter by log level"),
    start_date: Optional[datetime] = Query(None, description="Filter logs from this date"),
    end_date: Optional[datetime] = Query(None, description="Filter logs until this date"),
    search: Optional[str] = Query(None, description="Search in message and source fields"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: models.AdminUser = Depends(deps.get_current_active_user)
) -> schemas.PaginatedLogs:
    """
    Retrieve a paginated, filterable, and searchable list of log entries.
    
    - **skip**: Number of records to skip (for pagination)
    - **limit**: Maximum number of records to return (max: 1000)
    - **level**: Filter by log level (DEBUG, INFO, WARNING, ERROR)
    - **start_date**: Filter logs from this datetime (inclusive)
    - **end_date**: Filter logs until this datetime (inclusive)
    - **search**: Fuzzy search across message and source fields
    """
    result = await log_service.get_logs(
        db,
        skip=skip,
        limit=limit,
        level=level,
        start_date=start_date,
        end_date=end_date,
        search=search
    )
    
    return schemas.PaginatedLogs(**result)


@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
async def clear_all_logs(
    db: AsyncSession = Depends(deps.get_db),
    current_user: models.AdminUser = Depends(deps.get_current_active_user)
) -> None:
    """
    Delete all log entries from the database.
    
    This action cannot be undone. Use with caution.
    """
    await log_service.clear_all_logs(db)
    logger.warning(f"All logs cleared by admin user: {current_user.username}")