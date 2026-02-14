"""
Core Module
===========

Provides core services for the application:

- database: Database connection and session management
- cache_service: Redis caching
- security: JWT and password utilities
- middleware: Request/response middleware
- progress_service: WebSocket progress updates
"""

from app.core.database import async_engine
from app.core.cache_service import cache_service
from app.core.security import get_password_hash, verify_password, create_access_token

__all__ = [
    "async_engine",
    "cache_service",
    "get_password_hash",
    "verify_password",
    "create_access_token",
]
