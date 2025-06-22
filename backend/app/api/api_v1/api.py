from fastapi import APIRouter

# Import endpoint routers here as they are created
from .endpoints import login, requests, settings, admin_requests, logs, admin_profile # Add admin_profile

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(login.router, tags=["login"])
api_router.include_router(requests.router, prefix="/requests", tags=["requests"])
api_router.include_router(settings.router, prefix="/admin/settings", tags=["settings"]) # Admin only - Corrected prefix
api_router.include_router(admin_requests.router, prefix="/admin/requests", tags=["admin-requests"]) # Admin only
api_router.include_router(logs.router, prefix="/admin/logs", tags=["admin-logs"]) # Admin only
api_router.include_router(admin_profile.router, prefix="/admin/profile", tags=["admin-profile"]) # Admin only - Add profile endpoint

# Include initialization endpoint (it's part of v1 for simplicity now)
from .endpoints import initialize
api_router.include_router(initialize.router, prefix="/initialize", tags=["initialize"])