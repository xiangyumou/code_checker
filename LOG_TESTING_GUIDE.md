# Comprehensive Logging System Guide

## Overview
The application now has extensive logging covering all major operations and events:
- **Authentication**: Login attempts, successes, failures, inactive users
- **Request Lifecycle**: Creation, queueing, processing, completion, failures
- **System Events**: Application startup/shutdown, background tasks
- **Admin Operations**: Settings updates, request deletion, batch operations, retries
- **OpenAI Integration**: API calls, responses, rate limits, timeouts, errors
- **WebSocket Events**: Connections, disconnections, broadcasts
- **File Operations**: Image uploads, saves, cleanup failures
- **Security Events**: Unauthorized access attempts with IP tracking
- **Background Tasks**: Log cleanup, task management

The logging system features:
- Database-backed log storage in PostgreSQL with JSON context data
- Advanced filtering and search capabilities
- Automatic cleanup of old logs (30-day retention, max 100,000 entries)
- Real-time updates via WebSocket in the admin panel
- Structured logging with contextual data for better debugging

## Test Steps

### 1. Access the Application
1. Open your browser and navigate to: http://localhost:5063
2. Click on "Admin Panel" or navigate to: http://localhost:5063/admin
3. Login with admin credentials

### 2. View System Logs
1. In the admin panel, look for "System Monitoring" section in the navigation
2. Click on "Logs" (日志/Logs)
3. You should see the new log viewer with:
   - Color-coded log levels (DEBUG=blue, INFO=green, WARNING=orange, ERROR=red)
   - Timestamp, source, and message columns
   - Filter options at the top

### 3. Test Filtering Features
1. **Level Filter**: Select a specific log level (e.g., "ERROR") to see only error logs
2. **Date Range**: Use the date picker to filter logs by time period
3. **Search**: Type keywords in the search box to find logs containing specific text
4. **Refresh**: Click the refresh button to reload logs

### 4. Test Authentication Logging
1. **Successful Login**:
   - Login with valid credentials
   - Check logs for: `INFO: "User logged in successfully: {username}"`
   - View context data: user_id, client_ip, is_admin

2. **Failed Login Attempts**:
   - Try invalid username: `WARNING: "Failed login attempt for username: {username} from IP: {ip}"`
   - Try wrong password: `WARNING: "Failed login attempt for username: {username} from IP: {ip}"`
   - Try inactive user: `WARNING: "Login attempt for inactive user: {username} from IP: {ip}"`

### 5. Test Request Processing Logging
1. **Create Request**:
   - Submit analysis request with text/images
   - Logs: `INFO: "Created analysis request {id}"` with context: request_id, image_count
   - `INFO: "Request {id} queued for analysis"`

2. **Processing Stages**:
   - Watch logs during processing:
   - `INFO: "Started processing analysis request {id}"`
   - `INFO: "Request {id} status changed to PROCESSING"`
   - `INFO: "OpenAI API call initiated for request {id}"`
   - `INFO: "OpenAI API response received"` with token usage data
   - `INFO: "Request {id} completed successfully"` or `ERROR: "Request {id} failed"`

3. **Empty Request**:
   - Try submitting empty request
   - `WARNING: "Empty request creation attempt - no prompt or images"`

### 6. Test Admin Operations
1. **Settings Updates**:
   - Change any setting in Settings page
   - `INFO: "Setting '{key}' updated by {username} to: {value}"`
   - Sensitive keys are masked in logs

2. **Request Deletion**:
   - Delete a request from admin panel
   - `WARNING: "Request {id} deleted by admin user {username}"`

3. **Batch Operations**:
   - Select multiple requests and delete/retry
   - `INFO: "Batch {action} operation started by {username}"`
   - `WARNING: "Batch delete completed: {count} requests deleted"`

4. **Request Retry**:
   - Retry a failed request
   - `INFO: "Request {id} retry initiated by admin user {username}"`

### 7. Test OpenAI Integration Logging
1. **Normal Operation**:
   - Submit request and check for API call logs
   - Token usage is logged with each response

2. **Error Scenarios**:
   - Rate limits: `WARNING: "OpenAI API rate limit exceeded for request {id}"`
   - Timeouts: `WARNING: "OpenAI API timeout for request {id}"`
   - API errors: `ERROR: "OpenAI API connection error for request {id}"`

### 8. Test System Events
1. **Application Startup**:
   - Restart the application
   - `INFO: "Application started successfully"`
   - `INFO: "Background tasks started successfully"`
   - `INFO: "Analysis worker started"`
   - `WARNING: "Found {count} interrupted requests during startup"` (if any)

2. **Application Shutdown**:
   - Stop the application gracefully
   - `INFO: "Application shutdown completed"`
   - `INFO: "Background tasks stopped successfully"`

### 9. Test Security Logging
1. **Unauthorized Access**:
   - Try accessing endpoints without authentication
   - `WARNING: "Request list access by unauthenticated user from IP: {ip}"`
   - `WARNING: "Request {id} regeneration attempt by unauthenticated user from IP: {ip}"`

### 10. Test Background Tasks
1. **Log Cleanup**:
   - Wait for hourly cleanup or check logs
   - `INFO: "Log cleanup task removed {count} old entries"`
   - Logs older than 30 days are removed

### 11. Generate Test Logs
Run the test script to generate various log entries:
```bash
docker-compose exec backend python test_logging.py
```

### 12. Test Clear All Logs
1. In the log viewer, click "Clear All Logs" button
2. Confirm the action
3. All logs will be deleted from the database

## API Endpoints

### Get Logs (Requires Admin Authentication)
```bash
GET /api/v1/admin/logs/
Query Parameters:
- skip: Number of records to skip (default: 0)
- limit: Maximum records to return (default: 100, max: 1000)
- level: Filter by log level (DEBUG, INFO, WARNING, ERROR)
- start_date: Filter from this datetime (ISO format)
- end_date: Filter until this datetime (ISO format)
- search: Search in message and source fields
```

### Clear All Logs (Requires Admin Authentication)
```bash
DELETE /api/v1/admin/logs/
```

## Log Entry Structure
```json
{
  "id": 123,
  "timestamp": "2023-10-27T10:00:00Z",
  "level": "ERROR",
  "message": "Database connection failed",
  "source": "app.db.session",
  "context": {
    "request_id": 456,
    "user_id": 789,
    "error_type": "ConnectionError",
    "client_ip": "192.168.1.100"
  }
}
```

## Log Levels and Their Usage
- **DEBUG**: Detailed diagnostic information (file paths, API details, internal state)
- **INFO**: General informational messages (successful operations, status changes)
- **WARNING**: Warning conditions (failed attempts, rate limits, missing data)
- **ERROR**: Error conditions (failures, exceptions, critical issues)

## Context Data Fields
Common context fields logged with events:
- `request_id`: Analysis request ID
- `user_id`: User performing the action
- `client_ip`: Client IP address
- `username`: Username for authentication events
- `error_type`: Type of exception/error
- `deleted_by`: Admin who deleted a resource
- `settings_configured`: List of settings during initialization
- `token_usage`: OpenAI API token consumption
- `image_count`: Number of images in a request
- `batch_size`: Size of batch operations

## Implementation Details

### Backend Components
1. **Model**: `backend/app/models/log.py` - SQLAlchemy model for logs
2. **Schema**: `backend/app/schemas/log.py` - Pydantic schemas
3. **CRUD**: `backend/app/crud/crud_log.py` - Database operations
4. **Service**: `backend/app/services/log_service.py` - Business logic
5. **API**: `backend/app/api/api_v1/endpoints/logs.py` - REST endpoints
6. **Background Task**: `backend/app/core/tasks.py` - Log cleanup task
7. **Helper**: `backend/app/core/logging.py` - Database logger utility

### Frontend Components
1. **Page**: `frontend/src/features/admin/pages/LogViewerPage.tsx` - Main UI
2. **API Client**: `frontend/src/features/admin/api/logs.ts` - API functions
3. **Types**: `frontend/src/types/index.ts` - TypeScript types

### Database
- Table: `logs`
- Indexes on: `id`, `timestamp`, `level`, `source`
- Migration: `backend/alembic/versions/7a0ef7a69781_add_logs_table.py`

## Notes
- Comprehensive logging has been added across all major application components
- All logs include contextual data for better debugging and auditing
- Client IP addresses are tracked for security monitoring
- Sensitive data (API keys, passwords) are masked in logs
- The system maintains both console output and database storage
- Log retention is 30 days with automatic cleanup
- Maximum 100,000 entries are kept to prevent database bloat

## Best Practices for Using Logs
1. **Security Monitoring**: Regularly check WARNING logs for unauthorized access attempts
2. **Performance Analysis**: Monitor INFO logs for API token usage and processing times
3. **Error Investigation**: Use context data in ERROR logs to trace issues
4. **Audit Trail**: Authentication and admin action logs provide complete audit history
5. **System Health**: Startup/shutdown logs help identify system issues

## Adding New Log Sources
To add logging to new components:
1. Import the database logger: `from app.core.logging import get_db_logger`
2. Create a logger instance: `db_logger = get_db_logger("component.name")`
3. Log events with context: `await db_logger.info(db, "Event message", extra_data={...})`