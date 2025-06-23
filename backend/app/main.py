import logging
import logging.config # Added for dictConfig
import os # Added for path joining
import asyncio # Added for Queue and Task
import datetime # Added for datetime usage
from contextlib import asynccontextmanager # Import asynccontextmanager
from typing import Optional # Added for Optional types
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
# Import the default handler
from fastapi.exception_handlers import request_validation_exception_handler
from sqlalchemy.exc import SQLAlchemyError # For general SQLAlchemy errors
from sqlalchemy import select, or_, create_engine # Import select, or_, and create_engine
from sqlalchemy.exc import OperationalError # To catch DB connection errors

# Import necessary components for startup event
from app.db.session import AsyncSessionLocal # Remove init_db import
from app.db.base_class import Base # Import Base for metadata
from app import crud
from app.models.request import RequestStatus
# Import the global WebSocket manager instance
from app.websockets.manager import manager as ws_manager
# Import settings instance and LOGS_DIR constant separately
from app.core.config import settings as app_settings, LOGS_DIR
from app.crud.crud_setting import crud_setting # To get log level from DB
from app.core.exceptions import AppException # Import custom base exception
# Import the semaphore initialization function
from app.services.openai_processor import initialize_analysis_semaphore, process_analysis_request # Import process_analysis_request
# Import background tasks
from app.core.tasks import create_start_app_handler, create_stop_app_handler

# --- Logging Configuration ---

# Default logging config, can be overridden by DB setting
LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            # Consider adding process/thread IDs if needed: %(process)d %(thread)d
            "format": "%(asctime)s - %(name)s:%(lineno)d - %(levelname)s - %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
            "stream": "ext://sys.stdout", # Use stdout for console
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "formatter": "default",
            "filename": os.path.join(LOGS_DIR, "app.log"), # Use imported LOGS_DIR constant
            "maxBytes": 1024 * 1024 * 10,  # 10 MB log file size
            "backupCount": 10, # Keep 10 backup files
            "encoding": "utf-8",
        },
    },
    "loggers": {
        "app": { # Logger for our application ('app' namespace)
            "handlers": ["console"],
            "level": "DEBUG", # Default level, will be updated dynamically
            "propagate": False, # Don't propagate to root logger if handled here
        },
        "uvicorn": { # Configure uvicorn access/error logs
            "handlers": ["console"],
            "level": "INFO", # Default level, will be updated dynamically
            "propagate": True, # Propagate uvicorn logs to root
        },
         "sqlalchemy.engine": { # Optional: Log SQL statements (can be noisy)
            "handlers": ["console"],
            "level": "WARNING", # Set to INFO or DEBUG for SQL logging
            "propagate": False,
        },
    },
    "root": { # Root logger configuration (fallback for other libraries)
        "handlers": ["console"],
        "level": "WARNING", # Default root level
    },
}

# Apply initial config
logging.config.dictConfig(LOGGING_CONFIG)

# Get the logger for this module AFTER config is applied
# Use 'app' namespace for consistency if desired, or __name__
logger = logging.getLogger("app." + __name__) # Use 'app' namespace

# --- Analysis Worker ---
# Removed global queue/task variables
async def analysis_worker(queue: asyncio.Queue): # Accept queue as argument
    """Continuously fetches request IDs from the queue and processes them."""
    # Removed global access and check, queue is passed directly
    logger.info("Analysis worker started.")
    while True:
        try:
            # Wait for a request ID from the passed queue
            request_id = await queue.get()
            logger.info(f"Worker received request ID: {request_id} from queue.")

            try:
                # Process the request using the existing function
                # Note: process_analysis_request handles its own exceptions internally for API calls etc.
                # but we wrap it here in case the function itself raises an unexpected error.
                await process_analysis_request(request_id)
                logger.info(f"Worker finished processing request ID: {request_id}.")
            except Exception as proc_err:
                # Log errors during the processing of a specific request
                logger.exception(f"Worker encountered an error processing request ID {request_id}: {proc_err}", exc_info=proc_err)
                # Continue to the next item without crashing the worker
            finally:
                # Mark the task as done in the passed queue
                queue.task_done()
                logger.debug(f"Worker marked task done for request ID: {request_id}.")

        except asyncio.CancelledError:
            # Handle cancellation gracefully during shutdown
            logger.info("Analysis worker received cancellation request. Exiting.")
            break # Exit the loop
        except Exception as e:
            # Log critical errors in the worker loop itself (e.g., queue errors)
            logger.exception(f"Critical error in analysis worker loop: {e}", exc_info=e)
            # Consider adding a small delay before retrying to prevent tight loops on persistent errors
            await asyncio.sleep(5)

# --- Lifespan Event Handler ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Code to run on startup
    logger.info("Application startup sequence initiated...")
    # await init_db() # REMOVED: We will create tables directly here

    # --- Create Database Tables Directly (Ignoring Alembic) ---
    logger.info("Attempting to create database tables if they don't exist...")
    try:
        # Construct the SYNCHRONOUS database URL using psycopg2
        sync_db_url = f"postgresql+psycopg2://{app_settings.POSTGRES_USER}:{app_settings.POSTGRES_PASSWORD}@{app_settings.POSTGRES_SERVER}/{app_settings.POSTGRES_DB}"
        sync_engine = create_engine(sync_db_url)
        # Create all tables defined in Base metadata
        Base.metadata.create_all(bind=sync_engine)
        logger.info("Database tables checked/created successfully.")
        sync_engine.dispose() # Dispose the sync engine after use
    except OperationalError as db_err:
         logger.error(f"Database connection error during table creation: {db_err}. Please check DB connection details and ensure the database server is running.")
         # Depending on severity, you might want to raise the exception or exit
         # raise db_err
    except Exception as e:
        logger.exception("An unexpected error occurred during database table creation:", exc_info=e)
        # raise e # Optionally re-raise

    # --- Create Upload Directory ---
    # Define the target directory for image uploads.
    # Ideally, this base path comes from configuration (e.g., app_settings.UPLOAD_BASE_PATH)
    # For now, construct it relative to the 'backend' directory.
    # Assuming main.py is in backend/app/
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # Should point to 'backend'
    image_upload_dir = os.path.join(base_dir, "data", "uploads", "images")
    try:
        os.makedirs(image_upload_dir, exist_ok=True)
        logger.info(f"Ensured image upload directory exists: {image_upload_dir}")
    except OSError as e:
        logger.error(f"Could not create image upload directory '{image_upload_dir}': {e}", exc_info=e)
        # Consider if the application should fail to start if the directory cannot be created.
        # For now, we log the error and continue.

    # --- Configure Logging Level Dynamically ---
    log_level_from_db = "INFO" # Default
    try:
        # Ensure LOGS_DIR exists (already done in config.py get_settings, but harmless to repeat)
        os.makedirs(LOGS_DIR, exist_ok=True)
        async with AsyncSessionLocal() as db_log:
            log_level_setting = await crud_setting.get_value_by_key(db_log, key="log_level")
            if log_level_setting and isinstance(log_level_setting, str) and log_level_setting.upper() in ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]:
                log_level_from_db = log_level_setting.upper()
                # Set the logging level based on the value read from the database
                logger.info(f"Setting logging level to {log_level_from_db} based on database setting.")
                logging.getLogger("app").setLevel(log_level_from_db)
                logging.getLogger("uvicorn.access").setLevel(log_level_from_db)
                logging.getLogger("uvicorn.error").setLevel(log_level_from_db)
            else:
                 # Use default INFO level if DB setting is not found or invalid
                 logger.info(f"Using default logging level INFO (DB setting 'log_level' not found or invalid).")
                 # The default level is already set in LOGGING_CONFIG, no need to set it again here unless specifically overriding
                 # If you want to ensure INFO is set even if the initial config was different:
                 # default_level = "INFO"
                 # logging.getLogger("app").setLevel(default_level)
                 # logging.getLogger("uvicorn.access").setLevel(default_level)
                 # logging.getLogger("uvicorn.error").setLevel(default_level)
    except Exception as log_e:
        # Also override error case
        logger.error(f"Error reading log level from database, temporarily overriding to DEBUG: {log_e}")
        debug_level = "DEBUG"
        logging.getLogger("app").setLevel(debug_level) # Ensure default on error
        logging.getLogger("uvicorn.access").setLevel(debug_level)
        logging.getLogger("uvicorn.error").setLevel(debug_level)

    # --- Handle Interrupted Requests ---
    logger.info("Checking for interrupted (Queued or Processing) requests...")
    async with AsyncSessionLocal() as db:
        try:
            # Query for requests in Queued or Processing state
            interrupted_stmt = select(crud.crud_request.model).filter(
                or_(
                    crud.crud_request.model.status == RequestStatus.PROCESSING,
                    crud.crud_request.model.status == RequestStatus.QUEUED
                )
            )
            result = await db.execute(interrupted_stmt)
            interrupted_requests = result.scalars().all()

            if not interrupted_requests:
                logger.info("No requests found in 'Queued' or 'Processing' state.")
            else:
                logger.warning(f"Found {len(interrupted_requests)} requests in 'Queued' or 'Processing' state. Attempting to mark as Failed.")
                updated_count = 0
                for req in interrupted_requests:
                    try:
                        logger.debug(f"Attempting to update request ID: {req.id} from status {req.status.value} to Failed.")
                        await crud.crud_request.update_status(
                            db,
                            db_obj=req,
                            status=RequestStatus.FAILED,
                            error_message="System restarted during processing."
                        )
                        logger.debug(f"Request ID: {req.id} status updated in session (pre-commit).")
                        # Send WebSocket update using the global manager - CORRECTED ARGUMENTS
                        await ws_manager.broadcast_request_updated(
                            request_id=req.id,
                            status=RequestStatus.FAILED,
                            updated_at=req.updated_at if req.updated_at else datetime.datetime.utcnow(),
                            error_message="System restarted during processing."
                        )
                        logger.debug(f"WebSocket update broadcasted for request ID: {req.id}.")
                        updated_count += 1
                    except Exception as update_err:
                        logger.error(f"Failed to update status or broadcast for request ID: {req.id}", exc_info=update_err)

                if updated_count > 0:
                    try:
                        logger.info(f"Attempting to commit changes for {updated_count} requests...")
                        await db.commit()
                        logger.info(f"Successfully committed updates for {updated_count} interrupted requests.")
                    except Exception as commit_err:
                        logger.error("Failed to commit database transaction for interrupted requests.", exc_info=commit_err)
                        await db.rollback() # Rollback on commit failure
                        logger.info("Database transaction rolled back.")
                else:
                    logger.info("No requests were successfully updated in the session, skipping commit.")

        except Exception as e:
            logger.exception("An unexpected error occurred during startup handling of interrupted requests:", exc_info=e)
            try:
                await db.rollback() # Ensure rollback on general error
                logger.info("Database transaction rolled back due to unexpected error.")
            except Exception as rollback_err:
                logger.error("Failed to rollback transaction after unexpected error.", exc_info=rollback_err)

    # --- Initialize OpenAI Processor Semaphore ---
    try:
        # Ensure settings are loaded before accessing
        limit = app_settings.MAX_CONCURRENT_ANALYSIS_TASKS
        initialize_analysis_semaphore(limit)
    except AttributeError:
        logger.error("MAX_CONCURRENT_ANALYSIS_TASKS not found in settings. Semaphore not initialized.")
        # Decide how to handle this: raise error, use default, etc.
        # For now, let's log the error and the processor will handle the None semaphore.
        pass
    except Exception as sem_e:
        logger.exception("Error initializing analysis task semaphore:", exc_info=sem_e)

    # --- Start Analysis Queue and Worker ---
    # Removed global variable assignments
    queue_instance = asyncio.Queue()
    app.state.analysis_queue = queue_instance # Store queue in app.state
    app.state.websocket_manager = ws_manager # Store WebSocket manager in app.state
    logger.info("Analysis queue initialized and stored in app.state.")
    # Determine the number of workers based on the semaphore limit
    num_workers = getattr(app_settings, 'MAX_CONCURRENT_ANALYSIS_TASKS', 1) # Default to 1 if setting is missing
    logger.info(f"Starting {num_workers} analysis worker(s)...")

    worker_tasks_list = []
    for i in range(num_workers):
        # Pass the queue instance directly to each worker
        worker_instance = asyncio.create_task(analysis_worker(queue_instance), name=f"analysis_worker_{i+1}")
        worker_tasks_list.append(worker_instance)

    app.state.worker_tasks = worker_tasks_list # Store the list of worker tasks
    logger.info(f"{len(worker_tasks_list)} analysis worker task(s) created, started, and stored in app.state.")

    # --- Start Background Tasks ---
    start_app_handler = create_start_app_handler()
    await start_app_handler()

    # --- Log application startup to database ---
    try:
        from app.core.logging import get_db_logger
        db_logger = get_db_logger("app.main")
        async with AsyncSessionLocal() as db:
            await db_logger.info(db, "Application started successfully")
    except Exception as e:
        logger.error(f"Failed to log startup to database: {e}")

    logger.info("Application startup sequence finished.")
    yield
    # Code to run on shutdown
    logger.info("Application shutdown sequence initiated...")

    # --- Graceful Shutdown of Worker ---
    # Retrieve queue and worker from app.state
    queue_to_shutdown = getattr(app.state, 'analysis_queue', None)
    workers_to_shutdown = getattr(app.state, 'worker_tasks', []) # Get the list of workers

    if workers_to_shutdown and queue_to_shutdown:
        logger.info(f"Attempting graceful shutdown of {len(workers_to_shutdown)} analysis worker(s)...")
        # 1. Wait for all items in the queue to be processed
        try:
            # Set a timeout for waiting on the queue join, e.g., 30 seconds
            await asyncio.wait_for(queue_to_shutdown.join(), timeout=30.0)
            logger.info("Analysis queue successfully joined (all tasks processed).")
        except asyncio.TimeoutError:
            logger.warning("Timeout waiting for analysis queue to join. Some tasks might be unfinished.")
        except Exception as join_err:
            logger.error(f"Error joining analysis queue: {join_err}", exc_info=join_err)

        # 2. Cancel all worker tasks
        logger.info("Cancelling all analysis worker tasks...")
        for worker_task in workers_to_shutdown:
            worker_task.cancel()

        # 3. Wait for all worker tasks to finish cancellation
        # Use asyncio.gather to wait for all tasks concurrently
        results = await asyncio.gather(*workers_to_shutdown, return_exceptions=True)
        logger.info("Finished waiting for worker tasks cancellation.")
        for i, result in enumerate(results):
             if isinstance(result, asyncio.CancelledError):
                 logger.info(f"Worker task {i+1} cancellation confirmed.")
             elif isinstance(result, Exception):
                 logger.error(f"Error during worker task {i+1} cancellation: {result}", exc_info=result)
             else:
                 logger.warning(f"Worker task {i+1} finished unexpectedly without CancelledError: {result}")

    else:
        logger.warning("Analysis queue or worker tasks list not found during shutdown.")

    # --- Stop Background Tasks ---
    stop_app_handler = create_stop_app_handler()
    await stop_app_handler()
    
    # --- Log application shutdown to database ---
    try:
        async with AsyncSessionLocal() as db:
            await db_logger.info(db, "Application shutdown completed")
    except Exception as e:
        logger.error(f"Failed to log shutdown to database: {e}")

    # Add other cleanup code here if needed
    logger.info("Application shutdown sequence finished.")


# --- FastAPI App Initialization ---
app = FastAPI(
    title="Code Checker API",
    version="0.1.0",
    lifespan=lifespan, # Use the lifespan context manager
    # Add exception handlers here
    # Let FastAPI handle RequestValidationError automatically
    exception_handlers={
        # SettingValueError: setting_value_error_handler, # REMOVED handler for custom exception
        AppException: lambda request, exc: JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=getattr(exc, "headers", None), # Include headers if present (e.g., WWW-Authenticate)
        ),
        # Use the default FastAPI handler for validation errors
        RequestValidationError: request_validation_exception_handler,
         SQLAlchemyError: lambda request, exc: JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": f"Database Error: {exc}"}, # Log specific error, return generic message
        ),
        # Generic fallback handler for unexpected errors
        Exception: lambda request, exc: JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": f"An unexpected internal server error occurred: {type(exc).__name__}"},
        ),
    }
)

# --- Global Exception Handler Middleware (Alternative/Additional Logging) ---
# You can also use middleware for more complex logging or handling before the response is sent
@app.middleware("http")
async def log_exceptions_middleware(request: Request, call_next):
    try:
        response = await call_next(request)
        return response
    except Exception as exc:
        # Log the full exception details here
        logger.exception(f"Unhandled exception during request to {request.url.path}", exc_info=exc)

        # Re-raise the exception to be handled by FastAPI's exception handlers defined above
        # Or, if you want to return a generic response directly from middleware:
        # return JSONResponse(
        #     status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        #     content={"detail": "An unexpected internal server error occurred."},
        # )
        raise exc # Let FastAPI handlers manage the response

# --- API Routers ---
# Import and include the main API router
from app.api.api_v1.api import api_router
app.include_router(api_router, prefix=app_settings.API_V1_STR)

# Import and include the WebSocket router
from app.websockets.endpoints import router as ws_router
app.include_router(ws_router)

# --- Middleware ---
# Placeholder for initialization check middleware
# TODO: Implement initialization check middleware if strict enforcement is needed
# from .core.middleware import check_initialization
# app.middleware("http")(check_initialization)

# --- Event Handlers (Removed - Logic moved to lifespan) ---

@app.get("/")
async def read_root():
    return {"message": "Welcome to Code Checker API"}

# --- Main Execution Guard ---
if __name__ == "__main__":
    import uvicorn
    # Logging is configured via dictConfig above, no need for basicConfig here.
    logger.info("Starting Uvicorn server for local development...")
    # Use reload=True for development, but be cautious in production
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True, log_config=LOGGING_CONFIG)