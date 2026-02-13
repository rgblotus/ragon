"""
Authentication Module
====================

Provides user authentication and authorization.

Exports:
- get_current_user: Dependency for getting current user
"""

from app.auth.router import get_current_user

__all__ = ["get_current_user"]
