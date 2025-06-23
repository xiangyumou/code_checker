import asyncio
from datetime import datetime
import logging

from app.db.session import AsyncSessionLocal
from app.services.log_service import log_service
from app.core.logging import get_db_logger

logger = logging.getLogger(__name__)
db_logger = get_db_logger("tasks")


async def cleanup_logs_task():
    """
    Background task to cleanup old logs periodically.
    Runs every hour and maintains a maximum of 100,000 log entries.
    """
    while True:
        try:
            async with AsyncSessionLocal() as db:
                deleted_count = await log_service.cleanup_old_logs(db, keep_count=100000)
                if deleted_count > 0:
                    logger.info(f"Cleaned up {deleted_count} old log entries")
                    await db_logger.info(
                        db,
                        f"Log cleanup task removed {deleted_count} old entries",
                        extra_data={"deleted_count": deleted_count}
                    )
        except Exception as e:
            logger.error(f"Error during log cleanup: {e}")
            try:
                async with AsyncSessionLocal() as error_db:
                    await db_logger.error(
                        error_db,
                        f"Log cleanup task failed: {str(e)}",
                        extra_data={"error_type": type(e).__name__}
                    )
            except Exception as log_error:
                logger.error(f"Failed to log error to database: {log_error}")
        
        # Wait for 1 hour before next cleanup
        await asyncio.sleep(3600)


def create_start_app_handler():
    """
    Create a handler to start background tasks when the app starts.
    """
    async def start_app() -> None:
        # Start the log cleanup task
        asyncio.create_task(cleanup_logs_task())
        logger.info("Background tasks started")
        
        # Log to database
        try:
            async with AsyncSessionLocal() as db:
                await db_logger.info(db, "Background tasks started successfully")
        except Exception as e:
            logger.error(f"Failed to log background task start to database: {e}")
    
    return start_app


def create_stop_app_handler():
    """
    Create a handler to stop background tasks when the app stops.
    """
    async def stop_app() -> None:
        # Cancel all running tasks
        tasks = [t for t in asyncio.all_tasks() if t != asyncio.current_task()]
        for task in tasks:
            task.cancel()
        
        await asyncio.gather(*tasks, return_exceptions=True)
        logger.info("Background tasks stopped")
        
        # Log to database
        try:
            async with AsyncSessionLocal() as db:
                await db_logger.info(db, "Background tasks stopped successfully")
        except Exception as e:
            logger.error(f"Failed to log background task stop to database: {e}")
    
    return stop_app