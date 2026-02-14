import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from app.core.database import get_async_session
from app.core.cache_service import cache_service
from app.auth.router import get_current_user
from app.auth.models import User
from app.collection.models import Collection
from app.collection.schemas import CollectionCreate, CollectionRead, CollectionUpdate
from app.document.models import Document
from app.chat.models import ChatSession
from app.rag.service import rag_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/", response_model=CollectionRead)
async def create_collection(collection_in: CollectionCreate, user: User = Depends(get_current_user),
                            session: AsyncSession = Depends(get_async_session)):
    collection = Collection(**collection_in.model_dump(), user_id=user.id)
    session.add(collection)
    await session.commit()
    await session.refresh(collection)
    if cache_service.is_available:
        cache_service.invalidate_user_collections(user.id)
    read_col = CollectionRead.model_validate(collection)
    read_col.document_count = 0
    return read_col


@router.get("/", response_model=List[CollectionRead])
async def list_collections(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_async_session)):
    if cache_service.is_available:
        cached = cache_service.get_user_collections(user.id)
        if cached:
            return cached
    doc_count_subquery = select(
        Document.collection_id,
        func.count(Document.id).label("doc_count")
    ).where(Document.collection_id.isnot(None)).group_by(Document.collection_id).subquery()
    statement = select(Collection, doc_count_subquery.c.doc_count).outerjoin(
        doc_count_subquery, Collection.id == doc_count_subquery.c.collection_id
    ).where(Collection.user_id == user.id)
    result = await session.execute(statement)
    results = []
    for col, doc_count in result.all():
        read_col = CollectionRead.model_validate(col)
        read_col.document_count = doc_count or 0
        results.append(read_col)
    if cache_service.is_available:
        cache_service.set_user_collections(user.id, [r.dict() for r in results])
    return results


@router.get("/{collection_id}", response_model=CollectionRead)
async def get_collection(collection_id: int, user: User = Depends(get_current_user),
                          session: AsyncSession = Depends(get_async_session)):
    doc_count_subquery = select(func.count(Document.id)).where(Document.collection_id == collection_id).scalar_subquery()
    statement = select(Collection, doc_count_subquery.label("doc_count")).where(
        Collection.id == collection_id, Collection.user_id == user.id)
    result = await session.execute(statement)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Collection not found")
    col, doc_count = row
    read_col = CollectionRead.model_validate(col)
    read_col.document_count = doc_count
    return read_col


@router.delete("/{collection_id}")
async def delete_collection(collection_id: int, user: User = Depends(get_current_user),
                            session: AsyncSession = Depends(get_async_session)):
    doc_count_subquery = select(func.count(Document.id)).where(Document.collection_id == collection_id).scalar_subquery()
    statement = select(Collection, doc_count_subquery.label("doc_count")).where(
        Collection.id == collection_id, Collection.user_id == user.id)
    result = await session.execute(statement)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Collection not found")
    collection, doc_count = row
    if collection.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete default collection")
    if doc_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete collection with documents. Delete documents first.")
    chat_count_subquery = select(func.count(ChatSession.id)).where(ChatSession.collection_id == collection_id).scalar_subquery()
    chat_count_result = await session.execute(select(chat_count_subquery))
    chat_count = chat_count_result.scalar()
    if chat_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete collection with active chat sessions.")
    from app.auth.models import UserSettings
    preferred_count_result = await session.execute(
        select(func.count(UserSettings.user_id)).where(UserSettings.preferred_collection_id == collection_id))
    preferred_count = preferred_count_result.scalar()
    if preferred_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete collection set as preferred by users.")
    await session.execute(update(ChatSession).where(ChatSession.collection_id == collection_id).values(collection_id=None))
    await session.execute(update(UserSettings).where(UserSettings.preferred_collection_id == collection_id).values(preferred_collection_id=None))
    try:
        rag_service.delete_collection_vectors(user.id, collection_id)
    except Exception as e:
        logger.warning(f"Failed to delete vector data for collection {collection_id}: {str(e)}")
    await session.delete(collection)
    await session.commit()
    if cache_service.is_available:
        cache_service.invalidate_user_collections(user.id)
    return {"detail": "Collection deleted"}
