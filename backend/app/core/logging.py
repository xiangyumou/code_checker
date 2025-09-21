import logging
from collections.abc import Mapping
from typing import Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.log import LogLevel
from app.services.log_service import log_service, sanitize_log_context


class DatabaseLogger:
    """
    Helper class to log messages to the database.
    """
    
    def __init__(self, source: str):
        self.source = source
        self.logger = logging.getLogger(f"app.{source}")
    
    async def debug(
        self,
        db: AsyncSession,
        message: str,
        *,
        extra_data: Optional[Mapping[str, Any]] = None,
        context: Optional[Mapping[str, Any]] = None,
    ) -> None:
        """Log a debug message with optional structured context."""
        normalized_context = self._prepare_context(extra_data, context)
        await self._log(db, LogLevel.DEBUG, message, normalized_context)
        self._log_to_standard("debug", message, normalized_context)

    async def info(
        self,
        db: AsyncSession,
        message: str,
        *,
        extra_data: Optional[Mapping[str, Any]] = None,
        context: Optional[Mapping[str, Any]] = None,
    ) -> None:
        """Log an info message with optional structured context."""
        normalized_context = self._prepare_context(extra_data, context)
        await self._log(db, LogLevel.INFO, message, normalized_context)
        self._log_to_standard("info", message, normalized_context)

    async def warning(
        self,
        db: AsyncSession,
        message: str,
        *,
        extra_data: Optional[Mapping[str, Any]] = None,
        context: Optional[Mapping[str, Any]] = None,
    ) -> None:
        """Log a warning message with optional structured context."""
        normalized_context = self._prepare_context(extra_data, context)
        await self._log(db, LogLevel.WARNING, message, normalized_context)
        self._log_to_standard("warning", message, normalized_context)

    async def error(
        self,
        db: AsyncSession,
        message: str,
        *,
        extra_data: Optional[Mapping[str, Any]] = None,
        context: Optional[Mapping[str, Any]] = None,
    ) -> None:
        """Log an error message with optional structured context."""
        normalized_context = self._prepare_context(extra_data, context)
        await self._log(db, LogLevel.ERROR, message, normalized_context)
        self._log_to_standard("error", message, normalized_context)

    def _prepare_context(
        self,
        extra_data: Optional[Mapping[str, Any]],
        context: Optional[Mapping[str, Any]],
    ) -> Optional[dict[str, Any]]:
        """Resolve and sanitize context payload for persistence and stdout logging."""
        chosen_context: Optional[Mapping[str, Any]] = context if context is not None else extra_data
        return sanitize_log_context(chosen_context)

    async def _log(
        self,
        db: AsyncSession,
        level: LogLevel,
        message: str,
        context: Optional[dict[str, Any]] = None,
    ) -> None:
        """Internal method to create a log entry."""
        try:
            await log_service.create_log(
                db=db,
                level=level,
                message=message,
                source=self.source,
                context=context,
            )
        except Exception as exc:
            # Fallback to standard logging if database write fails
            fallback_message = (
                f"Failed to write log to database: {exc}. "
                f"Original message: {message}"
            )
            if context:
                fallback_message += f" | context={context}"
            self.logger.error(fallback_message)

    def _log_to_standard(
        self,
        level: str,
        message: str,
        context: Optional[dict[str, Any]],
    ) -> None:
        """Emit the log message to the standard Python logger with safe context handling."""
        log_method = getattr(self.logger, level)

        if not context:
            log_method(message)
            return

        try:
            log_method(message, extra={"context": context})
        except Exception:
            # If the logging configuration can't handle custom extras, append to message instead
            log_method(f"{message} | context={context}")


def get_db_logger(source: str) -> DatabaseLogger:
    """
    Get a database logger instance for a specific source.
    
    Args:
        source: The source identifier (e.g., "api.auth", "services.openai")
    
    Returns:
        DatabaseLogger instance
    """
    return DatabaseLogger(source)