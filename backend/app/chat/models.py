from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Index, Column
from sqlalchemy.types import JSON

class ChatSession(SQLModel, table=True):
    """Chat session model for storing conversation history."""
    __tablename__ = "chat_session"
    __table_args__ = (
        Index('idx_chatsession_user_updated', 'user_id', 'updated_at'),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    collection_id: Optional[int] = Field(default=None, foreign_key="collection.id")

    title: str = Field(max_length=255)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    top_k: int = Field(default=5, ge=1, le=50)
    vocal_voice: str = Field(default="en_female")
    custom_rag_prompt: Optional[str] = Field(default=None)

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = Field(default=True)

    # Relationships
    messages: List["ChatMessage"] = Relationship(back_populates="session")

class ChatMessage(SQLModel, table=True):
    """Chat message model for storing individual messages."""
    __table_args__ = (
        Index('idx_chatmessage_session_created', 'session_id', 'created_at'),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="chat_session.id", index=True)

    content: str = Field()
    sender: str  # 'user' or 'ai'

    # Optional metadata
    translation: Optional[str] = Field(default=None)
    sources: Optional[List[dict]] = Field(default=None, sa_column=Column(JSON))

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    session: Optional["ChatSession"] = Relationship(back_populates="messages")