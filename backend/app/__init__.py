"""
Olivia Backend Application
=========================

A FastAPI-based RAG (Retrieval-Augmented Generation) application
for document Q&A with voice support.

Modules:
- auth/: Authentication and user management
- chat/: Chat session management
- collection/: Document collections
- document/: Document upload and management
- core/: Core services (DB, cache, middleware)
- rag/: RAG services for Q&A

Usage:
    from app import rag_service, settings
    from app.auth import get_current_user
"""

from app.rag.config import settings
from app.rag.service import rag_service

__version__ = "1.0.0"

__all__ = ["settings", "rag_service"]
