import json
import logging
import asyncio
from asyncio import Task, CancelledError
from typing import Dict, Any, Optional, List, Tuple
import os
from pathlib import Path
import base64
import mimetypes
import aiofiles # Import aiofiles for async file operations

import openai
from openai import AsyncOpenAI, APIConnectionError, RateLimitError, APIStatusError, InternalServerError, APITimeoutError
from sqlalchemy.ext.asyncio import AsyncSession

# Import core settings for initial semaphore setup
from app.core.config import settings as core_settings
from app.models.request import Request, RequestStatus
from app.db.session import AsyncSessionLocal
from app import crud, schemas # Import schemas
from app.crud.crud_setting import crud_setting # To fetch settings
# Import the global WebSocket manager instance
from app.websockets.connection_manager import manager as ws_manager # Correct import path

logger = logging.getLogger("app." + __name__)

# --- Analysis Task Concurrency Control ---
# Semaphore to limit concurrent analysis tasks. Initialized during app startup.
analysis_task_semaphore: Optional[asyncio.Semaphore] = None
_analysis_task_limit: int = 1 # Internal tracking of the limit

def initialize_analysis_semaphore(limit: int):
    """Initializes the analysis task semaphore during application startup."""
    global analysis_task_semaphore, _analysis_task_limit
    if not isinstance(limit, int) or limit < 1:
        logger.warning(f"Invalid analysis task limit ({limit}) provided during initialization, defaulting to 1.")
        limit = 1
    _analysis_task_limit = limit
    analysis_task_semaphore = asyncio.Semaphore(limit)
    logger.info(f"Analysis task concurrency semaphore initialized with limit: {limit}")

# Function to get the current limit (might be useful for logging in process_analysis_request)
def get_analysis_task_limit() -> int:
    return _analysis_task_limit
class OpenAIProcessor:
    """
    Handles interaction with the OpenAI API for code analysis.
    """
    def __init__(self, client: Optional[AsyncOpenAI] = None):
        """
        Initializes the processor. Optionally accepts an existing AsyncOpenAI client
        (useful for testing with mocks). If no client is provided, it will be
        created on demand when needed.
        """
        self._client_instance: Optional[AsyncOpenAI] = client
        self._client_lock = asyncio.Lock() # Lock for lazy initialization

    async def _get_client(self, api_key: str, base_url: Optional[str]) -> AsyncOpenAI:
        """
        Lazily initializes and returns the AsyncOpenAI client instance,
        or returns the injected client if provided.
        Configures the client with the provided key and base_url for the current request.
        """
        if self._client_instance:
            # If a client was injected (e.g., during testing), configure and return it
            # Note: This assumes the injected client allows re-configuration per request.
            # If a client was injected, we assume it's pre-configured or a mock.
            # Re-configuring it here might not be intended or possible.
            # For non-injected clients, we create a new one below with current settings.
            # If re-configuration of injected clients is needed, the logic here needs review.
            logger.warning("Returning potentially pre-configured injected client without applying current request's API key/base URL.")
            return self._client_instance

        # Lazy initialization with lock for the shared instance
        # Note: Creating a new client per request might be safer if settings change frequently.
        async with self._client_lock:
            # Always create/recreate the client with current settings for this request
            # This avoids issues if settings change between requests using the same processor instance.
            # If performance is critical, consider a pool of clients or more complex management.
            logger.info(f"Initializing AsyncOpenAI client for request with base_url: {base_url}")
            # Pass api_key and base_url directly to the constructor
            self._client_instance = AsyncOpenAI(
                api_key=api_key,
                base_url=base_url # base_url can be None, AsyncOpenAI handles it
            )
            return self._client_instance

    async def _build_messages(self, request: Request, system_prompt_content: str) -> List[Dict[str, Any]]: # Make method async
        """
        Builds the message list for the OpenAI API call.
        Accepts the system prompt content dynamically.
        """
        # This method now needs to be async because it uses await for file reading
        # Removed logger.info that logged images_base64 content
        user_content = []

        # Use only user prompt for the text part
        text_prompt = f"User Prompt:\n{request.user_prompt or 'Not provided.'}"
        user_content.append({"type": "text", "text": text_prompt})

        # Add images if present, loading from local file system based on references
        # Define the base directory for uploads relative to the container's /app directory
        # This assumes the 'data' directory is at the root level alongside 'app' inside the container
        # Adjust if your project structure or volume mounts differ.
        BASE_DATA_DIR = Path("/app/data") # Corresponds to ./data mount in docker-compose

        logger.info(f"Request ID {request.id}: Checking image_references. Type: {type(request.image_references)}")
        if isinstance(request.image_references, list) and request.image_references:
            logger.info(f"Request ID {request.id}: Found {len(request.image_references)} image references.")
            for i, image_ref in enumerate(request.image_references):
                if not isinstance(image_ref, str):
                    logger.warning(f"Request ID {request.id}: Skipping non-string image reference at index {i}: {image_ref}")
                    continue

                try:
                    # Construct absolute path within the container
                    absolute_path = BASE_DATA_DIR / image_ref
                    logger.debug(f"Request ID {request.id}: Attempting to load image from {absolute_path}")

                    if not absolute_path.is_file():
                        logger.error(f"Request ID {request.id}: Image file not found at path: {absolute_path}")
                        continue # Skip this image

                    # Read image binary data asynchronously
                    async with aiofiles.open(absolute_path, mode='rb') as f:
                        image_data = await f.read()
                    # image_data = absolute_path.read_bytes() # Replaced with async read

                    # Guess MIME type from filename
                    mime_type, _ = mimetypes.guess_type(absolute_path)
                    if not mime_type:
                        mime_type = "image/png" # Default if type cannot be guessed
                        logger.warning(f"Request ID {request.id}: Could not guess MIME type for {absolute_path}, defaulting to {mime_type}")

                    # Encode binary data to Base64 string
                    b64_encoded_data = base64.b64encode(image_data).decode('utf-8')

                    # Format as Base64 Data URI
                    data_uri = f"data:{mime_type};base64,{b64_encoded_data}"

                    # Append to user content for OpenAI API
                    image_content_part = {
                        "type": "image_url",
                        "image_url": {"url": data_uri, "detail": "high"}
                    }
                    user_content.append(image_content_part)
                    logger.info(f"Request ID {request.id}: Successfully processed and added image {i+1} ({absolute_path}) to messages.")

                except FileNotFoundError:
                     logger.error(f"Request ID {request.id}: Image file not found error for path: {absolute_path}")
                except IOError as e:
                     logger.error(f"Request ID {request.id}: IO error reading image file {absolute_path}: {e}")
                except Exception as e:
                     logger.exception(f"Request ID {request.id}: Unexpected error processing image reference {image_ref} (path: {absolute_path}): {e}")

        elif request.image_references:
             logger.warning(f"Request ID {request.id}: image_references is not a list or is empty. Value: {request.image_references}")
        else:
             logger.info(f"Request ID {request.id}: No image references found.")

        messages = [
            {"role": "system", "content": system_prompt_content}, # Use dynamic system prompt
            {"role": "user", "content": user_content}
        ]
        # Removed logger.debug for final user content
        return messages

    async def analyze_code(
        self,
        request: Request,
        db_settings: Dict[str, Any]
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], Optional[Exception]]:
        """
        Calls the OpenAI API using dynamically loaded settings.

        Args:
            request: The analysis request object.
            db_settings: A dictionary containing settings loaded from the database.

        Returns:
            A tuple: (parsed_json_response, raw_response_text, exception_occurred)
            Returns (None, raw_text, None) if JSON parsing fails but API call succeeded.
            Returns (None, None, exception) if API call fails.
        """
        # Extract settings with defaults
        api_key = db_settings.get("openai_api_key")
        base_url = db_settings.get("openai_base_url") # Can be None
        model = db_settings.get("openai_model") # No default here, must be set
        timeout_str = db_settings.get("request_timeout_seconds", "180") # Default timeout as string
        system_prompt = db_settings.get("system_prompt") # Get prompt from DB settings
        # The logger.info for model is already inserted correctly above this block
        if not system_prompt:
            # Handle missing system prompt - log error and raise exception
            # Consider raising a specific custom exception if needed
            logger.error("System prompt setting ('system_prompt') is missing or empty in the database.")
            raise ValueError("System prompt is not configured in settings.") # Or use a more specific exception

        # Validate required settings
        if not api_key:
            msg = f"OpenAI API Key not found in settings for request ID: {request.id}. Aborting analysis."
            logger.error(msg)
            return None, None, ValueError(msg)
        if not model:
            msg = f"OpenAI Model not found in settings for request ID: {request.id}. Aborting analysis."
            logger.error(msg)
            return None, None, ValueError(msg)

        # Validate and convert timeout
        try:
            timeout = float(timeout_str)
            if timeout <= 0:
                raise ValueError("Timeout must be positive")
        except (ValueError, TypeError):
            logger.warning(f"Invalid REQUEST_TIMEOUT_SECONDS ('{timeout_str}') in settings, using default 180s.")
            timeout = 180.0

        messages = await self._build_messages(request, system_prompt) # Await the async method call
        raw_response_text = None
        parsed_json = None
        exception_occurred = None

        try:
            # Get or initialize the client with current settings (This line was duplicated, keeping one)
            client = await self._get_client(api_key=api_key, base_url=base_url)

            # --- Start of inserted block with correct indentation ---
            # Removed logger.debug for messages being sent
            # logger.info call was duplicated, keeping the original one below
            # --- End of inserted block ---

            # Original logger.info call
            logger.info(f"Calling OpenAI API for request ID: {request.id} with model: {model}")
            # --- Add detailed logging for messages ---
            try:
                # Attempt to log a summary without excessively long base64 strings
                messages_summary = []
                for msg in messages:
                    if msg['role'] == 'user' and isinstance(msg['content'], list):
                        content_summary = []
                        for part in msg['content']:
                            if part['type'] == 'image_url':
                                # Log image presence but truncate base64
                                content_summary.append({"type": "image_url", "image_url": {"url": part['image_url']['url'][:50] + "...", "detail": part['image_url']['detail']}})
                            else:
                                content_summary.append(part)
                        messages_summary.append({'role': msg['role'], 'content': content_summary})
                    else:
                        messages_summary.append(msg)
                logger.debug(f"Messages being sent to OpenAI for request ID {request.id}: {json.dumps(messages_summary, indent=2)}")
            except Exception as log_e:
                logger.error(f"Error creating summary for logging messages for request ID {request.id}: {log_e}")
                logger.info(f"Messages structure type for request ID {request.id}: {type(messages)}") # Log type as fallback
            # --- End detailed logging ---
            completion = await client.chat.completions.create(
                model=model,
                messages=messages,
                # api_key and base_url are now set on the client instance by _get_client
                timeout=timeout, # Pass timeout per request
                response_format={"type": "json_object"},
                # temperature=0.2,
            )

            if completion.choices and completion.choices[0].message and completion.choices[0].message.content:
                raw_response_text = completion.choices[0].message.content
                logger.info(f"Received raw response for request ID: {request.id}")
                # Attempt to parse the JSON response
                try:
                    parsed_json = json.loads(raw_response_text)
                    # TODO: Add validation against a Pydantic schema representing the expected JSON structure
                    logger.info(f"Successfully parsed JSON response for request ID: {request.id}")
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse JSON response for request ID {request.id}: {e}\nRaw response snippet: {raw_response_text[:500]}...")
                    # Keep raw_response_text, but parsed_json remains None
            else:
                logger.warning(f"OpenAI response content is empty for request ID: {request.id}")
                error_message = "OpenAI response content is empty."
                exception_occurred = ValueError(error_message) # Treat as an error

        except APIConnectionError as e:
            logger.error(f"OpenAI API connection error for request ID {request.id}: {e}")
            exception_occurred = e
        except RateLimitError as e:
            logger.error(f"OpenAI API rate limit exceeded for request ID {request.id}: {e}")
            exception_occurred = e
        except APITimeoutError as e:
             logger.error(f"OpenAI API timeout error for request ID {request.id}: {e}")
             exception_occurred = e
        except APIStatusError as e:
            logger.error(f"OpenAI API status error for request ID {request.id}: status={e.status_code}, response={e.response}")
            exception_occurred = e
        except Exception as e:
            logger.exception(f"An unexpected error occurred during OpenAI API call for request ID {request.id}: {e}")
            exception_occurred = e

        return parsed_json, raw_response_text, exception_occurred

# Instance for potential direct use or dependency injection
# Now initialized without a client, client will be created lazily.
openai_processor = OpenAIProcessor()


# --- Background Task ---

async def process_analysis_request(request_id: int):
    """
    Background task to process a single analysis request using parallel OpenAI calls.
    Fetches request, loads settings, manages parallel API calls, updates DB.
    """
    # Acquire the semaphore limiting concurrent analysis tasks
    logger.info(f"Background task function entered for request ID: {request_id}. Attempting to acquire semaphore...")
    if analysis_task_semaphore is None:
        # This should not happen if initialization is done correctly at startup
        logger.error(f"Analysis task semaphore not initialized for request ID: {request_id}. Skipping task.")
        # Optionally mark request as failed here
        return
    async with analysis_task_semaphore:
        logger.info(f"Starting processing for request ID: {request_id}. Acquired analysis task semaphore.")
        async with AsyncSessionLocal() as db:
            request: Optional[Request] = None # Define request outside try block for use in finally/except
            active_tasks: Dict[int, Task] = {} # Store active asyncio tasks {attempt_number: Task}
            first_valid_result: Optional[Dict[str, Any]] = None
            final_raw_response: Optional[str] = None
            final_error_message: Optional[str] = None
            total_attempts_made = 0
            # parallel_requests and total_attempts_limit will be assigned after fetching settings

            try:
                # 1. Fetch the request data
                request = await crud.crud_request.get_or_404(db, id=request_id)
                if not request: # Should be handled by get_or_404, but double-check
                    logger.error(f"Request ID {request_id} not found for processing.")
                    return
                if request.status not in [RequestStatus.QUEUED, RequestStatus.FAILED]:
                    logger.warning(f"Request ID {request_id} is not in Queued or Failed status (current: {request.status}). Skipping processing.")
                    return

                # 2. Load dynamic settings from DB
                db_settings = await crud_setting.get_all_settings_as_dict(db)
                # Removed diagnostic log for db_settings
                # Removed diagnostic log for db_settings

                # Validate and get parallel processing settings with defaults
                try:
                    # Directly assign in try block
                    parallel_requests = int(db_settings.get("parallel_openai_requests_per_prompt", '1')) # Use string default for consistency
                    if parallel_requests < 1:
                        logger.warning(f"Parsed parallel_requests ({parallel_requests}) is less than 1, setting to 1.")
                        parallel_requests = 1
                except (ValueError, TypeError):
                    logger.warning(f"Invalid parallel_openai_requests_per_prompt setting ('{db_settings.get('parallel_openai_requests_per_prompt')}') in DB, using default 1.")
                    # Explicitly assign default in except block
                    parallel_requests = 1
                try:
                    # Directly assign in try block
                    total_attempts_limit = int(db_settings.get("max_total_openai_attempts_per_prompt", '3')) # Use string default for consistency
                    if total_attempts_limit < 1:
                        logger.warning(f"Parsed total_attempts_limit ({total_attempts_limit}) is less than 1, setting to 1.")
                        total_attempts_limit = 1
                except (ValueError, TypeError):
                    logger.warning(f"Invalid max_total_openai_attempts_per_prompt setting ('{db_settings.get('max_total_openai_attempts_per_prompt')}') in DB, using default 3.")
                    # Explicitly assign default in except block
                    total_attempts_limit = 3

                # Store parsed values immediately to avoid potential async state issues
                final_parallel_requests = parallel_requests
                final_total_attempts_limit = total_attempts_limit
                logger.info(f"Request ID {request_id}: Stored final settings: parallel={final_parallel_requests}, attempts={final_total_attempts_limit}") # Log stored values

                # Ensure total attempts is at least parallel requests
                if total_attempts_limit < parallel_requests:
                    logger.warning(f"Total attempts limit ({total_attempts_limit}) is less than parallel requests ({parallel_requests}). Setting total attempts to {parallel_requests}.")
                    total_attempts_limit = parallel_requests

                # Log the task concurrency limit setting from DB for info
                active_limit = get_analysis_task_limit() # Get limit set at startup
                try:
                    db_task_concurrency = int(db_settings.get("max_concurrent_analysis_tasks", active_limit))
                    if db_task_concurrency != active_limit:
                         logger.info(f"DB max_concurrent_analysis_tasks ({db_task_concurrency}) differs from active semaphore limit ({active_limit}). Active limit requires app restart to change.")
                    else:
                         logger.info(f"DB max_concurrent_analysis_tasks matches active semaphore limit ({active_limit}).")
                except (ValueError, TypeError):
                     logger.warning(f"Invalid max_concurrent_analysis_tasks setting in DB, active limit is {active_limit}.")


                # 3. Update status to Processing
                await db.refresh(request) # Refresh before status check/update
                if request.status not in [RequestStatus.QUEUED, RequestStatus.FAILED]:
                     logger.warning(f"Request ID {request_id} status changed before processing could start (current: {request.status}). Skipping.")
                     return
                # Update status and refresh the object to get the latest state for broadcasting
                updated_request_processing = await crud.crud_request.update_status(db, db_obj=request, status=RequestStatus.PROCESSING)
                await db.refresh(updated_request_processing) # Refresh to ensure all fields are current

                # Broadcast the update event (status change) via WebSocket
                try:
                    # Pass individual fields to the updated broadcast method
                    await ws_manager.broadcast_request_updated(
                        request_id=updated_request_processing.id,
                        status=updated_request_processing.status,
                        updated_at=updated_request_processing.updated_at,
                        error_message=updated_request_processing.error_message
                    )
                    logger.info(f"Request ID {request_id} status updated to PROCESSING and broadcasted.")
                except Exception as e:
                    logger.error(f"Failed to broadcast request update (PROCESSING) for ID {request_id}: {e}", exc_info=True)

                # 4. Manage Parallel OpenAI API Calls

                # 4. Manage Parallel OpenAI API Calls
                # Use the stored final values in the loop condition
                while total_attempts_made < final_total_attempts_limit and first_valid_result is None:
                    # Launch new tasks if below parallel limit and total limit
                    # Use the stored final values for loop conditions
                    while len(active_tasks) < final_parallel_requests and total_attempts_made < final_total_attempts_limit:
                        total_attempts_made += 1
                        attempt_num = total_attempts_made # Use 1-based index for logging
                        # Use the stored final values in the loop and logging
                        logger.info(f"Request ID {request_id}: Launching attempt {attempt_num}/{final_total_attempts_limit} (Parallelism: {len(active_tasks)+1}/{final_parallel_requests})")
                        # Create the task for this attempt
                        task = asyncio.create_task(
                            openai_processor.analyze_code(request, db_settings),
                            name=f"analyze_code_req{request_id}_attempt{attempt_num}"
                        )
                        active_tasks[attempt_num] = task

                    if not active_tasks: # Should not happen if loop condition is met, but safety check
                         logger.warning(f"Request ID {request_id}: No active tasks to wait for, breaking loop.")
                         break

                    # Wait for at least one task to complete
                    logger.debug(f"Request ID {request_id}: Waiting for one of {len(active_tasks)} active tasks to complete.")
                    done, pending = await asyncio.wait(active_tasks.values(), return_when=asyncio.FIRST_COMPLETED)
                    logger.debug(f"Request ID {request_id}: {len(done)} task(s) completed.")

                    # Process completed tasks
                    for task in done:
                        # Find the attempt number associated with this task
                        attempt_num = -1
                        for num, t in active_tasks.items():
                            if t == task:
                                attempt_num = num
                                break
                        if attempt_num == -1:
                             logger.error(f"Request ID {request_id}: Completed task not found in active_tasks mapping!")
                             continue # Should not happen

                        del active_tasks[attempt_num] # Remove from active tasks

                        try:
                            parsed_json, raw_response, exception_occurred = task.result()
                            # final_raw_response = raw_response # REMOVED: We store the parsed dict directly

                            if parsed_json is not None:
                                # SUCCESS: Valid JSON received
                                logger.info(f"Request ID {request_id}: Attempt {attempt_num} SUCCEEDED with valid JSON. Storing raw dictionary.")

                                # --- REMOVED: Newline normalization logic ---

                                first_valid_result = parsed_json # Store the successfully parsed dictionary
                                final_error_message = None
                                # logger.info(f"Request ID {request_id}: Attempt {attempt_num} SUCCEEDED with valid JSON.") # Original log moved up
                                # Cancel pending tasks
                                if pending:
                                    logger.info(f"Request ID {request_id}: Cancelling {len(pending)} pending tasks.")
                                    for p_task in pending:
                                        p_task.cancel()
                                    # Optionally await cancellation, though not strictly necessary here
                                    # await asyncio.gather(*pending, return_exceptions=True)
                                break # Exit the main while loop

                            elif exception_occurred is None:
                                # FAILURE: API call OK, but invalid JSON
                                final_error_message = "Failed to parse valid JSON response from OpenAI."
                                logger.error(f"Request ID {request_id}: Attempt {attempt_num} FAILED (Invalid JSON). Raw response snippet: {raw_response[:100] if raw_response else 'N/A'}...")
                                # Continue loop to potentially launch replacement task

                            else:
                                # FAILURE: API call itself failed
                                final_error_message = f"API call failed: {type(exception_occurred).__name__}"
                                logger.error(f"Request ID {request_id}: Attempt {attempt_num} FAILED (API Error: {exception_occurred}).")
                                # Continue loop to potentially launch replacement task

                        except CancelledError:
                             logger.info(f"Request ID {request_id}: Task for attempt {attempt_num} was cancelled.")
                             # If this task was cancelled because another succeeded, first_valid_result should be set
                        except Exception as e:
                             logger.exception(f"Request ID {request_id}: Unexpected error getting result for attempt {attempt_num}: {e}")
                             final_error_message = f"Internal error processing attempt {attempt_num}: {type(e).__name__}"
                             # Continue loop to potentially launch replacement task

                    if first_valid_result is not None:
                        break # Exit while loop if success condition met

                # End of while loop

                # 5. Determine Final Status and Update DB
                if first_valid_result is not None:
                    final_status = RequestStatus.COMPLETED
                    is_success = True
                    final_error_message = None # Clear any previous error
                    logger.info(f"Request ID {request_id}: Processing COMPLETED successfully.")
                else:
                    final_status = RequestStatus.FAILED
                    is_success = False
                    if not final_error_message: # If no specific error was captured, set a generic one
                         final_error_message = f"Failed to get valid JSON response after {final_total_attempts_limit} attempts."
                    logger.error(f"Request ID {request_id}: Processing FAILED. Reason: {final_error_message}")

                update_data = {
                    "status": final_status,
                    "error_message": final_error_message,
                    "gpt_raw_response": first_valid_result, # Store the parsed dictionary directly into JSONB
                    "is_success": is_success,
                }
                await crud.crud_request.update(db, db_obj=request, obj_in=update_data)
                logger.info(f"Updated Request ID: {request.id} in DB. Final status: {final_status}")

                # Refresh the request object after the final update to get complete data
                await db.refresh(request)

                # Send final WebSocket update using broadcast_request_updated
                try:
                    # Pass individual fields to the updated broadcast method
                    await ws_manager.broadcast_request_updated(
                        request_id=request.id,
                        status=request.status, # Use the final status from the refreshed request object
                        updated_at=request.updated_at, # Use the final timestamp
                        error_message=request.error_message # Use the final error message
                    )
                    logger.info(f"Broadcasted final request update for ID: {request.id}, Status: {final_status}")
                except Exception as e:
                    logger.error(f"Failed to broadcast final request update for ID {request.id}: {e}", exc_info=True)

            except Exception as e:
                logger.exception(f"Critical error during background processing task for request ID {request_id}: {e}")
                # Attempt to mark the request as Failed if it exists
                try:
                    if request and db.is_active:
                        # Ensure request state is current before potentially updating
                        await db.refresh(request)
                        if request.status == RequestStatus.PROCESSING: # Only update if it was processing
                             fail_msg = f"Critical background processing error: {type(e).__name__}"
                             await crud.crud_request.update_status(
                                 db,
                                 db_obj=request,
                                 status=RequestStatus.FAILED,
                                 error_message=fail_msg
                             )
                             await db.commit() # Commit the failure status
                             logger.info(f"Marked request {request_id} as Failed due to critical task error.")
                             # Refresh the request object after the failure update
                             await db.refresh(request)
                             # Broadcast the failure update
                             try:
                                 # Pass individual fields to the updated broadcast method
                                 await ws_manager.broadcast_request_updated(
                                     request_id=request.id,
                                     status=request.status, # Should be FAILED
                                     updated_at=request.updated_at,
                                     error_message=request.error_message
                                 )
                                 logger.info(f"Broadcasted request update (FAILED due to critical error) for ID: {request_id}")
                             except Exception as broadcast_e:
                                 logger.error(f"Failed to broadcast request failure update for ID {request_id} after critical error: {broadcast_e}", exc_info=True)
                        else:
                             logger.warning(f"Request {request_id} was not in PROCESSING state ({request.status}) during critical error handling.")
                    else:
                         logger.error(f"Could not mark request {request_id} as failed after critical error (request object unavailable or session closed).")
                except Exception as db_e:
                    logger.error(f"Failed to update request status to Failed after critical error for request ID {request_id}: {db_e}")
            finally:
                 # Ensure any remaining tasks are cancelled if the main loop exits unexpectedly
                 if active_tasks:
                     logger.warning(f"Request ID {request_id}: Cleaning up {len(active_tasks)} tasks due to unexpected exit.")
                     for task in active_tasks.values():
                         task.cancel()
                     # await asyncio.gather(*active_tasks.values(), return_exceptions=True) # Optional: wait for cancellation

        logger.info(f"Finished processing for request ID: {request_id}. Releasing analysis task semaphore.")
        # Semaphore released automatically by 'async with'