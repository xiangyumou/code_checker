"""
Security middleware for the FastAPI application.
"""
import time
from collections import defaultdict
from typing import Dict, Optional
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)

# Simple in-memory rate limiting (for production, use Redis)
class RateLimiter:
    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: Dict[str, list] = defaultdict(list)
    
    def is_allowed(self, client_ip: str) -> bool:
        now = time.time()
        # Clean old requests
        self.requests[client_ip] = [
            req_time for req_time in self.requests[client_ip]
            if now - req_time < self.window_seconds
        ]
        
        # Check if limit exceeded
        if len(self.requests[client_ip]) >= self.max_requests:
            return False
        
        # Add current request
        self.requests[client_ip].append(now)
        return True

# Global rate limiter instance
rate_limiter = RateLimiter()

async def rate_limiting_middleware(request: Request, call_next):
    """Rate limiting middleware to prevent abuse."""
    client_ip = request.client.host if request.client else "unknown"
    
    # Skip rate limiting for health checks
    if request.url.path in ["/", "/health", "/docs", "/openapi.json"]:
        return await call_next(request)
    
    if not rate_limiter.is_allowed(client_ip):
        logger.warning(f"Rate limit exceeded for IP: {client_ip}")
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": "Rate limit exceeded. Please try again later."}
        )
    
    return await call_next(request)

async def security_headers_middleware(request: Request, call_next):
    """Add security headers to responses."""
    response = await call_next(request)
    
    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    
    return response