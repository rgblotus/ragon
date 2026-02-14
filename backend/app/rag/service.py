"""
RAG Service - Main service coordinating retrieval, caching, and AI responses.
"""

import asyncio
import json
import logging
import os
import time
from typing import Any, Dict, List, Optional

import torch
from fastapi import HTTPException
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_ollama import ChatOllama
from langchain_milvus import Milvus

from app.core.cache_service import cache_service, fast_hash, fast_hash_bytes
from app.rag.services.chains import ChainFactory
from app.rag.config import settings
from app.rag.helpers.embeddings import CachedEmbeddings
from app.rag.processors.processor import DocumentProcessor
from app.rag.services.retrieval import (
    query_analyzer,
    query_expansion,
    retrieval_metrics,
)
from app.rag.helpers import get_event_loop
from app.rag.visualization import DocumentVisualizer

logger = logging.getLogger(__name__)


class RagService:
    """Main RAG service coordinating all retrieval and generation operations."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RagService, cls).__new__(cls)
            cls._instance._embeddings = None
            cls._instance._llm = None
            cls._instance._vector_store = None
            cls._instance._semantic_cache_store = None
            cls._instance.processor = DocumentProcessor()
            cls._instance._chain_factory = None
            cls._instance._visualizer = None
            cls._instance._setup_cache_warming()
        return cls._instance

    def _setup_cache_warming(self):
        """Setup cache warming tasks for hot data."""
        logger.info("Cache warming is disabled (using in-memory + PostgreSQL cache)")

    @property
    def embeddings(self):
        if self._embeddings is None:
            start_time = time.time()
            is_cuda = torch.cuda.is_available()
            device = "cuda" if is_cuda else "cpu"
            print(f"--- RAG ENGINE: Lazy Loading Embeddings on {device.upper()} ---")

            # Use local model path
            local_model_path = "models/embedding/sentence-transformers_all-MiniLM-L6-v2"
            logger.info(f"Loading embeddings model from local path: {local_model_path}")

            base_embeddings = HuggingFaceEmbeddings(
                model_name=local_model_path,
                model_kwargs={"device": device},
                encode_kwargs={
                    "normalize_embeddings": True,
                    "batch_size": settings.RAG_EMBEDDING_BATCH_SIZE,
                },
            )
            load_time = time.time() - start_time
            logger.info(f"Embeddings model loaded in {load_time:.2f}s")
            self._embeddings = CachedEmbeddings(base_embeddings)
        return self._embeddings

    @property
    def llm(self):
        if self._llm is None:
            print(f"--- RAG ENGINE: Lazy Loading LLM (Ollama) ---")
            self._llm = ChatOllama(
                model=settings.OLLAMA_MODEL,
                base_url=settings.OLLAMA_BASE_URL,
            )
        return self._llm

    @property
    def chain_factory(self):
        if self._chain_factory is None:
            self._chain_factory = ChainFactory(self.llm, self.embeddings)
        return self._chain_factory

    @property
    def visualizer(self):
        if self._visualizer is None:
            self._visualizer = DocumentVisualizer(self.vector_store)
        return self._visualizer

    @property
    def vector_store(self) -> Milvus:
        if self._vector_store is None:
            self._vector_store = self._init_milvus_store("LangChainCollection")
        return self._vector_store

    @property
    def semantic_cache_store(self) -> Milvus:
        if self._semantic_cache_store is None:
            self._semantic_cache_store = self._init_milvus_store(
                settings.RAG_SEMANTIC_CACHE_COLLECTION
            )
        return self._semantic_cache_store

    def reset_vector_store(self, force: bool = False):
        if self._vector_store is not None:
            try:
                logger.info("Attempting to drop Milvus collection for schema reset...")
                self._vector_store.col.drop()
                logger.info("Milvus collection dropped successfully")
            except Exception as e:
                logger.warning(f"Could not drop Milvus collection: {e}")
                if force:
                    logger.error("Force reset requested but cannot drop collection")
                    return
        self._vector_store = None
        self._drop_old_on_next_init = True
        logger.info("Vector store reset - will recreate on next access")

    _drop_old_on_next_init: bool = False

    def _init_milvus_store(self, collection_name: str) -> Milvus:
        print(f"--- RAG ENGINE: Loading Milvus Store ({collection_name}) ---")

        milvus_logger = logging.getLogger("langchain_milvus.vectorstores.milvus")
        original_level = milvus_logger.level
        milvus_logger.setLevel(logging.ERROR)

        drop_old = self._drop_old_on_next_init
        self._drop_old_on_next_init = False

        try:
            connection_args = {
                "host": settings.MILVUS_HOST,
                "port": settings.MILVUS_PORT,
            }

            return Milvus(
                embedding_function=self.embeddings,
                connection_args=connection_args,
                collection_name=collection_name,
                index_params={
                    "index_type": "IVF_FLAT",
                    "metric_type": "IP",
                    "params": {"nlist": settings.RAG_MILVUS_NLIST},
                },
                drop_old=drop_old,
                auto_id=True,
                vector_field="vector",
            )
        finally:
            milvus_logger.setLevel(original_level)

    def _get_cache_key(
        self, query: str, user_id: int, collection_id: int, top_k: int
    ) -> str:
        key_data = f"{query}:{user_id}:{collection_id}:{top_k}"
        return fast_hash(key_data)

    def _compute_context_from_docs(self, docs: List) -> str:
        if not docs:
            logger.warning(
                "No documents provided to _compute_context_from_docs - returning empty context"
            )
            return ""

        formatted = []
        for doc in docs:
            source = doc.metadata.get("source", "Unknown")
            content = doc.page_content
            formatted.append(f"[Source: {source}]\n{content}")

        context = "\n\n".join(formatted)
        logger.info(
            f"=== DEBUG: Context computed from {len(docs)} documents, total length: {len(context)} chars ==="
        )
        logger.debug(f"Context preview (first 200 chars): {context[:200]}...")

        return context

    def _get_cached_docs(self, cache_key: str) -> Optional[List]:
        docs = cache_service.get(f"vector:{cache_key}")
        if docs is not None:
            logger.debug(f"Tiered cache hit for vector results: {cache_key}")
        return docs

    def _cache_docs(self, cache_key: str, docs: List):
        if cache_service.set(
            f"vector:{cache_key}", docs, ttl=settings.REDIS_TTL_VECTOR_RESULTS
        ):
            logger.debug(f"Tiered cached vector results: {cache_key}")
        else:
            logger.debug(f"Failed to cache vector results: {cache_key}")

    def _get_llm_response_cache_key(
        self,
        query: str,
        context_str: str,
        temperature: float,
        custom_prompt: str,
        user_id: int,
        collection_id: int,
    ) -> str:
        key_data = f"{query}:{context_str}:{temperature}:{custom_prompt}:{user_id}:{collection_id}"
        return fast_hash(key_data)

    def _get_cached_llm_response(self, cache_key: str) -> Optional[str]:
        response = cache_service.get(f"llm:{cache_key}")
        if response is not None:
            logger.debug(f"Tiered cache hit for LLM response: {cache_key[:20]}...")
        return response

    def _cache_llm_response(self, cache_key: str, response: str):
        if cache_service.set(
            f"llm:{cache_key}", response, ttl=settings.REDIS_TTL_LLM_RESPONSE
        ):
            logger.debug(f"Tiered cached LLM response: {cache_key[:20]}...")
        else:
            logger.debug(f"Failed to cache LLM response: {cache_key[:20]}...")

    def _process_documents_for_sources(self, docs: List) -> List[Dict]:
        sources = []

        for doc in docs:
            source = doc.metadata.get("source", "Unknown")
            score = doc.metadata.get("score", 0.0)
            similarity_score = score

            logger.debug(
                f"Source: {source}, score: {score}, similarity_score: {similarity_score}, content_length: {len(doc.page_content)}"
            )

            sources.append(
                {
                    "source": source,
                    "similarity_score": similarity_score,
                    "content": doc.page_content[:500],
                }
            )

        source_map = {}
        for source in sources:
            doc_name = source["source"]
            score = source["similarity_score"]
            if (
                doc_name not in source_map
                or score > source_map[doc_name]["similarity_score"]
            ):
                source_map[doc_name] = source

        deduplicated_sources = list(source_map.values())

        return self._filter_sources_by_threshold(deduplicated_sources)

    def _get_retriever(self, user_id: int, collection_id: int, top_k: int):
        logger.info(
            f"=== DEBUG: Creating retriever for user_id={user_id}, collection_id={collection_id}, top_k={top_k} ==="
        )

        try:
            expr = f"user_id == {user_id} and collection_id == {collection_id}"
            logger.info(f"=== DEBUG: Retriever expression: {expr} ===")

            # Test direct search with a test query to verify filter works
            logger.info(f"=== DEBUG: Testing direct similarity_search_with_score ===")
            try:
                test_results = self.vector_store.similarity_search_with_score(
                    "test", k=3, expr=expr
                )
                logger.info(
                    f"=== DEBUG: Direct search returned {len(test_results)} results ==="
                )
                for i, (doc, score) in enumerate(test_results[:3]):
                    logger.info(
                        f"  Result {i}: score={score:.4f}, source={doc.metadata.get('source')}"
                    )
            except Exception as search_err:
                logger.error(f"=== DEBUG: Direct search error: {search_err} ===")

            # Use standard retriever - scores are handled in document processing
            retriever = self.vector_store.as_retriever(
                search_kwargs={
                    "k": top_k,
                    "expr": expr,
                }
            )

            test_docs = retriever.invoke("test query")
            logger.info(
                f"=== DEBUG: Test query returned {len(test_docs)} documents ==="
            )

            return retriever
        except Exception as e:
            logger.error(f"=== DEBUG: Error creating retriever: {e} ===")
            import traceback

            traceback.print_exc()
            logger.warning("Falling back to unfiltered retriever")
            return self.vector_store.as_retriever(search_kwargs={"k": top_k})

    def _get_documents_for_chain(
        self, query: str, user_id: int, collection_id: int, top_k: int
    ) -> List:
        logger.info(f"=== _get_documents_for_chain START ===")
        logger.info(f"  query: {query[:50]}...")
        logger.info(
            f"  user_id: {user_id}, collection_id: {collection_id}, top_k: {top_k}"
        )

        try:
            expr = f"user_id == {user_id} and collection_id == {collection_id}"
            logger.info(f"  Using filter expression: {expr}")

            # Use similarity_search_with_score directly to get scores
            logger.info(f"  Invoking similarity_search_with_score...")
            results = self.vector_store.similarity_search_with_score(
                query, k=top_k, expr=expr
            )

            logger.info(f"  Retrieved {len(results)} documents with scores")

            docs = []
            for i, (doc, score) in enumerate(results):
                # Add score to metadata
                doc.metadata["score"] = score
                docs.append(doc)
                logger.info(
                    f"  Doc {i}: score={score:.4f}, source={doc.metadata.get('source')}"
                )

            logger.info(f"=== _get_documents_for_chain END ===")
            return docs

        except Exception as e:
            logger.error(f"Error in _get_documents_for_chain: {e}")
            import traceback

            traceback.print_exc()
            # Fallback to regular search without score
            try:
                retriever = self.vector_store.as_retriever(
                    search_kwargs={"k": top_k, "expr": expr}
                )
                return retriever.invoke(query)
            except Exception as fallback_error:
                logger.error(f"Fallback also failed: {fallback_error}")
                return []

    def _get_processed_sources_and_docs(
        self, query: str, user_id: int, collection_id: int, top_k: int
    ) -> tuple:
        docs = self._get_documents_for_chain(query, user_id, collection_id, top_k)
        filtered_sources = self._process_documents_for_sources(docs)
        return filtered_sources, docs

    def _get_dynamic_retrieval_params(self, query: str, base_top_k: int):
        if not settings.RAG_DYNAMIC_RETRIEVAL_ENABLED:
            from app.rag.retrieval import RetrievalParams, QueryComplexity

            return RetrievalParams(
                top_k=min(base_top_k, settings.RAG_MAX_TOP_K),
                min_score=settings.RAG_MIN_SIMILARITY_THRESHOLD,
                expand_query=False,
                complexity=QueryComplexity.MODERATE,
                reasoning="Dynamic retrieval disabled, using defaults",
            )

        params = query_analyzer.get_optimal_params(
            query,
            base_top_k=min(base_top_k, settings.RAG_MAX_TOP_K),
            base_min_score=settings.RAG_MIN_SIMILARITY_THRESHOLD,
        )

        params.top_k = min(params.top_k, settings.RAG_MAX_TOP_K)
        params.min_score = max(params.min_score, settings.RAG_MIN_SIMILARITY_THRESHOLD)

        return params

    def _deduplicate_and_filter_docs(self, docs: List, min_score: float) -> List:
        seen_content = set()
        filtered_docs = []

        for doc in docs:
            score = doc.metadata.get("score", 0.0)
            similarity = score

            if similarity < min_score:
                continue

            content_key = doc.page_content[:100].strip()
            if content_key not in seen_content:
                seen_content.add(content_key)
                filtered_docs.append(doc)

        filtered_docs.sort(key=lambda x: x.metadata.get("score", 0.0), reverse=True)

        return filtered_docs

    def _filter_sources_by_threshold(
        self, sources: List[Dict], min_score: float = 0.0, top_k: int = 5
    ) -> List[Dict]:
        filtered = [s for s in sources if s["similarity_score"] >= min_score]
        return sorted(filtered, key=lambda x: x["similarity_score"], reverse=True)[
            :top_k
        ]

    async def _check_semantic_cache(
        self, query: str, user_id: int
    ) -> Optional[Dict[str, Any]]:
        if not settings.RAG_SEMANTIC_CACHE_ENABLED:
            return None

        try:
            expr = f"user_id == {user_id}"
            loop = get_event_loop()

            results = await loop.run_in_executor(
                None,
                lambda: self.semantic_cache_store.similarity_search_with_score(
                    query, k=1, expr=expr
                ),
            )

            if results:
                doc, score = results[0]
                if score >= settings.RAG_SEMANTIC_CACHE_THRESHOLD:
                    logger.info(
                        f"Semantic cache hit for query: {query[:50]}... (score: {score:.4f})"
                    )
                    return {
                        "response": doc.metadata.get("response"),
                        "sources": json.loads(doc.metadata.get("sources", "[]")),
                        "cached": True,
                        "score": score,
                    }

            return None
        except Exception as e:
            logger.error(f"Error checking semantic cache: {e}")
            return None

    async def _save_to_semantic_cache(
        self, query: str, response: str, sources: List[Dict], user_id: int
    ):
        if not settings.RAG_SEMANTIC_CACHE_ENABLED:
            return

        try:
            from langchain_core.documents import Document as LCDocument

            doc = LCDocument(
                page_content=query,
                metadata={
                    "user_id": user_id,
                    "response": response,
                    "sources": json.dumps(sources),
                    "timestamp": time.time(),
                },
            )

            loop = get_event_loop()
            await loop.run_in_executor(
                None, lambda: self.semantic_cache_store.add_documents([doc])
            )
            logger.debug(f"Saved query to semantic cache: {query[:50]}...")
        except Exception as e:
            logger.error(f"Error saving to semantic cache: {e}")

    def ingest_document(
        self,
        file_path: str,
        user_id: int,
        collection_id: int,
        progress_service=None,
        task_id: str = None,
    ):
        file_size = os.path.getsize(file_path)
        logger.debug(f"Processing file of size: {file_size} bytes")

        if file_size > 20 * 1024 * 1024:
            batch_size = 25
        elif file_size > 10 * 1024 * 1024:
            batch_size = 50
        else:
            batch_size = settings.RAG_INGEST_BATCH_SIZE

        logger.debug(f"Using batch size: {batch_size}")
        logger.debug(f"Processing chunks directly (no caching) for {file_path}")
        chunks = self.processor.process(
            file_path, user_id, collection_id, progress_service, task_id
        )

        if progress_service:
            asyncio.run(
                progress_service.emit_progress(
                    user_id, 60, "Embedding started", task_id=task_id or file_path
                )
            )

        if not chunks:
            return 0

        if progress_service:
            asyncio.run(
                progress_service.emit_progress(
                    user_id, 80, "Vectors stored", task_id=task_id or file_path
                )
            )

        total_batches = len(list(range(0, len(chunks), batch_size)))
        for i, batch_start in enumerate(range(0, len(chunks), batch_size)):
            batch = chunks[batch_start : batch_start + batch_size]
            self.vector_store.add_documents(batch)
            if progress_service:
                progress = 80 + int((i / total_batches) * 20)
                try:
                    asyncio.get_running_loop()
                except RuntimeError:
                    asyncio.run(
                        progress_service.emit_progress(
                            user_id,
                            progress,
                            f"Storing batch {i + 1}/{total_batches}",
                            task_id=task_id or file_path,
                        )
                    )

        if progress_service:
            try:
                asyncio.get_running_loop()
            except RuntimeError:
                asyncio.run(
                    progress_service.emit_progress(
                        user_id,
                        100,
                        "Vector storage completed",
                        task_id=task_id or file_path,
                    )
                )

        return len(chunks)

    def _get_chain(self, retriever, temperature: float, custom_prompt: str = ""):
        return self.chain_factory.create_rag_chain(
            retriever, temperature, custom_prompt
        )

    def _get_chain_from_context(
        self, context_str: str, temperature: float, custom_prompt: str = ""
    ):
        return self.chain_factory.create_context_chain(
            context_str, temperature, custom_prompt
        )

    def _get_lightweight_chain(self, temperature: float, custom_prompt: str = ""):
        return self.chain_factory.create_lightweight_chain(temperature, custom_prompt)

    async def chat_with_data(
        self,
        query: str,
        user_id: int,
        collection_id: int,
        temperature: Optional[float] = None,
        top_k: Optional[int] = None,
        custom_prompt: str = "",
    ) -> Dict[str, Any]:
        temperature = (
            temperature if temperature is not None else settings.RAG_DEFAULT_TEMPERATURE
        )

        try:
            logger.debug(f"Starting async chat_with_data for query: {query[:50]}...")

            cached_result = await self._check_semantic_cache(query, user_id)
            if cached_result:
                return cached_result

            base_top_k = top_k if top_k is not None else settings.RAG_DEFAULT_TOP_K
            retrieval_params = self._get_dynamic_retrieval_params(query, base_top_k)

            logger.debug(
                f"Using dynamic retrieval params: top_k={retrieval_params.top_k}, min_score={retrieval_params.min_score}, expand={retrieval_params.expand_query}"
            )

            search_queries = [query]
            if retrieval_params.expand_query and settings.RAG_QUERY_EXPANSION_ENABLED:
                expanded = query_expansion.expand_query(query)
                if len(expanded) > 1:
                    search_queries = expanded[:3]
                    logger.debug(
                        f"Using expanded queries: {len(search_queries)} variations"
                    )

            all_docs = []
            similarity_scores = []

            loop = get_event_loop()

            for search_query in search_queries:
                docs = await loop.run_in_executor(
                    None,
                    lambda q=search_query: self._get_documents_for_chain(
                        q, user_id, collection_id, retrieval_params.top_k
                    ),
                )
                all_docs.extend(docs)

                for doc in docs:
                    score = doc.metadata.get("score", 0.0)
                    similarity = score
                    similarity_scores.append(similarity)

            filtered_docs = self._deduplicate_and_filter_docs(
                all_docs, retrieval_params.min_score
            )

            filtered_sources = self._process_documents_for_sources(filtered_docs)
            filtered_sources = self._filter_sources_by_threshold(
                filtered_sources, retrieval_params.min_score, retrieval_params.top_k
            )

            context_str = self._compute_context_from_docs(filtered_docs)

            retrieval_metrics.log_retrieval(
                query, retrieval_params, filtered_docs, similarity_scores
            )

            llm_cache_key = self._get_llm_response_cache_key(
                query, context_str, temperature, custom_prompt, user_id, collection_id
            )
            cached_response = cache_service.get(f"llm:{llm_cache_key}")

            if cached_response is not None:
                logger.debug(f"Redis cache hit for LLM response: {query[:50]}...")
                response = cached_response
            else:
                logger.debug(
                    f"Creating RAG chain with pre-computed context for query: {query[:50]}..."
                )
                rag_chain = self._get_chain_from_context(
                    context_str, temperature, custom_prompt
                )
                response = await rag_chain.ainvoke(query)

                self._cache_llm_response(llm_cache_key, response)

                await self._save_to_semantic_cache(
                    query, response, filtered_sources, user_id
                )

            return {
                "response": response,
                "sources": filtered_sources,
                "retrieval_info": {
                    "complexity": retrieval_params.complexity.value,
                    "top_k_used": retrieval_params.top_k,
                    "min_score_used": retrieval_params.min_score,
                    "query_expanded": retrieval_params.expand_query,
                    "docs_retrieved": len(filtered_docs),
                },
            }
        except Exception as e:
            logger.error(f"Error in async chat_with_data: {str(e)}")
            return {"response": f"Error: {str(e)}", "sources": []}

    async def stream_chat_with_data(
        self,
        query: str,
        user_id: int,
        collection_id: int,
        temperature: Optional[float] = None,
        top_k: Optional[int] = None,
        custom_prompt: str = "",
        fetch_sources: bool = False,
    ):
        start_time = time.time()

        logger.info(
            f"Stream chat request: query='{query[:50]}...', user_id={user_id}, collection_id={collection_id}, temperature={temperature}, top_k={top_k}, fetch_sources={fetch_sources}"
        )

        temperature = (
            temperature if temperature is not None else settings.RAG_DEFAULT_TEMPERATURE
        )
        base_top_k = top_k if top_k is not None else settings.RAG_DEFAULT_TOP_K

        try:
            logger.info(
                f"Starting async stream_chat_with_data for query: {query[:50]}..."
            )

            cached_result = await self._check_semantic_cache(query, user_id)
            if cached_result:
                if fetch_sources and cached_result["sources"]:
                    sources_data = {
                        "type": "sources",
                        "sources": cached_result["sources"],
                    }
                    yield f"data: {json.dumps(sources_data)}\n\n"

                words = cached_result["response"].split(" ")
                for i, word in enumerate(words):
                    yield word + (" " if i < len(words) - 1 else "")
                    if i % 5 == 0:
                        await asyncio.sleep(0.01)
                return

            if fetch_sources:
                loop = get_event_loop()
                retrieval_params = self._get_dynamic_retrieval_params(query, base_top_k)

                docs = await loop.run_in_executor(
                    None,
                    lambda: self._get_documents_for_chain(
                        query, user_id, collection_id, retrieval_params.top_k
                    ),
                )

                logger.info(f"=== DEBUG: Retrieved {len(docs)} raw documents ===")
                for i, doc in enumerate(docs):
                    score = doc.metadata.get("score", "N/A")
                    logger.info(
                        f"  Doc {i}: score={score}, source={doc.metadata.get('source', 'N/A')}, content_preview={doc.page_content[:100]}..."
                    )

                filtered_docs = self._deduplicate_and_filter_docs(
                    docs, retrieval_params.min_score
                )

                logger.info(
                    f"=== DEBUG: After filtering: {len(filtered_docs)} documents ==="
                )
                for i, doc in enumerate(filtered_docs):
                    score = doc.metadata.get("score", "N/A")
                    logger.info(
                        f"  Filtered Doc {i}: score={score}, source={doc.metadata.get('source', 'N/A')}"
                    )

                filtered_sources = self._process_documents_for_sources(filtered_docs)
                filtered_sources = self._filter_sources_by_threshold(
                    filtered_sources, retrieval_params.min_score, retrieval_params.top_k
                )

                logger.info(f"=== DEBUG: Processed {len(filtered_sources)} sources ===")

                logger.info(
                    f"Sending {len(filtered_sources)} sources for query: {query[:50]}..."
                )
                if filtered_sources:
                    sources_data = {"type": "sources", "sources": filtered_sources}
                    yield f"data: {json.dumps(sources_data)}\n\n"

                context_str = self._compute_context_from_docs(filtered_docs)
                logger.info(
                    f"Context length: {len(context_str)}, first 500: {context_str[:500] if context_str else 'EMPTY'}"
                )
                logger.debug(
                    f"Creating RAG chain with context for query: {query[:50]}..."
                )
                rag_chain = self._get_chain_from_context(
                    context_str, temperature, custom_prompt
                )
            else:
                rag_chain = self._get_lightweight_chain(temperature, custom_prompt)
                filtered_sources = []

            full_response = ""
            async for chunk in rag_chain.astream(query):
                full_response += chunk
                # Wrap response chunks in SSE format
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"

            if full_response and not cached_result:
                await self._save_to_semantic_cache(
                    query, full_response, filtered_sources, user_id
                )

        except Exception as e:
            logger.error(f"Error during async streaming: {str(e)}")
            error_data = {
                "type": "error",
                "message": f"Error during streaming: {str(e)}",
            }
            yield f"data: {json.dumps(error_data)}\n\n"

    def delete_document_chunks(
        self, user_id: int, filename: str, collection_id: int = None
    ):
        try:
            if not self._vector_store:
                print("Vector store not initialized")
                return False

            collection_name = "LangChainCollection"

            expr = f'user_id == {user_id} and source == "{filename}"'
            if collection_id is not None:
                expr += f" and collection_id == {collection_id}"

            try:
                print(
                    f"Attempting to delete document chunks: {filename} for user {user_id} from collection {collection_name}"
                )
                self.vector_store.delete(expr=expr)
                print(f"Successfully deleted document chunks: {filename}")

                self._invalidate_document_caches(user_id, filename, collection_id)

                return True
            except Exception as delete_error:
                error_msg = str(delete_error).lower()
                if (
                    "collection not found" in error_msg
                    or "failed to get collection id" in error_msg
                    or "milvusexception" in error_msg
                ):
                    print(
                        f"Collection '{collection_name}' not found for deletion - possibly already deleted: {filename}"
                    )
                    return True
                else:
                    print(f"Unexpected deletion error: {delete_error}")
                    raise delete_error

        except Exception as e:
            print(f"Failed to delete chunks from Milvus: {e}")
            return False

    def _invalidate_document_caches(
        self, user_id: int, filename: str, collection_id: int = None
    ):
        try:
            file_hash = (
                fast_hash_bytes(open(filename, "rb").read())
                if os.path.exists(filename)
                else None
            )
            if file_hash:
                cache_key = f"{file_hash}_{user_id}_{collection_id or 0}"
                cache_service.delete(f"chunks:{cache_key}")

            pattern = f"vector:*{user_id}:{collection_id or '*'}*"
            invalidated = cache_service.clear_pattern(pattern)
            logger.info(
                f"Invalidated {invalidated} vector result caches for deleted document: {filename}"
            )

            llm_pattern = f"llm:*{user_id}:{collection_id or '*'}*"
            invalidated += cache_service.clear_pattern(llm_pattern)
            logger.info(
                f"Invalidated {invalidated} total caches for deleted document: {filename}"
            )

        except Exception as e:
            logger.error(
                f"Error during cache invalidation for deleted document {filename}: {e}"
            )

    def delete_collection_vectors(self, user_id: int, collection_id: int):
        try:
            if not self._vector_store:
                print("Vector store not initialized")
                return False

            expr = f"user_id == {user_id} and collection_id == {collection_id}"

            try:
                print(
                    f"Attempting to delete collection vectors for user {user_id}, collection {collection_id}"
                )
                self.vector_store.delete(expr=expr)
                print(f"Successfully deleted collection vectors")

                self._invalidate_collection_caches(user_id, collection_id)

                return True
            except Exception as delete_error:
                error_msg = str(delete_error).lower()
                if (
                    "collection not found" in error_msg
                    or "milvusexception" in error_msg
                ):
                    print(
                        f"Collection not found for deletion - possibly already deleted"
                    )
                    self._invalidate_collection_caches(user_id, collection_id)
                    return True
                else:
                    print(f"Unexpected deletion error: {delete_error}")
                    raise delete_error

        except Exception as e:
            print(f"Failed to delete collection vectors from Milvus: {e}")
            return False

    def _invalidate_collection_caches(self, user_id: int, collection_id: int):
        try:
            cache_service.delete(f"user_collections:{user_id}")

            vector_pattern = f"vector:*{user_id}:{collection_id}*"
            invalidated = cache_service.clear_pattern(vector_pattern)

            llm_pattern = f"llm:*{user_id}:{collection_id}*"
            invalidated += cache_service.clear_pattern(llm_pattern)

            chunk_pattern = f"chunks:*_{user_id}_{collection_id}"
            invalidated += cache_service.clear_pattern(chunk_pattern)

            logger.info(
                f"Invalidated {invalidated} caches for deleted collection {collection_id} (user {user_id})"
            )

        except Exception as e:
            logger.error(
                f"Error during collection cache invalidation for user {user_id}, collection {collection_id}: {e}"
            )

    async def get_document_embeddings_for_visualization(
        self, user_id: int, document_id: int
    ) -> Dict[str, Any]:
        return await self.visualizer.get_embeddings_for_visualization(
            user_id, document_id
        )

    def get_cache_stats(self) -> Dict[str, Any]:
        try:
            comprehensive_stats = cache_service.get_stats()

            rag_stats = {
                "embeddings_cache_info": "In-memory + PostgreSQL cache with TTL",
                "vector_results_cache_info": "In-memory + PostgreSQL cache with TTL",
                "llm_responses_cache_info": "In-memory + PostgreSQL cache with TTL",
                "document_chunks_cache_info": "In-memory + PostgreSQL cache with TTL",
                "cache_warming_active": False,
                "cache_health": cache_service.health_check(),
            }

            comprehensive_stats["rag_service"] = rag_stats
            return comprehensive_stats

        except Exception as e:
            logger.error(f"Error getting cache stats: {e}")
            return {"error": str(e)}

    def warmup_critical_caches(self):
        logger.info(
            "Cache warming is not supported with hybrid cache (in-memory + PostgreSQL)"
        )
        return True


rag_service = RagService()
