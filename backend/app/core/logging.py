import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.log import LogLevel
from app.services.log_service import log_service


class DatabaseLogger:
    """
    Helper class to log messages to the database.
    """
    
    def __init__(self, source: str):
        self.source = source
        self.logger = logging.getLogger(f"app.{source}")
    
    async def debug(self, db: AsyncSession, message: str):
        """Log a debug message."""
        await self._log(db, LogLevel.DEBUG, message)
        self.logger.debug(message)
    
    async def info(self, db: AsyncSession, message: str):
        """Log an info message."""
        await self._log(db, LogLevel.INFO, message)
        self.logger.info(message)
    
    async def warning(self, db: AsyncSession, message: str):
        """Log a warning message."""
        await self._log(db, LogLevel.WARNING, message)
        self.logger.warning(message)
    
    async def error(self, db: AsyncSession, message: str):
        """Log an error message."""
        await self._log(db, LogLevel.ERROR, message)
        self.logger.error(message)
    
    async def _log(self, db: AsyncSession, level: LogLevel, message: str):
        """Internal method to create a log entry."""
        try:
            await log_service.create_log(
                db=db,
                level=level,
                message=message,
                source=self.source
            )
        except Exception as e:
            # Fallback to standard logging if database write fails
            self.logger.error(f"Failed to write log to database: {e}")


def get_db_logger(source: str) -> DatabaseLogger:
    """
    Get a database logger instance for a specific source.
    
    Args:
        source: The source identifier (e.g., "api.auth", "services.openai")
    
    Returns:
        DatabaseLogger instance
    """
    return DatabaseLogger(source)