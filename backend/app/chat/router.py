from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import joinedload
from typing import List

from app.auth.router import get_current_user
from app.auth.models import User
from app.core.database import get_async_session
from app.core.cache_service import cache_service
from app.chat.models import ChatSession, ChatMessage
from app.chat.schemas import (
    ChatSessionCreate,
    ChatSessionRead,
    ChatSessionUpdate,
    ChatMessageCreate,
    ChatMessageRead,
    ChatSessionWithMessages,
    ChatSessionList,
    ChatMessageList,
    FrontendChatSession,
)

router = APIRouter()


@router.get("/sessions", response_model=ChatSessionList)
async def get_chat_sessions(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Get all chat sessions for the current user."""
    statement = (
        select(ChatSession)
        .where(ChatSession.user_id == user.id, ChatSession.is_active == True)
        .order_by(ChatSession.updated_at.desc())
    )

    result = await session.execute(statement)
    sessions = result.scalars().all()

    frontend_sessions = []
    for s in sessions:
        frontend_sessions.append(
            {
                "id": s.id,
                "user_id": s.user_id,
                "title": s.title,
                "collectionId": s.collection_id,
                "temperature": s.temperature,
                "topK": s.top_k,
                "vocalVoice": s.vocal_voice,
                "customRAGPrompt": s.custom_rag_prompt,
                "created_at": s.created_at.isoformat(),
                "updated_at": s.updated_at.isoformat(),
                "timestamp": s.created_at.isoformat(),
                "is_active": s.is_active,
                "messages": [],
            }
        )

    return {"sessions": frontend_sessions}


@router.get("/sessions/{session_id}")
async def get_chat_session(
    session_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Get a specific chat session with all messages (camelCase for frontend)."""
    cache_key = f"session_{user.id}_{session_id}"
    if cache_service.is_available:
        cached_data = cache_service.get_session_data(cache_key)
        if cached_data:
            return FrontendChatSession.from_read(
                ChatSessionWithMessages(**cached_data), []
            )

    statement = (
        select(ChatSession)
        .options(joinedload(ChatSession.messages))
        .where(ChatSession.id == session_id, ChatSession.user_id == user.id)
    )

    result = await session.execute(statement)
    chat_session = result.unique().scalar_one_or_none()

    if not chat_session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    sorted_messages = sorted(chat_session.messages, key=lambda m: m.created_at)
    frontend_session = FrontendChatSession.from_read(
        ChatSessionWithMessages.model_validate(chat_session), sorted_messages
    )

    if cache_service.is_available:
        cache_service.set_session_data(cache_key, chat_session.dict())

    return frontend_session


@router.post("/sessions", response_model=ChatSessionRead)
async def create_chat_session(
    session_data: ChatSessionCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Create a new chat session."""
    collection_id = session_data.collection_id

    if collection_id is not None:
        from app.collection.models import Collection

        stmt = select(Collection).where(
            Collection.id == collection_id, Collection.user_id == user.id
        )
        result = await session.execute(stmt)
        if result.scalar_one_or_none() is None:
            collection_id = None

    chat_session = ChatSession(
        user_id=user.id,
        title=session_data.title,
        collection_id=collection_id,
        temperature=session_data.temperature,
        top_k=session_data.top_k,
        vocal_voice=session_data.vocal_voice,
        custom_rag_prompt=session_data.custom_rag_prompt,
    )

    session.add(chat_session)
    await session.commit()
    await session.refresh(chat_session)

    return chat_session


@router.put("/sessions/{session_id}", response_model=ChatSessionRead)
async def update_chat_session(
    session_id: int,
    session_data: ChatSessionUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Update a chat session."""
    statement = select(ChatSession).where(
        ChatSession.id == session_id, ChatSession.user_id == user.id
    )

    result = await session.execute(statement)
    chat_session = result.scalar_one_or_none()

    if not chat_session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    update_data = session_data.model_dump(exclude_unset=True)

    if "collection_id" in update_data and update_data["collection_id"] is not None:
        from app.collection.models import Collection

        stmt = select(Collection).where(
            Collection.id == update_data["collection_id"], Collection.user_id == user.id
        )
        result = await session.execute(stmt)
        if result.scalar_one_or_none() is None:
            update_data["collection_id"] = None

    for field, value in update_data.items():
        setattr(chat_session, field, value)

    session.add(chat_session)
    await session.commit()
    await session.refresh(chat_session)

    cache_key = f"session_{user.id}_{session_id}"
    if cache_service.is_available:
        cache_service.delete(cache_key)

    return chat_session


@router.delete("/sessions/{session_id}")
async def delete_chat_session(
    session_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Delete a chat session and all its messages."""
    try:
        statement = select(ChatSession).where(
            ChatSession.id == session_id, ChatSession.user_id == user.id
        )

        result = await session.execute(statement)
        chat_session = result.scalar_one_or_none()

        if not chat_session:
            raise HTTPException(status_code=404, detail="Chat session not found")

        messages_stmt = select(ChatMessage).where(ChatMessage.session_id == session_id)
        messages_result = await session.execute(messages_stmt)
        messages_to_delete = messages_result.scalars().all()
        message_count = len(messages_to_delete)

        print(f"DEBUG: Deleting session {session_id} with {message_count} messages")

        await session.execute(
            delete(ChatMessage).where(ChatMessage.session_id == session_id)
        )
        await session.delete(chat_session)
        await session.commit()

        print(f"DEBUG: Successfully deleted session {session_id}")

        cache_key = f"session_{user.id}_{session_id}"
        if cache_service.is_available:
            success1 = cache_service.delete(cache_key)
            print(f"DEBUG: Invalidated cache for {cache_key}, success: {success1}")

        sessions_cache_key = f"user_sessions_{user.id}"
        if cache_service.is_available:
            success2 = cache_service.delete(sessions_cache_key)
            print(f"DEBUG: Invalidated sessions list cache for {sessions_cache_key}")

        return {
            "detail": f"Chat session and {message_count} messages deleted",
            "session_id": session_id,
            "messages_deleted": message_count,
            "cache_invalidated": True,
        }

    except Exception as e:
        print(f"ERROR: Failed to delete session {session_id}: {str(e)}")
        await session.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to delete chat session: {str(e)}"
        )


@router.get("/sessions/{session_id}/messages", response_model=ChatMessageList)
async def get_chat_messages(
    session_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Get all messages for a specific chat session."""
    session_stmt = select(ChatSession).where(
        ChatSession.id == session_id, ChatSession.user_id == user.id
    )
    session_result = await session.execute(session_stmt)
    chat_session = session_result.scalar_one_or_none()

    if not chat_session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    message_stmt = (
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    result = await session.execute(message_stmt)
    messages = result.scalars().all()

    return {"messages": messages}


@router.post("/sessions/{session_id}/messages", response_model=ChatMessageRead)
async def create_chat_message(
    session_id: int,
    message_data: ChatMessageCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Create a new chat message in a session."""
    session_stmt = select(ChatSession).where(
        ChatSession.id == session_id, ChatSession.user_id == user.id
    )
    session_result = await session.execute(session_stmt)
    chat_session = session_result.scalar_one_or_none()

    if not chat_session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    chat_message = ChatMessage(
        session_id=session_id,
        content=message_data.content,
        sender=message_data.sender,
        translation=message_data.translation,
        sources=message_data.sources,
    )

    session.add(chat_message)
    await session.commit()
    await session.refresh(chat_message)

    chat_session.updated_at = chat_message.created_at
    session.add(chat_session)
    await session.commit()

    cache_key = f"session_{user.id}_{session_id}"
    if cache_service.is_available:
        cache_service.delete(cache_key)

    return chat_message


@router.delete("/messages/{message_id}")
async def delete_chat_message(
    message_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Delete a chat message."""
    message_stmt = select(ChatMessage).where(ChatMessage.id == message_id)
    message_result = await session.execute(message_stmt)
    chat_message = message_result.scalar_one_or_none()

    if not chat_message:
        raise HTTPException(status_code=404, detail="Chat message not found")

    session_stmt = select(ChatSession).where(
        ChatSession.id == chat_message.session_id, ChatSession.user_id == user.id
    )
    session_result = await session.execute(session_stmt)
    chat_session = session_result.scalar_one_or_none()

    if not chat_session:
        raise HTTPException(
            status_code=403, detail="Not authorized to delete this message"
        )

    await session.delete(chat_message)
    await session.commit()

    cache_key = f"session_{user.id}_{chat_message.session_id}"
    if cache_service.is_available:
        cache_service.delete(cache_key)

    return {"detail": "Chat message deleted successfully"}
