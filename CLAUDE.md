# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a code checker application with a FastAPI backend and dual React frontends (user and admin interfaces). The system processes code analysis requests through OpenAI integration with real-time WebSocket updates.

**Architecture:**
- `backend/` - FastAPI application with PostgreSQL database
- `frontend/` - User-facing React/TypeScript interface
- `admin-frontend/` - Admin React/TypeScript interface  
- Docker Compose orchestration with hot-reload development setup

## Development Commands

### Full Stack Development
```bash
# Start all services (backend, frontend, admin-frontend, PostgreSQL)
docker-compose up

# Rebuild and start (after dependency changes)
docker-compose up --build

# View logs for specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f admin_frontend
```

### Backend Development
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run tests
pytest

# Run specific test file
pytest tests/api/v1/test_requests.py

# Database migrations (if needed)
alembic upgrade head
alembic revision --autogenerate -m "description"

# Manual server start (development)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Development
```bash
cd frontend
# or cd admin-frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview
```

## Key Architecture Details

### Database Layer
- PostgreSQL with async SQLAlchemy
- Models: `Request`, `AdminUser`, `Setting`
- CRUD operations in `app/crud/` with base patterns
- Alembic for migrations

### API Structure
- FastAPI with automatic OpenAPI docs at `/docs`
- API routes in `app/api/api_v1/endpoints/`
- Authentication via JWT tokens for admin routes
- WebSocket endpoint at `/ws/status/{client_id}` for real-time updates

### Request Processing Flow
1. User submits request via frontend form
2. Request stored with `QUEUED` status
3. Background worker processes via OpenAI API
4. Status updates broadcast via WebSocket
5. Results cached and displayed in UI

### WebSocket Communication
- Client connects with unique UUID-based client_id
- Message types: `request_created`, `request_updated`, `request_deleted`
- Automatic reconnection and status indicators in UI

### Settings Management
- Dynamic configuration stored in database `Setting` table
- Key settings: `openai_api_key`, `openai_model`, `log_level`, `max_concurrent_tasks`
- Settings API for admin configuration

### Internationalization
- React i18next in both frontends
- Supported languages: en-US, zh-CN, de-DE
- Translation files in `public/locales/`

## Testing

### Backend Testing
- pytest with async support (`pytest.ini` configured)
- Test database isolation via fixtures
- API endpoint testing with httpx client
- Run from `backend/` directory

### Key Test Files
- `tests/api/v1/test_requests.py` - Request lifecycle testing
- `tests/api/v1/test_admin_requests.py` - Admin request management
- `tests/services/test_request_service.py` - Business logic testing

## Docker Services

- **backend**: Port internally, PostgreSQL connection via service name
- **frontend**: Port 5063 → 5173 (Vite dev server)
- **admin_frontend**: Port 5064 → 5173 (Vite dev server)
- **db**: PostgreSQL 15 with health checks and named volume persistence

## Configuration

### Environment Variables (Docker Compose)
- `POSTGRES_SERVER`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `MAX_CONCURRENT_ANALYSIS_TASKS` (defaults to 5)
- `SECRET_KEY` for JWT tokens

### Runtime Settings (Database)
- OpenAI configuration (API key, model, base URL)
- Logging level configuration
- Processing parameters (timeouts, retry limits)

## Common Workflows

### Adding New API Endpoint
1. Create endpoint in `backend/app/api/api_v1/endpoints/`
2. Add route to `backend/app/api/api_v1/api.py`
3. Create/update schemas in `backend/app/schemas/`
4. Add tests in `tests/api/v1/`

### Database Schema Changes
1. Modify models in `backend/app/models/`
2. Generate migration: `alembic revision --autogenerate -m "description"`
3. Review and edit migration file if needed
4. Apply: `alembic upgrade head`

### Adding Frontend Features
1. Update types in `src/types/index.ts`
2. Create/modify components
3. Add API calls in `src/api/`
4. Update translations in `public/locales/*/translation.json`