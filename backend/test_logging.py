#!/usr/bin/env python3
"""
Test script to generate log entries in the database.
Run this inside the Docker container with: docker-compose exec backend python test_logging.py
"""
import asyncio
from app.db.session import AsyncSessionLocal
from app.models.log import LogLevel
from app.services.log_service import log_service


async def generate_test_logs():
    """Generate various test log entries."""
    async with AsyncSessionLocal() as db:
        # Create various log entries
        await log_service.create_log(
            db, 
            level=LogLevel.INFO, 
            message="Application started successfully", 
            source="test_script.startup"
        )
        
        await log_service.create_log(
            db, 
            level=LogLevel.DEBUG, 
            message="Debug: Checking database connection", 
            source="test_script.database"
        )
        
        await log_service.create_log(
            db, 
            level=LogLevel.WARNING, 
            message="Warning: Low memory detected (simulated)", 
            source="test_script.system"
        )
        
        await log_service.create_log(
            db, 
            level=LogLevel.ERROR, 
            message="Error: Failed to connect to external API (simulated)", 
            source="test_script.api"
        )
        
        await log_service.create_log(
            db, 
            level=LogLevel.INFO, 
            message="Processing batch job #12345", 
            source="test_script.jobs"
        )
        
        await log_service.create_log(
            db, 
            level=LogLevel.INFO, 
            message="User authentication successful for admin@example.com", 
            source="test_script.auth"
        )
        
        print("Test logs created successfully!")


if __name__ == "__main__":
    asyncio.run(generate_test_logs())