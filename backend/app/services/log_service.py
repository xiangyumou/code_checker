import logging
from typing import Optional
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app import crud
from app.models.log import LogLevel
from app.schemas.log import LogCreate
from app.db.session import get_db


class DatabaseLogHandler(logging.Handler):
    """
    Custom logging handler that writes logs to the database.
    """
    
    def __init__(self):
        super().__init__()
        self._db_session: Optional[AsyncSession] = None
    
    async def async_emit(self, record: logging.LogRecord):
        """
        Asynchronously emit a log record to the database.
        """
        # Map Python logging levels to our LogLevel enum
        level_mapping = {
            logging.DEBUG: LogLevel.DEBUG,
            logging.INFO: LogLevel.INFO,
            logging.WARNING: LogLevel.WARNING,
            logging.ERROR: LogLevel.ERROR,
            logging.CRITICAL: LogLevel.ERROR,  # Map CRITICAL to ERROR
        }
        
        log_level = level_mapping.get(record.levelno, LogLevel.INFO)
        
        # Create log entry
        log_in = LogCreate(
            level=log_level,
            message=self.format(record),
            source=f"{record.name}.{record.funcName}" if record.funcName else record.name
        )
        
        # Get a database session
        async for db in get_db():
            try:
                await crud.log.create(db, obj_in=log_in)
            except Exception as e:
                # Fallback to standard error logging if database write fails
                print(f"Failed to write log to database: {e}")
            finally:
                break
    
    def emit(self, record: logging.LogRecord):
        """
        Override the emit method to handle async operations.
        In a real application, you might want to use a background task queue.
        """
        # For now, we'll skip the actual database write in sync context
        # This should be handled by background tasks or async context
        pass


class LogService:
    """
    Service for managing application logs.
    """
    
    @staticmethod
    async def create_log(
        db: AsyncSession,
        level: LogLevel,
        message: str,
        source: Optional[str] = None
    ):
        """
        Create a new log entry in the database.
        """
        log_in = LogCreate(
            level=level,
            message=message,
            source=source
        )
        return await crud.log.create(db, obj_in=log_in)
    
    @staticmethod
    async def get_logs(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        level: Optional[LogLevel] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        search: Optional[str] = None
    ):
        """
        Get paginated and filtered logs.
        """
        logs = await crud.log.get_multi_filtered(
            db,
            skip=skip,
            limit=limit,
            level=level,
            start_date=start_date,
            end_date=end_date,
            search=search
        )
        
        total = await crud.log.count_filtered(
            db,
            level=level,
            start_date=start_date,
            end_date=end_date,
            search=search
        )
        
        return {"items": logs, "total": total}
    
    @staticmethod
    async def cleanup_old_logs(db: AsyncSession, keep_count: int = 100000):
        """
        Clean up old logs to maintain a maximum number of log entries.
        """
        return await crud.log.cleanup_logs(db, keep_count=keep_count)
    
    @staticmethod
    async def clear_all_logs(db: AsyncSession):
        """
        Delete all logs from the database.
        """
        # Use a direct delete query for efficiency
        from sqlalchemy import delete
        from app.models.log import Log
        
        await db.execute(delete(Log))
        await db.commit()


# Create a singleton instance
log_service = LogService()