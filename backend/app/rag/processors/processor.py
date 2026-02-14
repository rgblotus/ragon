import asyncio
import os
import logging
from typing import Dict, List, Optional
from langchain_community.document_loaders import (
    PyPDFLoader,
    TextLoader,
    UnstructuredFileLoader,
)
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document as LCDocument

from app.rag.config import settings

logger = logging.getLogger(__name__)

LOADER_MAP = {
    ".pdf": PyPDFLoader,
    ".txt": TextLoader,
    ".md": UnstructuredFileLoader,
    ".rst": UnstructuredFileLoader,
    ".html": UnstructuredFileLoader,
    ".htm": UnstructuredFileLoader,
    ".xml": UnstructuredFileLoader,
}

TEXT_LOADER = TextLoader


class DocumentProcessor:
    _splitter_cache: Dict[int, RecursiveCharacterTextSplitter] = {}
    _TEXT_SPLITTER_ARGS = {
        "length_function": len,
        "add_start_index": True,
        "separators": ["\n\n", "\n", " ", ""],
    }

    def __init__(self, chunk_size: int = None, chunk_overlap: int = None):
        final_chunk_size = (
            chunk_size if chunk_size is not None else settings.RAG_CHUNK_SIZE
        )
        final_chunk_overlap = (
            chunk_overlap if chunk_overlap is not None else settings.RAG_CHUNK_OVERLAP
        )

        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=final_chunk_size,
            chunk_overlap=final_chunk_overlap,
            **self._TEXT_SPLITTER_ARGS,
        )

    def _get_adjusted_splitter(self, chunk_size: int) -> RecursiveCharacterTextSplitter:
        cache_key = id(self.text_splitter) + chunk_size
        if cache_key not in self._splitter_cache:
            self._splitter_cache[cache_key] = RecursiveCharacterTextSplitter(
                chunk_size=chunk_size,
                chunk_overlap=self.text_splitter._chunk_overlap,
                **self._TEXT_SPLITTER_ARGS,
            )
        return self._splitter_cache[cache_key]

    def _get_optimal_chunk_size(self, file_size: int) -> int:
        base_chunk_size = self.text_splitter._chunk_size
        if file_size > 10 * 1024 * 1024:
            return min(base_chunk_size * 2, 1536)
        elif file_size > 5 * 1024 * 1024:
            return min(int(base_chunk_size * 1.5), 1152)
        return base_chunk_size

    def _load_document(self, file_path: str, ext: str) -> List[LCDocument]:
        if ext == ".pdf":
            return self._load_pdf(file_path)
        elif ext == ".txt":
            return self._load_text(file_path)
        elif ext in LOADER_MAP:
            return LOADER_MAP[ext](file_path).load()
        else:
            return self._try_fallback_load(file_path)

    def _load_pdf(self, file_path: str) -> List[LCDocument]:
        loader = PyPDFLoader(file_path)
        docs = loader.load()
        if sum(len(d.page_content) for d in docs) == 0:
            logger.warning(
                "PyPDFLoader returned empty content - trying unstructured loader"
            )
            return UnstructuredFileLoader(file_path, strategy="fast").load()
        return docs

    def _load_text(self, file_path: str) -> List[LCDocument]:
        return TextLoader(file_path, encoding="utf-8").load()

    def _try_fallback_load(self, file_path: str) -> List[LCDocument]:
        try:
            return TextLoader(file_path, encoding="utf-8").load()
        except Exception:
            return UnstructuredFileLoader(file_path).load()

    def _clean_metadata(
        self,
        docs: List[LCDocument],
        file_path: str,
        ext: str,
        user_id: int,
        collection_id: int,
    ):
        filename = os.path.basename(file_path)
        total_pages = len(docs)
        for doc in docs:
            doc.metadata = {
                "user_id": user_id,
                "collection_id": collection_id,
                "source": filename,
                "file_type": ext,
                "title": filename,
                "author": "unknown",
                "page": doc.metadata.get("page", 1),
                "total_pages": total_pages,
                "start_index": doc.metadata.get("start_index", 0),
            }

    def _emit_progress(
        self, progress_service, user_id: int, progress: int, message: str, task_id: str
    ):
        if progress_service:
            try:
                asyncio.get_running_loop()
            except RuntimeError:
                asyncio.run(
                    progress_service.emit_progress(
                        user_id, progress, message, task_id=task_id
                    )
                )

    def process(
        self,
        file_path: str,
        user_id: int,
        collection_id: int,
        progress_service=None,
        task_id: str = None,
    ) -> List[LCDocument]:
        logger.info(
            f"Processing document: {file_path} for user {user_id}, collection {collection_id}"
        )

        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        file_size = os.path.getsize(file_path)
        logger.info(f"File size: {file_size} bytes")

        ext = os.path.splitext(file_path)[1].lower()
        logger.info(f"Detected file extension: {ext}")

        self._emit_progress(
            progress_service, user_id, 20, "Extraction started", task_id or file_path
        )

        docs = self._load_document(file_path, ext)
        logger.info(f"Loaded {len(docs)} document(s) from file")

        self._clean_metadata(docs, file_path, ext, user_id, collection_id)

        self._emit_progress(
            progress_service, user_id, 40, "Chunking started", task_id or file_path
        )

        adjusted_chunk_size = self._get_optimal_chunk_size(file_size)
        adjusted_splitter = self._get_adjusted_splitter(adjusted_chunk_size)

        logger.info(
            f"Chunk size: {adjusted_chunk_size}, overlap: {self.text_splitter._chunk_overlap}"
        )
        chunks = adjusted_splitter.split_documents(docs)
        logger.info(f"Created {len(chunks)} chunks from document")

        if not chunks:
            logger.warning("No chunks created! Checking if docs have content...")
            for i, doc in enumerate(docs):
                logger.warning(f"  Doc {i}: {len(doc.page_content)} chars")

        self._emit_progress(
            progress_service, user_id, 50, "Chunking completed", task_id or file_path
        )

        return chunks
