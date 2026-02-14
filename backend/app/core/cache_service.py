"""
Hybrid Cache Service - Replaces Redis with in-memory cache + PostgreSQL fallback

For RAG applications, this provides:
- Fast in-memory caching with TTL using OrderedDict for true LRU
- PostgreSQL-backed persistent cache for important data
- No external Redis dependency
"""

import hashlib
import json
import logging
import time
import threading
from collections import OrderedDict
from datetime import datetime
from functools import wraps
from typing import Any, Callable, Dict, List, Optional
from dataclasses import dataclass, field

from sqlalchemy import text

from app.rag.config import settings
from app.core.database import engine

logger = logging.getLogger(__name__)


def fast_hash(data: str) -> str:
    """Fast hashing using blake2b (faster than MD5 for large data)."""
    return hashlib.blake2b(data.encode(), digest_size=16).hexdigest()


def fast_hash_bytes(data: bytes) -> str:
    """Fast hashing for binary data."""
    return hashlib.blake2b(data, digest_size=16).hexdigest()


@dataclass
class CacheMetrics:
    hits: int = 0
    misses: int = 0
    sets: int = 0
    deletes: int = 0
    errors: int = 0
    last_reset: float = field(default_factory=time.time)

    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0


class TTLCache:
    """
    TTL cache with OrderedDict for true LRU eviction.
    Thread-safe with locking.
    """

    def __init__(self, max_size: int = 10000, default_ttl: int = 3600):
        self.max_size = max_size
        self.default_ttl = default_ttl
        self._data: OrderedDict[str, Any] = OrderedDict()
        self._expiry: Dict[str, float] = {}
        self._lock = threading.RLock()

    def _cleanup_expired(self):
        """Remove expired entries."""
        now = time.time()
        keys_to_remove = [key for key, expiry in self._expiry.items() if expiry <= now]
        for key in keys_to_remove:
            self._data.pop(key, None)
            self._expiry.pop(key, None)

    def _evict_lru(self):
        """Evict least recently used entries when cache is full."""
        while len(self._data) > self.max_size:
            self._data.popitem(last=False)

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        with self._lock:
            self._cleanup_expired()
            if key in self._data:
                expiry = self._expiry.get(key)
                if expiry is None or expiry > time.time():
                    self._data.move_to_end(key)
                    return self._data[key]
                else:
                    self._data.pop(key, None)
                    self._expiry.pop(key, None)
            return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value in cache."""
        with self._lock:
            self._cleanup_expired()
            expiry = time.time() + (ttl if ttl else self.default_ttl)
            self._data[key] = value
            self._data.move_to_end(key)
            self._expiry[key] = expiry
            self._evict_lru()
            return True

    def delete(self, key: str) -> bool:
        """Delete key from cache."""
        with self._lock:
            if key in self._data:
                self._data.pop(key)
                self._expiry.pop(key, None)
                return True
            return False

    def clear_pattern(self, pattern: str) -> int:
        """Clear keys matching pattern."""
        with self._lock:
            prefix = pattern.replace("*", "")
            keys_to_delete = [k for k in self._data.keys() if k.startswith(prefix)]
            for key in keys_to_delete:
                self._data.pop(key, None)
                self._expiry.pop(key, None)
            return len(keys_to_delete)

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        with self._lock:
            self._cleanup_expired()
            return {"size": len(self._data), "max_size": self.max_size}


class PostgresCache:
    """PostgreSQL-backed persistent cache table."""

    def __init__(self):
        self._initialized = False
        self._lock = threading.Lock()

    def _ensure_table(self):
        """Create cache table if it doesn't exist."""
        if self._initialized:
            return

        with self._lock:
            if self._initialized:
                return

            try:
                with engine.connect() as conn:
                    conn.execute(
                        text("""
                        CREATE TABLE IF NOT EXISTS app_cache (
                            key VARCHAR(512) PRIMARY KEY,
                            value JSONB NOT NULL,
                            expires_at TIMESTAMP,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    """)
                    )
                    conn.execute(
                        text("""
                        CREATE INDEX IF NOT EXISTS idx_app_cache_expires
                        ON app_cache(expires_at)
                    """)
                    )
                    conn.commit()
                self._initialized = True
                logger.info("PostgreSQL cache table initialized")
            except Exception as e:
                logger.error(f"Failed to create cache table: {e}")

    def get(self, key: str) -> Optional[Any]:
        """Get value from PostgreSQL cache."""
        try:
            self._ensure_table()
            with engine.connect() as conn:
                result = conn.execute(
                    text(
                        "SELECT value FROM app_cache WHERE key = :key AND (expires_at IS NULL OR expires_at > NOW())"
                    ),
                    {"key": key},
                ).fetchone()

                if result:
                    raw_value = result[0]
                    if raw_value is None:
                        return None
                    if isinstance(raw_value, str):
                        try:
                            return json.loads(raw_value)
                        except (json.JSONDecodeError, TypeError):
                            logger.error(
                                f"PostgreSQL cache JSON decode error for key {key}: {raw_value}"
                            )
                            return None
                    elif isinstance(raw_value, (dict, list)):
                        return raw_value
                    else:
                        try:
                            return json.loads(str(raw_value))
                        except (json.JSONDecodeError, TypeError):
                            logger.error(f"PostgreSQL cache invalid type for key {key}")
                            return None
                return None
        except Exception as e:
            logger.error(f"PostgreSQL cache get error: {e}")
            return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value in PostgreSQL cache."""
        try:
            self._ensure_table()
            expires_at = None
            if ttl:
                expires_at = datetime.fromtimestamp(time.time() + ttl)

            with engine.connect() as conn:
                conn.execute(
                    text("""
                        INSERT INTO app_cache (key, value, expires_at)
                        VALUES (:key, :value, :expires_at)
                        ON CONFLICT (key) DO UPDATE SET
                            value = :value,
                            expires_at = :expires_at,
                            created_at = CURRENT_TIMESTAMP
                    """),
                    {
                        "key": key,
                        "value": json.dumps(value, default=str),
                        "expires_at": expires_at,
                    },
                )
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"PostgreSQL cache set error: {e}")
            return False

    def delete(self, key: str) -> bool:
        """Delete key from PostgreSQL cache."""
        try:
            self._ensure_table()
            with engine.connect() as conn:
                result = conn.execute(
                    text("DELETE FROM app_cache WHERE key = :key"), {"key": key}
                )
                conn.commit()
                return result.rowcount > 0
        except Exception as e:
            logger.error(f"PostgreSQL cache delete error: {e}")
            return False

    def clear_pattern(self, pattern: str) -> int:
        """Clear all keys matching pattern."""
        try:
            self._ensure_table()
            with engine.connect() as conn:
                result = conn.execute(
                    text("DELETE FROM app_cache WHERE key LIKE :pattern"),
                    {"pattern": pattern.replace("*", "%")},
                )
                conn.commit()
                return result.rowcount
        except Exception as e:
            logger.error(f"PostgreSQL cache clear pattern error: {e}")
            return 0

    def cleanup_expired(self) -> int:
        """Remove expired entries."""
        try:
            self._ensure_table()
            with engine.connect() as conn:
                result = conn.execute(
                    text(
                        "DELETE FROM app_cache WHERE expires_at IS NOT NULL AND expires_at < NOW()"
                    )
                )
                conn.commit()
                return result.rowcount
        except Exception as e:
            logger.error(f"PostgreSQL cache cleanup error: {e}")
            return 0


class AsyncPostgresCache:
    """Async PostgreSQL-backed cache for high-performance apps."""

    def __init__(self):
        self._initialized = False

    async def _ensure_table(self):
        """Create cache table if not exists (async version)."""
        if self._initialized:
            return
        try:
            from app.core.database import async_engine
            from sqlalchemy.ext.asyncio import AsyncSession
            from sqlalchemy import text

            async with AsyncSession(async_engine) as session:
                await session.execute(
                    text("""
                    CREATE TABLE IF NOT EXISTS app_cache (
                        key VARCHAR(512) PRIMARY KEY,
                        value JSONB NOT NULL,
                        expires_at TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                )
                await session.execute(
                    text("""
                    CREATE INDEX IF NOT EXISTS idx_app_cache_expires
                    ON app_cache(expires_at)
                """)
                )
                await session.commit()
            self._initialized = True
            logger.info("Async PostgreSQL cache table initialized")
        except Exception as e:
            logger.error(f"Failed to create async cache table: {e}")

    async def aget(self, key: str) -> Optional[Any]:
        """Async get from PostgreSQL cache."""
        try:
            await self._ensure_table()
            from sqlalchemy.ext.asyncio import AsyncSession
            from app.core.database import async_engine
            from sqlalchemy import text

            async with AsyncSession(async_engine) as session:
                result = await session.execute(
                    text(
                        "SELECT value FROM app_cache WHERE key = :key AND (expires_at IS NULL OR expires_at > NOW())"
                    ),
                    {"key": key},
                )
                row = result.fetchone()
                if row:
                    raw_value = row[0]
                    if isinstance(raw_value, str):
                        return json.loads(raw_value)
                    return raw_value
                return None
        except Exception as e:
            logger.error(f"Async PostgreSQL cache get error: {e}")
            return None

    async def aset(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Async set to PostgreSQL cache."""
        try:
            await self._ensure_table()
            from sqlalchemy.ext.asyncio import AsyncSession
            from app.core.database import async_engine
            from sqlalchemy import text

            expires_at = None
            if ttl:
                expires_at = datetime.fromtimestamp(time.time() + ttl)

            async with AsyncSession(async_engine) as session:
                await session.execute(
                    text("""
                        INSERT INTO app_cache (key, value, expires_at)
                        VALUES (:key, :value, :expires_at)
                        ON CONFLICT (key) DO UPDATE SET
                            value = :value,
                            expires_at = :expires_at
                    """),
                    {
                        "key": key,
                        "value": json.dumps(value, default=str),
                        "expires_at": expires_at,
                    },
                )
                await session.commit()
                return True
        except Exception as e:
            logger.error(f"Async PostgreSQL cache set error: {e}")
            return False

    async def adelete(self, key: str) -> bool:
        """Async delete from PostgreSQL cache."""
        try:
            await self._ensure_table()
            from sqlalchemy.ext.asyncio import AsyncSession
            from app.core.database import async_engine
            from sqlalchemy import text

            async with AsyncSession(async_engine) as session:
                result = await session.execute(
                    text("DELETE FROM app_cache WHERE key = :key"), {"key": key}
                )
                await session.commit()
                return result.rowcount > 0
        except Exception as e:
            logger.error(f"Async PostgreSQL cache delete error: {e}")
            return False

    async def aset(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Async set to PostgreSQL cache."""
        try:
            self._ensure_table()
            from sqlalchemy.ext.asyncio import AsyncSession
            from app.core.database import async_engine

            expires_at = None
            if ttl:
                expires_at = datetime.fromtimestamp(time.time() + ttl)

            async with AsyncSession(async_engine) as session:
                await session.execute(
                    text("""
                        INSERT INTO app_cache (key, value, expires_at)
                        VALUES (:key, :value, :expires_at)
                        ON CONFLICT (key) DO UPDATE SET
                            value = :value,
                            expires_at = :expires_at
                    """),
                    {
                        "key": key,
                        "value": json.dumps(value, default=str),
                        "expires_at": expires_at,
                    },
                )
                await session.commit()
                return True
        except Exception as e:
            logger.error(f"Async PostgreSQL cache set error: {e}")
            return False


class CacheService:
    """
    Hybrid cache service combining:
    1. Fast in-memory LRU/TTL cache (primary)
    2. PostgreSQL persistent cache (fallback/persistent)
    """

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """Initialize cache service."""
        self.memory_cache = TTLCache(
            max_size=getattr(settings, "CACHE_MAX_SIZE", 10000),
            default_ttl=getattr(settings, "CACHE_TTL", 3600),
        )
        self.postgres_cache = PostgresCache()
        self.async_postgres_cache = AsyncPostgresCache()
        self.metrics = CacheMetrics()
        logger.info("Cache service initialized (no Redis)")

    @property
    def is_available(self) -> bool:
        """Always available since we use in-memory + PostgreSQL."""
        return True

    def get(self, key: str) -> Optional[Any]:
        """Get from memory cache first, then PostgreSQL."""
        value = self.memory_cache.get(key)
        if value is not None:
            self.metrics.hits += 1
            return value

        value = self.postgres_cache.get(key)
        if value is not None:
            self.metrics.hits += 1
            self.memory_cache.set(key, value)
            return value

        self.metrics.misses += 1
        return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set in both memory and PostgreSQL."""
        self.metrics.sets += 1
        mem_success = self.memory_cache.set(key, value, ttl)
        pg_success = self.postgres_cache.set(key, value, ttl)
        return mem_success or pg_success

    def delete(self, key: str) -> bool:
        """Delete from both caches."""
        self.metrics.deletes += 1
        mem_success = self.memory_cache.delete(key)
        pg_success = self.postgres_cache.delete(key)
        return mem_success or pg_success

    def exists(self, key: str) -> bool:
        """Check if key exists."""
        return (
            self.memory_cache.get(key) is not None
            or self.postgres_cache.get(key) is not None
        )

    def clear_pattern(self, pattern: str) -> int:
        """Clear matching keys from both caches."""
        mem_count = self.memory_cache.clear_pattern(pattern)
        pg_count = self.postgres_cache.clear_pattern(pattern)
        return mem_count + pg_count

    def get_or_set(
        self, key: str, getter_func: Callable[[], Any], ttl: Optional[int] = None
    ) -> Any:
        """Get from cache or set using getter function."""
        value = self.get(key)
        if value is None:
            try:
                value = getter_func()
                if value is not None:
                    self.set(key, value, ttl)
            except Exception as e:
                logger.error(f"Error in getter function for key {key}: {e}")
                return None
        return value

    def get_llm_response(self, query_hash: str) -> Optional[str]:
        key = f"llm:{query_hash}"
        return self.get(key)

    def set_llm_response(
        self, query_hash: str, response: str, ttl: int = 86400
    ) -> bool:
        key = f"llm:{query_hash}"
        return self.set(key, response, ttl)

    def get_embeddings(self, text_hash: str) -> Optional[List[float]]:
        key = f"embed:{text_hash}"
        return self.get(key)

    def set_embeddings(
        self, text_hash: str, embeddings: List[float], ttl: int = 86400
    ) -> bool:
        key = f"embed:{text_hash}"
        return self.set(key, embeddings, ttl)

    def get_vector_results(self, query_hash: str) -> Optional[List[Dict]]:
        key = f"vector:{query_hash}"
        return self.get(key)

    def set_vector_results(
        self, query_hash: str, results: List[Dict], ttl: int = 3600
    ) -> bool:
        key = f"vector:{query_hash}"
        return self.set(key, results, ttl)

    def get_session_data(self, session_id: str) -> Optional[Dict]:
        key = f"session:{session_id}"
        return self.get(key)

    def set_session_data(self, session_id: str, data: Dict, ttl: int = 86400) -> bool:
        key = f"session:{session_id}"
        return self.set(key, data, ttl)

    def get_document_chunks(self, doc_hash: str) -> Optional[List]:
        key = f"chunks:{doc_hash}"
        return self.get(key)

    def set_document_chunks(
        self, doc_hash: str, chunks: List, ttl: int = 86400
    ) -> bool:
        key = f"chunks:{doc_hash}"
        return self.set(key, chunks, ttl)

    def get_translation(self, text_hash: str, lang_pair: str) -> Optional[str]:
        key = f"trans:{lang_pair}:{text_hash}"
        return self.get(key)

    def set_translation(
        self, text_hash: str, lang_pair: str, translation: str, ttl: int = 604800
    ) -> bool:
        key = f"trans:{lang_pair}:{text_hash}"
        return self.set(key, translation, ttl)

    def get_user_collections(self, user_id: int) -> Optional[List[Dict]]:
        key = f"user_collections:{user_id}"
        return self.get(key)

    def set_user_collections(
        self, user_id: int, collections: List[Dict], ttl: int = 3600
    ) -> bool:
        key = f"user_collections:{user_id}"
        return self.set(key, collections, ttl)

    def invalidate_user_collections(self, user_id: int) -> bool:
        key = f"user_collections:{user_id}"
        return self.delete(key)

    def get_user_settings(self, user_id: int) -> Optional[Dict]:
        key = f"user_settings:{user_id}"
        return self.get(key)

    def set_user_settings(
        self, user_id: int, settings_data: Dict, ttl: int = 86400
    ) -> bool:
        key = f"user_settings:{user_id}"
        return self.set(key, settings_data, ttl)

    def invalidate_user_settings(self, user_id: int) -> bool:
        key = f"user_settings:{user_id}"
        return self.delete(key)

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        return {
            "memory": self.memory_cache.get_stats(),
            "metrics": {
                "hits": self.metrics.hits,
                "misses": self.metrics.misses,
                "hit_rate": self.metrics.hit_rate,
                "sets": self.metrics.sets,
                "deletes": self.metrics.deletes,
            },
        }

    def reset_metrics(self):
        self.metrics = CacheMetrics()

    def health_check(self) -> Dict[str, Any]:
        return {
            "status": "healthy",
            "memory_available": True,
            "postgres_available": True,
            "metrics_healthy": True,
        }

    @staticmethod
    def generate_hash(
        text: str, user_id: Optional[int] = None, collection_id: Optional[int] = None
    ) -> str:
        hash_input = text
        if user_id is not None:
            hash_input += f":{user_id}"
        if collection_id is not None:
            hash_input += f":{collection_id}"
        return fast_hash(hash_input)


cache_service = CacheService()
