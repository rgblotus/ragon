"""
Olivia Backend API Main Application (Modern 2025)

FastAPI application with modern patterns including:
- Enhanced dependency injection
- Modern middleware system
- Structured logging
- Health monitoring
- Security headers
"""

import logging
import asyncio
from contextlib import asynccontextmanager
from typing import List
from datetime import datetime
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import HTTPException

# Import configuration
from app.rag.config import settings

# Import modern database configuration
from app.core.database import (
    async_create_db_and_tables,
    async_health_check_db,
)

# Import modern middleware
from app.core.middleware import setup_middleware

# Import modern exception handling
from app.core.exceptions import handle_exception

# Import logging configuration
from app.core.logging_config import setup_logging, performance_logger

# Import service manager
from app.core.service_manager import service_manager, get_services_status

# Import all models to ensure SQLModel relationships are registered
from app.auth.models import User, UserSettings
from app.collection.models import Collection
from app.document.models import Document
from app.chat.models import ChatSession, ChatMessage

# Import routers
from app.auth.router import router as auth_router
from app.document.router import router as document_router
from app.collection.router import router as collection_router
from app.rag.router import router as rag_router
from app.chat.router import router as chat_router
from app.core.router import router as migration_router

# Setup modern structured logging
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Modern application lifespan management with enhanced service coordination."""
    logger.info("🚀 Initializing Olivia Backend API (2026 Modern Version)...")

    # Create database tables with modern error handling
    try:
        await async_create_db_and_tables()
        logger.info("✅ Database tables created/verified successfully")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}", extra={"error": str(e)})
        raise

    # Auto-migration check (only in development)
    if settings.ENVIRONMENT in ["development", "testing", "local"]:
        try:
            from app.core.migration_manager import AutoMigrationManager

            manager = AutoMigrationManager()
            plan = manager.detect_changes()

            if plan.tables_to_create or plan.columns_to_add or plan.columns_to_remove:
                logger.info("🔄 Detected schema changes, running auto-migration...")
                result = manager.generate_and_apply_migration(
                    message="Auto-migration on startup", auto_approve=True
                )
                if result.get("success"):
                    logger.info("✅ Auto-migration completed successfully")
                else:
                    logger.warning(
                        f"⚠️ Auto-migration had issues: {result.get('errors')}"
                    )
            else:
                logger.info("ℹ️ No schema changes detected")
        except Exception as e:
            logger.warning(f"⚠️ Auto-migration check failed: {e}")

    # Initialize all services (Ollama, Milvus, AI models)
    try:
        await service_manager.initialize_services()
        logger.info("✅ All backend services initialized successfully")
    except Exception as e:
        logger.error(f"❌ Service initialization failed: {e}", extra={"error": str(e)})
        # Don't raise here to allow partial initialization
        logger.warning("Continuing with degraded service availability")

    # Initialize cache monitoring
    try:
        if settings.CACHE_MONITORING_ENABLED:
            from app.core.cache_monitor import cache_monitor

            cache_monitor.start_monitoring()
            logger.info("✅ Cache monitoring initialized successfully")
        else:
            logger.info("ℹ️ Cache monitoring disabled in configuration")
    except Exception as e:
        logger.error(
            f"❌ Cache monitoring initialization failed: {e}", extra={"error": str(e)}
        )
        logger.warning("Continuing without cache monitoring")

    logger.info("🎆 Olivia Backend API initialized successfully")
    yield

    # Cleanup on shutdown
    logger.info("🛑 Shutting down Olivia Backend API...")
    try:
        from app.core.database import close_db_connections

        close_db_connections()
        logger.info("✅ Shutdown completed successfully")
    except Exception as e:
        logger.error(f"❌ Error during shutdown: {e}", extra={"error": str(e)})


# Create modern FastAPI application with enhanced configuration
app = FastAPI(
    title=settings.APP_NAME,
    description="Modern AI research assistant backend with RAG capabilities (2025)",
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
    debug=settings.DEBUG,
)

# Setup modern middleware system
setup_middleware(app)


# Modern global exception handler using custom exception system
@app.exception_handler(Exception)
async def modern_exception_handler(request: Request, exc: Exception):
    """Modern exception handler using custom exception system."""
    http_exception = handle_exception(exc)

    # Add request ID if available
    request_id = getattr(request.state, "request_id", None)
    if request_id and isinstance(http_exception.detail, dict):
        http_exception.detail["request_id"] = request_id

    return JSONResponse(
        status_code=http_exception.status_code, content=http_exception.detail
    )


# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# Cache management endpoint (temporary for development)
@app.post("/admin/reset-milvus")
async def reset_milvus():
    """Reset Milvus collection - drop and recreate with correct schema."""
    try:
        from app.rag.service import rag_service

        # Force recreation of vector store (drop existing collection)
        rag_service.reset_vector_store(force=True)

        # Get fresh vector store (will create with correct schema)
        store = rag_service.vector_store

        return {
            "message": "Milvus collection reset successfully",
            "collection_name": "LangChainCollection",
        }
    except Exception as e:
        logger.error(f"Failed to reset Milvus: {e}")
        return {"error": f"Failed to reset Milvus: {str(e)}"}


# Modern health check endpoints with enhanced monitoring
@app.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "environment": "production" if not settings.DEBUG else "development",
    }


@app.get("/health/detailed")
async def detailed_health_check():
    """Enhanced health check with detailed component status and real metrics."""
    health_status = {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "components": {},
        "metrics": {},
        "performance": {},
    }

    # Check database connection using real health check (async version)
    try:
        db_health = await async_health_check_db()
        health_status["components"]["database"] = db_health["database"]
        health_status["metrics"]["database_pool_status"] = "connected"
        if db_health["status"] != "healthy":
            health_status["status"] = "degraded"
    except Exception as e:
        health_status["components"]["database"] = f"error: {str(e)}"
        health_status["status"] = "degraded"
        health_status["metrics"]["database_pool_status"] = "error"

    # Check services status with real error handling
    try:
        services_status = get_services_status()
        health_status["components"]["services"] = services_status

        # Mark as degraded if critical services failed
        if not service_manager.is_healthy():
            health_status["status"] = "degraded"
            health_status["components"]["services"] = "degraded"
    except Exception as e:
        health_status["components"]["services"] = f"check failed: {str(e)}"
        health_status["status"] = "degraded"

    # Add real system information
    health_status["system"] = {
        "debug_mode": settings.DEBUG,
        "cors_origins_count": len(settings.cors_origins_list),
        "log_level": settings.LOG_LEVEL,
        "database_url_type": "postgresql"
        if settings.DATABASE_URL.startswith("postgresql")
        else "sqlite",
    }

    # Add performance metrics
    try:
        from app.core.database import get_async_db_connection_stats

        db_stats = await get_async_db_connection_stats()
        health_status["performance"]["database"] = db_stats
    except Exception as e:
        health_status["performance"]["database"] = {"status": "error", "error": str(e)}

    return health_status


# API routes
app.include_router(auth_router, prefix="/auth", tags=["authentication"])
app.include_router(document_router, prefix="/documents", tags=["documents"])
app.include_router(collection_router, prefix="/collections", tags=["collections"])
app.include_router(rag_router, prefix="/rag", tags=["rag"])
app.include_router(chat_router, prefix="/chat", tags=["chat"])
app.include_router(migration_router, tags=["migrations"])


# Performance monitoring endpoint
@app.get("/performance")
async def get_performance_metrics():
    """Get detailed performance metrics for the backend."""
    from app.core.database import get_async_db_connection_stats

    performance_data = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "database": {},
        "system": {
            "cpu_usage": "N/A",  # Would require psutil
            "memory_usage": "N/A",  # Would require psutil
        },
    }

    try:
        db_stats = await get_async_db_connection_stats()
        performance_data["database"] = {
            "connection_pool": db_stats,
            "status": "healthy",
        }
    except Exception as e:
        performance_data["database"] = {"status": "error", "error": str(e)}

    return performance_data


# Modern root endpoint with enhanced API information
@app.get("/")
async def read_root():
    """Modern root endpoint with comprehensive API information."""
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": settings.APP_VERSION,
        "environment": "production" if not settings.DEBUG else "development",
        "docs": "/docs",
        "redoc": "/redoc",
        "openapi": "/openapi.json",
        "health": "/health",
        "health_detailed": "/health/detailed",
        "performance": "/performance",
        "endpoints": {
            "authentication": "/auth",
            "documents": "/documents",
            "collections": "/collections",
            "rag": "/rag",
        },
        "features": {
            "modern_2025": True,
            "structured_logging": True,
            "enhanced_monitoring": True,
            "security_headers": True,
            "dependency_injection": "enhanced",
            "async_database": True,
            "performance_monitoring": True,
        },
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


# Export the app for uvicorn
app_instance = app
