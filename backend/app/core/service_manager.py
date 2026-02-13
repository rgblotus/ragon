"""
Olivia Backend Service Manager

Coordinates initialization and lifecycle of all external services
(Ollama, Milvus, AI models) to prevent multiple connections and
ensure proper startup order.
"""

import logging
import asyncio
from typing import Dict, Any, Optional
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)


class ServiceManager:
    """
    Manages the lifecycle of all external services in the Olivia backend.
    Ensures services are initialized properly and only once.
    """

    def __init__(self):
        self._initialized = False
        self._services_status: Dict[str, str] = {}
        self._rag_service = None
        self._ai_utils = None
        self._rag_service_call_count = 0
        self._ai_utils_call_count = 0

    async def initialize_services(self):
        """Initialize all services in the correct order."""
        if self._initialized:
            logger.info("Services already initialized")
            return

        logger.info("🚀 Initializing Olivia Backend Services...")

        try:
            # Initialize AI utilities first (lighter weight)
            await self._initialize_ai_utils()

            # Initialize RAG service (depends on embeddings, LLM, Milvus)
            await self._initialize_rag_service()

            self._initialized = True
            logger.info("✅ All services initialized successfully")

        except Exception as e:
            logger.error(f"❌ Service initialization failed: {e}")
            # Don't raise here to allow partial initialization
            # Services will fail gracefully when accessed

    async def _initialize_ai_utils(self):
        """Initialize AI utilities service."""
        try:
            logger.info("Initializing AI Utilities Service...")
            from app.rag.services.ai_utils import AIUtilityService

            # Create instance and verify it can be created
            ai_utils = AIUtilityService()

            # Test basic functionality (device detection)
            device = ai_utils.device_str
            logger.info(f"AI Utils initialized on device: {device}")

            self._ai_utils = ai_utils
            self._services_status["ai_utils"] = "healthy"

        except Exception as e:
            logger.error(f"AI Utils initialization failed: {e}")
            self._services_status["ai_utils"] = f"failed: {str(e)}"

    async def _initialize_rag_service(self):
        """Initialize RAG service - models load lazily on first use."""
        try:
            logger.info("Initializing RAG Service...")
            from app.rag.service import RagService

            # Create instance - models will load lazily on first use
            rag_service = RagService()
            self._rag_service = rag_service
            self._services_status["rag_service"] = "ready"

            # Don't do background loading here - it causes issues
            # Models will load on first request

        except Exception as e:
            logger.error(f"RAG Service initialization failed: {e}")
            self._services_status["rag_service"] = f"failed: {str(e)}"

    def get_rag_service(self):
        """Get the RAG service instance."""
        self._rag_service_call_count += 1
        logger.debug(f"get_rag_service called (total: {self._rag_service_call_count})")

        if not self._initialized:
            logger.warning("Services not initialized yet - initializing on-demand")
            # This should not happen in normal operation
            return None

        return self._rag_service

    def get_ai_utils(self):
        """Get the AI utilities instance."""
        self._ai_utils_call_count += 1
        logger.debug(f"get_ai_utils called (total: {self._ai_utils_call_count})")

        if not self._initialized:
            logger.warning("Services not initialized yet - initializing on-demand")
            return None

        return self._ai_utils

    def get_services_status(self) -> Dict[str, str]:
        """Get the status of all services."""
        status = self._services_status.copy()
        status["rag_service_calls"] = str(self._rag_service_call_count)
        status["ai_utils_calls"] = str(self._ai_utils_call_count)
        logger.debug(f"Service status requested: {status}")
        return status

    def is_healthy(self) -> bool:
        """Check if core services are healthy."""
        required_services = ["ai_utils", "rag_service"]
        return all(
            self._services_status.get(service, "").startswith("healthy")
            for service in required_services
        )


# Global service manager instance
service_manager = ServiceManager()


@asynccontextmanager
async def lifespan_context():
    """FastAPI lifespan context for service management."""
    await service_manager.initialize_services()
    yield
    # Cleanup if needed
    logger.info("Services cleanup completed")


# Dependency injection functions for routers
def get_rag_service_dependency():
    """Dependency injection function for RAG service."""
    rag_service = get_rag_service()
    if rag_service is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=503, detail="RAG service not available")
    return rag_service


def get_ai_utils_dependency():
    """Dependency injection function for AI utils."""
    ai_utils = get_ai_utils()
    if ai_utils is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=503, detail="AI utils service not available")
    return ai_utils


# Convenience functions for getting services
def get_rag_service():
    """Get RAG service instance (for dependency injection)."""
    return service_manager.get_rag_service()


def get_ai_utils():
    """Get AI utils instance (for dependency injection)."""
    return service_manager.get_ai_utils()


def get_services_status():
    """Get services status (for health checks)."""
    return service_manager.get_services_status()
