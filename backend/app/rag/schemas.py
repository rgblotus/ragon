from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from app.rag.config import settings

class ChatRequest(BaseModel):
    query: str
    collection_id: int
    temperature: float = Field(default=settings.RAG_DEFAULT_TEMPERATURE)
    top_k: int = Field(default=settings.RAG_DEFAULT_TOP_K)
    custom_prompt: str = Field(default="", description="Optional custom RAG prompt to override the default")
    fetch_sources: bool = Field(default=False, description="Whether to fetch and return sources with the response")

class ChatResponse(BaseModel):
    response: str
    sources: List[dict] = Field(default_factory=list)

class SourceInfo(BaseModel):
    source: str
    similarity_score: float
    content: str
