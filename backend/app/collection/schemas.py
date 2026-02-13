from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

class CollectionBase(BaseModel):
    name: str
    description: Optional[str] = None

class CollectionCreate(CollectionBase):
    pass

class CollectionRead(CollectionBase):
    id: int
    created_at: datetime
    is_default: bool
    user_id: int
    document_count: Optional[int] = 0

    model_config = {"from_attributes": True}

class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
