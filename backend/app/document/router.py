import os
import logging
import asyncio
from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks, WebSocket
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from app.core.database import get_async_session, async_engine
from app.auth.router import get_current_user
from app.auth.models import User
from app.document.models import Document
from app.document.schemas import DocumentRead
from app.core.service_manager import get_rag_service_dependency
from app.core.progress_service import progress_service
from app.collection.models import Collection
from app.rag.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()
UPLOAD_DIR = settings.UPLOAD_DIR
os.makedirs(UPLOAD_DIR, exist_ok=True)


async def process_and_ingest(file_path: str, user_id: int, collection_id: int, doc_id: int, rag_service_instance):
    try:
        logger.info(f"Starting background ingestion for document {doc_id}")
        await progress_service.emit_progress(user_id, 15, "Starting document analysis", task_id=str(doc_id))
        loop = asyncio.get_event_loop()
        chunk_count = await loop.run_in_executor(None, lambda: rag_service_instance.ingest_document(
            file_path, user_id, collection_id, progress_service, str(doc_id)))
        logger.info(f"Ingestion completed for doc {doc_id}, {chunk_count} chunks created")
        if chunk_count > 0:
            async with AsyncSession(async_engine) as session:
                doc = await session.get(Document, doc_id)
                if doc:
                    doc.processed = True
                    session.add(doc)
                    await session.commit()
                    await progress_service.emit_progress(user_id, 100, "Document processing completed", task_id=str(doc_id))
        else:
            await progress_service.emit_progress(user_id, -1, "Document processing failed: no content extracted", task_id=str(doc_id))
    except Exception as e:
        logger.error(f"Background Ingestion failed for doc {doc_id}: {e}")
        await progress_service.emit_progress(user_id, -1, f"Document processing failed: {str(e)}", task_id=str(doc_id))


@router.post("/upload", response_model=DocumentRead)
async def upload_document(background_tasks: BackgroundTasks, file: UploadFile = File(...), collection_id: int = None,
                          user: User = Depends(get_current_user), session: AsyncSession = Depends(get_async_session),
                          rag_service=Depends(get_rag_service_dependency)):
    content = await file.read()
    file_size = len(content)
    if file_size > settings.MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large. Maximum size is {settings.MAX_FILE_SIZE // (1024 * 1024)}MB")
    if collection_id is None:
        statement = select(Collection).where(Collection.user_id == user.id, Collection.is_default == True)
        result = await session.execute(statement)
        default_col = result.scalar_one_or_none()
        collection_id = default_col.id if default_col else None
    if collection_id is None:
        raise HTTPException(status_code=404, detail="Default collection not found")
    col = await session.get(Collection, collection_id)
    if not col or col.user_id != user.id:
        raise HTTPException(status_code=404, detail="Collection not found")
    file_location = f"{UPLOAD_DIR}/{file.filename}"
    with open(file_location, "wb") as f:
        f.write(content)
    content_type = file.filename.split(".")[-1].lower() if "." in file.filename else "txt"
    doc = Document(filename=file.filename, file_path=file_location, content_type=content_type,
                   size_bytes=len(content), user_id=user.id, collection_id=collection_id, processed=False)
    session.add(doc)
    await session.commit()
    await session.refresh(doc)
    await progress_service.emit_progress(user.id, 5, "File uploaded, starting processing", task_id=str(doc.id))
    background_tasks.add_task(process_and_ingest, file_location, user.id, collection_id, doc.id, rag_service)
    from app.core.cache_service import cache_service
    if cache_service.is_available:
        cache_service.invalidate_user_collections(user.id)
    return doc


@router.get("/", response_model=List[DocumentRead])
async def list_documents(collection_id: int = None, user: User = Depends(get_current_user),
                          session: AsyncSession = Depends(get_async_session)):
    statement = select(Document).where(Document.user_id == user.id)
    if collection_id:
        statement = statement.where(Document.collection_id == collection_id)
    result = await session.execute(statement)
    return result.scalars().all()


@router.delete("/{document_id}")
async def delete_document(document_id: int, user: User = Depends(get_current_user),
                          session: AsyncSession = Depends(get_async_session),
                          rag_service=Depends(get_rag_service_dependency)):
    statement = select(Document).where(Document.id == document_id, Document.user_id == user.id)
    result = await session.execute(statement)
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)
    rag_service.delete_document_chunks(user.id, doc.filename, doc.collection_id)
    await session.delete(doc)
    await session.commit()
    from app.core.cache_service import cache_service
    if cache_service.is_available:
        cache_service.invalidate_user_collections(user.id)
    return {"detail": "Document deleted"}


@router.get("/{document_id}/content")
async def get_document_content(document_id: int, user: User = Depends(get_current_user),
                                session: AsyncSession = Depends(get_async_session)):
    statement = select(Document).where(Document.id == document_id, Document.user_id == user.id)
    result = await session.execute(statement)
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    media_type_map = {"pdf": "application/pdf", "txt": "text/plain", "doc": "application/msword",
                       "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
    ext = doc.filename.split(".")[-1].lower()
    media_type = media_type_map.get(ext, "application/octet-stream")
    return FileResponse(path=doc.file_path, filename=doc.filename, media_type=media_type)


@router.get("/progress/{task_id}")
async def get_progress(task_id: str):
    from app.core.cache_service import cache_service
    progress_data = cache_service.get(f"progress:{task_id}")
    return progress_data if progress_data else {"progress": 0, "message": "Processing", "isProcessing": True}


@router.get("/{document_id}/vectors")
async def get_document_vectors(document_id: int, user: User = Depends(get_current_user),
                                rag_service=Depends(get_rag_service_dependency)):
    return await rag_service.get_document_embeddings_for_visualization(user.id, document_id)


@router.websocket("/ws/progress/{user_id}")
async def progress_websocket(websocket: WebSocket, user_id: int):
    await websocket.accept()
    progress_service.add_connection(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
            await websocket.send_json({"type": "ping", "message": "Connection active"})
    except Exception as e:
        logger.debug(f"WebSocket closed for user {user_id}: {e}")
    finally:
        progress_service.remove_connection(user_id, websocket)
