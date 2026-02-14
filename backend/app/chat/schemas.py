from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from app.rag.config import settings


# Chat Session Schemas
class ChatSessionBase(BaseModel):
    title: str = Field(max_length=255)
    collection_id: Optional[int] = Field(default=None)
    temperature: float = Field(default=settings.RAG_DEFAULT_TEMPERATURE, ge=0.0, le=2.0)
    top_k: int = Field(default=settings.RAG_DEFAULT_TOP_K, ge=1, le=50)
    vocal_voice: str = Field(default="en_female")
    custom_rag_prompt: Optional[str] = Field(default=None)

    # CamelCase aliases for frontend
    @property
    def topK(self) -> int:
        return self.top_k

    @property
    def vocalVoice(self) -> str:
        return self.vocal_voice

    @property
    def customRAGPrompt(self) -> Optional[str]:
        return self.custom_rag_prompt


class ChatSessionCreate(ChatSessionBase):
    pass


class ChatSessionUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=255)
    collection_id: Optional[int] = Field(default=None)
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    top_k: Optional[int] = Field(default=None, ge=1, le=50)
    vocal_voice: Optional[str] = Field(default=None)
    custom_rag_prompt: Optional[str] = Field(default=None)
    is_active: Optional[bool] = Field(default=None)

    # CamelCase getters
    @property
    def topK(self) -> Optional[int]:
        return self.top_k

    @property
    def vocalVoice(self) -> Optional[str]:
        return self.vocal_voice

    @property
    def customRAGPrompt(self) -> Optional[str]:
        return self.custom_rag_prompt


class ChatSessionRead(ChatSessionBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    is_active: bool

    class Config:
        from_attributes = True

    # CamelCase getters for frontend
    @property
    def topK(self) -> int:
        return self.top_k

    @property
    def vocalVoice(self) -> str:
        return self.vocal_voice

    @property
    def customRAGPrompt(self) -> Optional[str]:
        return self.custom_rag_prompt

    @property
    def timestamp(self) -> datetime:
        return self.created_at


# Chat Message Schemas
class ChatMessageBase(BaseModel):
    content: str
    sender: str  # 'user' or 'ai'
    translation: Optional[str] = Field(default=None)
    sources: Optional[List[dict]] = Field(default=None)

    # Frontend uses 'text' instead of 'content'
    @property
    def text(self) -> str:
        return self.content


class ChatMessageCreate(BaseModel):
    content: str
    sender: str  # 'user' or 'ai'
    translation: Optional[str] = Field(default=None)
    sources: Optional[List[dict]] = Field(default=None)

    @property
    def text(self) -> str:
        return self.content


class ChatMessageRead(ChatMessageBase):
    id: int
    session_id: int
    created_at: datetime

    class Config:
        from_attributes = True

    # Frontend camelCase alias
    @property
    def text(self) -> str:
        return self.content

    @property
    def timestamp(self) -> datetime:
        return self.created_at


# Response schemas
class ChatSessionWithMessages(ChatSessionRead):
    messages: List[ChatMessageRead] = []

    # Add camelCase for messages
    @property
    def timestamp(self) -> datetime:
        return self.created_at


# Utility schemas
class ChatSessionList(BaseModel):
    sessions: List[ChatSessionRead]


class ChatMessageList(BaseModel):
    messages: List[ChatMessageRead]


# Frontend-specific response wrapper
class FrontendChatSession(BaseModel):
    """ChatSession with camelCase fields for frontend."""

    id: int
    user_id: int
    title: str
    collectionId: Optional[int]
    temperature: float
    topK: int
    vocalVoice: str
    customRAGPrompt: Optional[str]
    created_at: datetime
    updated_at: datetime
    timestamp: datetime
    is_active: bool
    messages: List[dict]

    @classmethod
    def from_read(
        cls, session: ChatSessionRead, messages: List[ChatMessageRead]
    ) -> "FrontendChatSession":
        return cls(
            id=session.id,
            user_id=session.user_id,
            title=session.title,
            collectionId=session.collection_id,
            temperature=session.temperature,
            topK=session.top_k,
            vocalVoice=session.vocal_voice,
            customRAGPrompt=session.custom_rag_prompt,
            created_at=session.created_at,
            updated_at=session.updated_at,
            timestamp=session.created_at,
            is_active=session.is_active,
            messages=[
                {
                    "id": msg.id,
                    "session_id": msg.session_id,
                    "text": msg.content,  # Backend 'content' -> frontend 'text'
                    "sender": msg.sender,
                    "translation": msg.translation,
                    "sources": msg.sources,
                    "created_at": msg.created_at.isoformat(),
                    "timestamp": msg.created_at.isoformat(),
                }
                for msg in messages
            ],
        )
