from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship


def utcnow():
    """Return current UTC datetime."""
    return datetime.utcnow()


class User(SQLModel, table=True):
    """User model for authentication and user management."""

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    hashed_password: str
    full_name: str
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    # Relationships
    settings: Optional["UserSettings"] = Relationship(
        sa_relationship_kwargs={"uselist": False}
    )


class UserSettings(SQLModel, table=True):
    """User-specific AI settings and preferences."""

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", unique=True, index=True)

    # AI Settings
    default_temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    default_top_k: int = Field(default=5, ge=1, le=50)
    preferred_collection_id: Optional[int] = Field(
        default=None, foreign_key="collection.id"
    )

    # UI Preferences
    theme: str = Field(default="dark")
    language: str = Field(default="en")

    # Chat Preferences
    auto_save_chat: bool = Field(default=True)
    show_translations: bool = Field(default=True)
    enable_tts: bool = Field(default=True)

    # Timestamps
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    # Relationships
    user: Optional[User] = Relationship(back_populates="settings")
