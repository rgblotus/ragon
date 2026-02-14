"""
Olivia Backend Modern Database Configuration (2025) - Performance Optimized

Implements modern SQLAlchemy 2.0 patterns with async support,
proper connection pooling, and enhanced dependency injection.
Optimized for PostgreSQL performance.
"""

import logging
from typing import Generator, AsyncGenerator
from contextlib import contextmanager, asynccontextmanager
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from fastapi import Depends

from app.rag.config import settings

# Setup logging
logger = logging.getLogger(__name__)

# Performance-optimized PostgreSQL async engine configuration
async_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DATABASE_ECHO,
    pool_pre_ping=True,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_timeout=30,  # 30 seconds timeout for connection acquisition
    pool_recycle=3600,  # Recycle connections every hour to prevent stale connections
    pool_use_lifo=True,  # Use LIFO for better performance with PostgreSQL
    connect_args={
        "server_settings": {
            "application_name": "olivia_backend",
            "statement_timeout": "30000",  # 30 seconds query timeout
        }
    },
)

# Convert async URL to sync URL for the sync engine
sync_db_url = settings.DATABASE_URL.replace(
    "postgresql+asyncpg://", "postgresql+psycopg2://"
)

engine = create_engine(
    url=sync_db_url,
    echo=settings.DATABASE_ECHO,
    pool_pre_ping=True,
    pool_recycle=settings.DATABASE_POOL_RECYCLE,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
)


@contextmanager
def transaction_scope(session: Session):
    """Context manager for explicit transaction handling with isolation level control."""
    try:
        if settings.DATABASE_URL.startswith("postgresql"):
            session.execute(text("SET TRANSACTION ISOLATION LEVEL READ COMMITTED"))
        yield session
        session.commit()
    except Exception as e:
        try:
            session.rollback()
        except Exception:
            pass
        logger.error(f"Transaction failed: {e}", extra={"error": str(e)})
        raise


@asynccontextmanager
async def async_transaction_scope():
    """Async context manager for explicit transaction handling with isolation level control."""
    async with AsyncSession(async_engine) as session:
        try:
            if settings.DATABASE_URL.startswith("postgresql"):
                await session.execute(
                    text("SET TRANSACTION ISOLATION LEVEL READ COMMITTED")
                )
            yield session
            await session.commit()
        except Exception as e:
            try:
                await session.rollback()
            except Exception:
                pass
            logger.error(f"Async transaction failed: {e}", extra={"error": str(e)})
            raise


def get_session() -> Generator[Session, None, None]:
    """Modern database session dependency injection with enhanced error handling."""
    logger.debug("Creating new database session")
    with Session(engine) as session:
        try:
            yield session
        except Exception as e:
            session.rollback()
            logger.error(f"Database session error: {e}", extra={"error": str(e)})
            raise
        finally:
            logger.debug("Closing database session")
            session.close()


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """Async database session dependency injection for performance-critical operations."""
    logger.debug("Creating new async database session")
    session = AsyncSession(async_engine, expire_on_commit=False)
    try:
        yield session
    except Exception as e:
        try:
            await session.rollback()
        except Exception:
            pass
        # 401 errors are expected for unauthenticated requests - log as debug/info
        if "401" in str(e) or "Could not validate credentials" in str(e):
            logger.debug(f"Unauthenticated database access attempt: {e}")
        else:
            logger.error(f"Async database session error: {e}", extra={"error": str(e)})
        raise
    finally:
        try:
            await session.close()
        except Exception:
            pass


def create_db_and_tables():
    """Create all database tables with modern error handling."""
    logger.info(f"Creating database tables... (DB: {settings.database_url_safe})")

    # Import all models here to ensure they are registered with SQLModel
    from app.auth.models import User, UserSettings
    from app.collection.models import Collection
    from app.document.models import Document
    from app.chat.models import ChatSession, ChatMessage

    try:
        SQLModel.metadata.create_all(engine)
        logger.info("✅ Database tables created/verified successfully")
    except Exception as e:
        logger.error(f"❌ Database table creation failed: {e}", extra={"error": str(e)})
        raise


async def async_create_db_and_tables():
    """Async version of database table creation for performance."""
    logger.info(f"Creating database tables async... (DB: {settings.database_url_safe})")

    # Import all models here to ensure they are registered with SQLModel
    from app.auth.models import User, UserSettings
    from app.collection.models import Collection
    from app.document.models import Document
    from app.chat.models import ChatSession, ChatMessage

    try:
        async with async_engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        logger.info("✅ Database tables created/verified successfully (async)")
    except Exception as e:
        logger.error(
            f"❌ Async database table creation failed: {e}", extra={"error": str(e)}
        )
        raise


def close_db_connections():
    """Close all database connections with proper cleanup."""
    try:
        engine.dispose()
        # AsyncEngine.dispose() is actually synchronous despite returning a coroutine
        # We can call it directly without await in a sync context
        try:
            # Try to dispose async engine synchronously
            async_engine.sync_engine.dispose()
        except AttributeError:
            # If sync_engine doesn't exist, just log it
            logger.warning("Could not dispose async engine synchronously")
        logger.info("Database connections closed successfully")
    except Exception as e:
        logger.error(
            f"Error closing database connections: {e}", extra={"error": str(e)}
        )


# Health check function for monitoring
def health_check_db() -> dict:
    """Database health check function."""
    logger.debug("Performing database health check")
    try:
        from sqlalchemy import text

        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            logger.debug("Database health check successful")
            return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error(f"Database health check failed: {e}", extra={"error": str(e)})
        return {"status": "unhealthy", "database": f"error: {str(e)}"}


async def async_health_check_db() -> dict:
    """Async database health check function for performance monitoring."""
    logger.debug("Performing async database health check")
    try:
        from sqlalchemy import text

        async with async_engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            logger.debug("Async database health check successful")
            return {"status": "healthy", "database": "connected", "async": True}
    except Exception as e:
        logger.error(
            f"Async database health check failed: {e}", extra={"error": str(e)}
        )
        return {"status": "unhealthy", "database": f"error: {str(e)}", "async": True}


# Performance monitoring functions
def get_db_connection_stats() -> dict:
    """Get database connection pool statistics for performance monitoring."""
    try:
        pool = engine.pool
        return {
            "pool_size": pool.size(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
            "checkout_timeout": pool.timeout(),
            "pool_status": "healthy",
        }
    except Exception as e:
        logger.error(f"Error getting connection stats: {e}", extra={"error": str(e)})
        return {"pool_status": "error", "error": str(e)}


async def get_async_db_connection_stats() -> dict:
    """Get async database connection pool statistics for performance monitoring."""
    try:
        pool = async_engine.pool
        return {
            "pool_size": pool.size(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
            "checkout_timeout": pool.timeout(),
            "pool_status": "healthy",
            "async": True,
        }
    except Exception as e:
        logger.error(
            f"Error getting async connection stats: {e}", extra={"error": str(e)}
        )
        return {"pool_status": "error", "error": str(e), "async": True}


def reset_database():
    """
    🔥 POSTGRESQL-SAFE DATABASE RESET 🔥
    Drops ALL tables in public schema with CASCADE (handles FKs, views, sequences).
    ONLY USE IN DEVELOPMENT/TESTING ENVIRONMENTS.

    Why this works better than metadata.drop_all():
    - Uses PostgreSQL-native CASCADE to handle dependencies
    - Drops ALL tables in schema (not just metadata-registered ones)
    - Avoids "cannot drop table due to foreign key constraints" errors
    - Handles case-sensitive table names safely
    """
    # ⚠️ CRITICAL SAFETY CHECK - PREVENT PRODUCTION DISASTERS
    if settings.ENVIRONMENT not in ["development", "testing", "local", "staging"]:
        error_msg = (
            "❌ FATAL: Database reset attempted in PRODUCTION environment! "
            "This operation is ONLY allowed in development/testing environments. "
            f"Current environment: {settings.ENVIRONMENT}"
        )
        logger.critical(error_msg)
        raise RuntimeError(error_msg)

    logger.warning(
        "🔥 INITIATING DATABASE RESET - ALL DATA WILL BE PERMANENTLY DELETED!"
    )
    logger.warning("   Verifying no active connections before proceeding...")

    # Import models to populate metadata for recreation phase
    from app.auth.models import User, UserSettings
    from app.collection.models import Collection
    from app.document.models import Document

    try:
        with engine.connect() as conn:
            with conn.begin():
                # 1. TERMINATE STRAY CONNECTIONS (critical for schema operations)
                conn.execute(
                    text("""
                    SELECT pg_terminate_backend(pid) 
                    FROM pg_stat_activity 
                    WHERE datname = current_database() 
                      AND pid <> pg_backend_pid()
                      AND state IN ('idle', 'idle in transaction', 'active')
                """)
                )
                logger.debug("✅ Terminated stray database connections")

                # 2. DROP ALL TABLES IN PUBLIC SCHEMA WITH CASCADE
                result = conn.execute(
                    text("""
                    SELECT tablename 
                    FROM pg_tables 
                    WHERE schemaname = 'public' 
                    ORDER BY tablename
                """)
                )
                tables = [row[0] for row in result]

                if tables:
                    logger.info(
                        f"🗑️  Dropping {len(tables)} tables with CASCADE (handles FKs/views/sequences)..."
                    )
                    for table in tables:
                        # Safely quote identifiers to handle mixed-case names
                        conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE'))
                    logger.info(
                        f"✅ Successfully dropped {len(tables)} tables and all dependencies"
                    )
                else:
                    logger.info("ℹ️  No tables found in public schema")

                # 3. RESET SEQUENCES (critical for ID continuity after reset)
                conn.execute(
                    text(
                        "SELECT setval(pg_get_serial_sequence(t.tablename, 'id'), 1, false) "
                        "FROM pg_tables t WHERE schemaname = 'public'"
                    )
                )

        # 4. RECREATE SCHEMA FROM METADATA
        logger.info("🛠️  Recreating database schema from SQLModel metadata...")
        SQLModel.metadata.create_all(engine)
        logger.info("✅ Database reset completed successfully!")
        logger.warning(
            "🔥 ALL DATA HAS BEEN PERMANENTLY DELETED - READY FOR FRESH START"
        )

    except Exception as e:
        logger.error(
            f"❌ DATABASE RESET FAILED: {type(e).__name__}: {e}", exc_info=True
        )
        raise RuntimeError(f"Database reset failed: {str(e)}") from e
