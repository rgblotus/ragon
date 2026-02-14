from typing import Optional
from pydantic import BaseModel, Field, EmailStr, field_validator
from datetime import datetime
import re


def validate_password_strength(password: str) -> str:
    """Validate password meets minimum requirements."""
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter")
    if not re.search(r"[0-9]", password):
        raise ValueError("Password must contain at least one number")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        raise ValueError("Password must contain at least one special character")
    return password


# User Schemas
class UserBase(BaseModel):
    email: EmailStr = Field(..., description="User email address")
    full_name: str = Field(
        ..., min_length=2, max_length=100, description="User full name"
    )


class UserCreate(UserBase):
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Password (min 8 chars, uppercase, lowercase, number, special char)",
    )
    confirm_password: str = Field(..., description="Confirm password")

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v, info):
        if v != info.data.get("password"):
            raise ValueError("Passwords do not match")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        return validate_password_strength(v)


class UserLogin(BaseModel):
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., description="User password")


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = Field(None, description="User email address")
    full_name: Optional[str] = Field(
        None, min_length=2, max_length=100, description="User full name"
    )
    password: Optional[str] = Field(
        None, min_length=8, max_length=128, description="New password"
    )

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if v is None:
            return v
        return validate_password_strength(v)


class UserRead(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None


# User Settings Schemas
class UserSettingsBase(BaseModel):
    default_temperature: float = Field(
        default=0.7, ge=0.0, le=2.0, description="Default AI temperature for creativity"
    )
    default_top_k: int = Field(
        default=5, ge=1, le=50, description="Default number of documents to retrieve"
    )
    preferred_collection_id: Optional[int] = Field(
        default=None, description="Preferred collection ID for new chats"
    )
    theme: str = Field(default="dark", description="UI theme preference")
    language: str = Field(default="en", description="Language preference")
    auto_save_chat: bool = Field(default=True, description="Auto-save chat sessions")
    show_translations: bool = Field(
        default=True, description="Show translation options"
    )
    enable_tts: bool = Field(default=True, description="Enable text-to-speech")


class UserSettingsCreate(UserSettingsBase):
    """Schema for creating user settings (usually created automatically)"""

    pass


class UserSettingsUpdate(BaseModel):
    """Schema for updating user settings"""

    default_temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    default_top_k: Optional[int] = Field(default=None, ge=1, le=50)
    preferred_collection_id: Optional[int] = Field(default=None)
    theme: Optional[str] = Field(default=None)
    language: Optional[str] = Field(default=None)
    auto_save_chat: Optional[bool] = Field(default=None)
    show_translations: Optional[bool] = Field(default=None)
    enable_tts: Optional[bool] = Field(default=None)


class UserSettingsRead(UserSettingsBase):
    """Schema for reading user settings"""

    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserSettingsResponse(BaseModel):
    """Response schema for user settings API"""

    success: bool
    message: str
    data: Optional[UserSettingsRead] = None
