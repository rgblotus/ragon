"""
Cached Embeddings - Wrapper for HuggingFaceEmbeddings with advanced tiered caching.
"""

import hashlib
import logging
from typing import List

from app.core.cache_service import cache_service
from app.rag.config import settings
from app.rag.utils import get_event_loop

logger = logging.getLogger(__name__)


def fast_hash(text: str) -> str:
    """Fast hashing using blake2b."""
    return hashlib.blake2b(text.encode(), digest_size=16).hexdigest()


class CachedEmbeddings:
    """Enhanced wrapper for HuggingFaceEmbeddings with advanced tiered caching."""

    def __init__(self, embeddings_model):
        self.embeddings_model = embeddings_model
        self._batch_cache_ttl = settings.REDIS_TTL_EMBEDDINGS

    def embed_query(self, text: str) -> List[float]:
        """Embed query with advanced tiered caching."""
        text_hash = fast_hash(text)

        def compute_embedding():
            logger.debug(f"Computing embedding for: {text[:50]}...")
            embedding = self.embeddings_model.embed_query(text)
            logger.debug(
                f"Embedding first 5 values: {embedding[:5] if len(embedding) >= 5 else embedding}"
            )
            return embedding

        embedding = cache_service.get_or_set(
            f"embed:{text_hash}", compute_embedding, ttl=settings.REDIS_TTL_EMBEDDINGS
        )

        if embedding is None:
            logger.warning(f"Failed to compute or cache embedding for: {text[:50]}")
            embedding = self.embeddings_model.embed_query(text)

        return embedding

    async def aembed_query(self, text: str) -> List[float]:
        """Async embed query with advanced tiered caching."""
        text_hash = fast_hash(text)

        embedding = cache_service.get(f"embed:{text_hash}")
        if embedding is not None:
            return embedding

        loop = get_event_loop()
        embedding = await loop.run_in_executor(
            None, lambda: self.embeddings_model.embed_query(text)
        )

        cache_service.set(
            f"embed:{text_hash}", embedding, ttl=settings.REDIS_TTL_EMBEDDINGS
        )

        return embedding

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Embed documents with batch caching optimization."""
        if not texts:
            return []

        batch_key = fast_hash("".join(texts))
        cache_key = f"batch_embed:{batch_key}"

        cached_batch = cache_service.get(cache_key)
        if cached_batch is not None:
            logger.debug(f"Batch embedding cache hit for {len(texts)} texts")
            return cached_batch

        embeddings = []
        uncached_texts = []
        uncached_indices = []

        for i, text in enumerate(texts):
            text_hash = fast_hash(text)
            cached = cache_service.get(f"embed:{text_hash}")
            if cached is not None:
                embeddings.append(cached)
            else:
                embeddings.append(None)
                uncached_texts.append(text)
                uncached_indices.append(i)

        if uncached_texts:
            logger.debug(f"Computing {len(uncached_texts)} uncached embeddings")
            computed_embeddings = self.embeddings_model.embed_documents(uncached_texts)

            for text, embedding in zip(uncached_texts, computed_embeddings):
                text_hash = fast_hash(text)
                cache_service.set(
                    f"embed:{text_hash}", embedding, ttl=settings.REDIS_TTL_EMBEDDINGS
                )

            for idx, embedding in zip(uncached_indices, computed_embeddings):
                embeddings[idx] = embedding

        cache_service.set(cache_key, embeddings, ttl=self._batch_cache_ttl)

        return embeddings

    async def aembed_documents(self, texts: List[str]) -> List[List[float]]:
        """Async embed documents with batch caching optimization."""
        if not texts:
            return []

        batch_key = fast_hash("".join(texts))
        cache_key = f"batch_embed:{batch_key}"

        cached_batch = cache_service.get(cache_key)
        if cached_batch is not None:
            return cached_batch

        loop = get_event_loop()
        embeddings = await loop.run_in_executor(
            None,
            lambda: self.embed_documents(texts),
        )

        return embeddings

    def __getattr__(self, name):
        """Delegate other attributes to the underlying model."""
        return getattr(self.embeddings_model, name)
