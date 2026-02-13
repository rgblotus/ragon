from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from app.collection.models import Collection

class Document(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    filename: str
    file_path: str
    content_type: str
    size_bytes: int
    created_at: datetime = Field(default_factory=datetime.utcnow)
    processed: bool = Field(default=False)

    user_id: int = Field(foreign_key="user.id", index=True)
    collection_id: int = Field(foreign_key="collection.id", index=True)

    # Relationship back to collection
    collection: Optional["Collection"] = Relationship(back_populates="documents")
