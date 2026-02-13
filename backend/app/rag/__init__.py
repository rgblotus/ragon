"""
Olivia RAG Module
=================

Retrieval-Augmented Generation service for document Q&A.

Submodules:
- helpers/: Utility functions (embeddings, event loop, etc.)
- services/: AI services (translation, TTS, chains, retrieval)
- processors/: Document processing

Usage:
    from app.rag import rag_service, settings
"""

from app.rag.service import rag_service
from app.rag.config import settings

__all__ = ["rag_service", "settings"]
