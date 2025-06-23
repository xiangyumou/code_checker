# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a code analysis and checking application built with a microservices architecture:
- **Backend**: FastAPI with PostgreSQL database, WebSocket support, and OpenAI integration
- **Frontend**: Unified React/TypeScript application for both end users and admin interface
- **Infrastructure**: Docker Compose orchestration

## Common Development Commands

### Docker Development (Recommended)
```bash
# Start all services (backend, frontend, database)
docker-compose up

# Rebuild and start services
docker-compose up --build

# Stop all services
docker-compose down

# View logs for specific service
docker-compose logs backend
docker-compose logs frontend
```

### Backend Development
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Create new migration
alembic revision --autogenerate -m "description"

# Run tests
pytest

# Run tests with coverage
pytest --cov=app tests/

# Start development server (if not using Docker)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Development
```bash
cd frontend

# Install dependencies
npm install

# Start development server (if not using Docker)
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview
```

## Architecture Overview

### Backend Structure (`/backend/`)
- **`app/api/`**: FastAPI route handlers organized by domain
- **`app/core/`**: Configuration, security, and global exception handling
- **`app/crud/`**: Database operations using SQLAlchemy
- **`app/models/`**: SQLAlchemy database models
- **`app/schemas/`**: Pydantic models for request/response validation
- **`app/services/`**: Business logic and external service integrations (OpenAI)
- **`app/websockets/`**: WebSocket connection management for real-time features
- **`app/db/`**: Database session management and connection handling
- **`alembic/`**: Database migration scripts
- **`tests/`**: pytest test suite with async support

### Frontend Architecture
The unified frontend follows a feature-based structure:
- **`src/features/user/`**: User-facing application components and logic
- **`src/features/admin/`**: Admin panel components and logic
- **`src/components/shared/`**: Shared React components
- **`src/contexts/`**: React Context providers for state management
- **`src/api/`**: Shared API functions
- **`src/shared/`**: Shared types and utilities
- **`public/locales/`**: i18n translation files (en, de, zh)

### Key Technologies
- **Backend**: FastAPI, SQLAlchemy, Alembic, PostgreSQL, asyncpg, WebSockets, OpenAI API
- **Frontend**: React 19, TypeScript, Vite, Ant Design, Monaco Editor, i18next
- **Development**: Docker Compose, ESLint, pytest with async support

## Database Management

The application uses PostgreSQL with Alembic for migrations:
- Database connection configured via environment variables in docker-compose.yml
- Migrations auto-run on container startup
- Use `alembic revision --autogenerate` for schema changes
- Test database operations use async patterns with asyncpg

## Testing Strategy

- **Backend**: pytest with pytest-asyncio, configured in `pytest.ini`
- **API Testing**: httpx for async HTTP client testing
- **Test Structure**: Organized in `backend/tests/` with separate API and service tests
- **Async Support**: All tests can use async/await patterns

## Development Notes

- Frontend apps use Vite proxy configuration to communicate with backend API
- WebSocket connections handle real-time code analysis updates
- File uploads are handled through dedicated endpoints with volume mounts
- Internationalization support with automatic language detection
- Monaco Editor integration for code editing and diff visualization
- Mermaid diagram support for documentation and analysis visualization

## Service Ports (Docker)
- Frontend: http://localhost:5063 (User interface at /, Admin panel at /admin)
- Backend API: accessible internally to frontend containers
- Database: internal PostgreSQL service (not exposed)