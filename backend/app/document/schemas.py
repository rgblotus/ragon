from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class DocumentBase(BaseModel):
    filename: str
    processed: bool
    created_at: datetime
    size_bytes: int
    
    model_config = {"from_attributes": True}

class DocumentRead(DocumentBase):
    id: int
    collection_id: int

class DocumentCreate(BaseModel):
    pass # Upload logic handled via Form data
