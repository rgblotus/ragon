from datetime import datetime
from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship

from app.document.models import Document

class Collection(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_default: bool = Field(default=False)
    
    user_id: int = Field(foreign_key="user.id")
    
    # Relationship to documents
    documents: List["Document"] = Relationship(back_populates="collection")
