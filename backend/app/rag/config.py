"""
Olivia Backend Configuration Management

Environment-based configuration with validation and type safety.
"""

import os
from typing import List, Optional
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    # Server Configuration
    APP_NAME: str = Field(default="Olivia Backend API", description="Application name")
    APP_VERSION: str = Field(default="1.0.0", description="Application version")
    DEBUG: bool = Field(default=False, description="Enable debug mode")
    ENVIRONMENT: str = Field(
        default="development", description="Application environment"
    )

    # Server Configuration
    HOST: str = Field(default="127.0.0.1", description="Server host")
    PORT: int = Field(default=8000, description="Server port")

    # Database Configuration
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/neodb",
        description="Database connection URL",
    )
    DATABASE_ECHO: bool = Field(default=False, description="Echo SQL queries")
    DATABASE_POOL_SIZE: int = Field(
        default=10, description="Database connection pool size"
    )
    DATABASE_MAX_OVERFLOW: int = Field(
        default=20, description="Maximum overflow connections"
    )
    DATABASE_POOL_RECYCLE: int = Field(
        default=300, description="Connection recycle time in seconds"
    )

    # Milvus Configuration
    MILVUS_HOST: str = Field(default="127.0.0.1", description="Milvus host")
    MILVUS_PORT: str = Field(default="19530", description="Milvus port")
    MILVUS_COLLECTION: str = Field(
        default="olivia_rag", description="Milvus collection name"
    )

    # RAG Configuration
    RAG_DEFAULT_TEMPERATURE: float = Field(
        default=0.0, description="Default temperature for LLM responses"
    )
    RAG_DEFAULT_TOP_K: int = Field(
        default=20, description="Default number of documents to retrieve"
    )
    RAG_INGEST_BATCH_SIZE: int = Field(
        default=100, description="Batch size for document ingestion"
    )
    RAG_EMBEDDING_BATCH_SIZE: int = Field(
        default=32, description="Batch size for embedding generation"
    )
    RAG_MILVUS_NLIST: int = Field(
        default=1024, description="Number of clusters for Milvus IVF index"
    )

    # Dynamic Retrieval Configuration
    RAG_DYNAMIC_RETRIEVAL_ENABLED: bool = Field(
        default=True, description="Enable dynamic retrieval parameter adjustment"
    )
    RAG_MAX_TOP_K: int = Field(
        default=50, description="Maximum top_k for complex queries"
    )
    RAG_MIN_SIMILARITY_THRESHOLD: float = Field(
        default=0.0, description="Minimum similarity threshold for retrieval (0.0-1.0)"
    )
    RAG_QUERY_EXPANSION_ENABLED: bool = Field(
        default=True, description="Enable query expansion for complex queries"
    )

    # Semantic Cache Configuration
    RAG_SEMANTIC_CACHE_ENABLED: bool = Field(
        default=False, description="Enable semantic caching for queries"
    )
    RAG_SEMANTIC_CACHE_THRESHOLD: float = Field(
        default=0.92, description="Similarity threshold for semantic cache hit"
    )
    RAG_SEMANTIC_CACHE_COLLECTION: str = Field(
        default="SemanticCache", description="Milvus collection for semantic cache"
    )

    # Document Processing Configuration
    RAG_CHUNK_SIZE: int = Field(
        default=768, description="Size of text chunks for document processing"
    )
    RAG_CHUNK_OVERLAP: int = Field(
        default=150, description="Overlap between text chunks"
    )

    # AI Model Configuration
    OLLAMA_BASE_URL: str = Field(
        default="http://localhost:11434", description="Ollama server URL"
    )
    OLLAMA_MODEL: str = Field(default="phi3.5:latest", description="Ollama model name")
    EMBEDDING_MODEL: str = Field(
        default="sentence-transformers/all-MiniLM-L6-v2",
        description="Embedding model name",
    )

    # Security Configuration
    SECRET_KEY: str = Field(
        default="your-secret-key-here", description="JWT secret key"
    )
    ALGORITHM: str = Field(default="HS256", description="JWT algorithm")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=30, description="Token expiration time in minutes"
    )

    # API Configuration
    API: str = Field(default="", description="OpenAI API key")

    # CORS Configuration
    CORS_ORIGINS: str = Field(
        default="http://localhost:5173,http://localhost:3000,http://localhost:8080",
        description="Comma-separated list of allowed CORS origins",
    )

    # File Upload Configuration
    UPLOAD_DIR: str = Field(default="./uploads", description="Upload directory")
    COLLECTIONS_DIR: str = Field(
        default="./collections", description="Collections directory"
    )
    MAX_FILE_SIZE: int = Field(
        default=50 * 1024 * 1024, description="Max file size in bytes (50MB)"
    )

    # Logging Configuration
    LOG_LEVEL: str = Field(default="INFO", description="Logging level")

    # Cache Configuration (No Redis - uses in-memory + PostgreSQL)
    CACHE_MAX_SIZE: int = Field(
        default=10000, description="Maximum cache entries in memory"
    )
    CACHE_TTL: int = Field(
        default=3600, description="Default cache TTL in seconds (1 hour)"
    )

    # Cache TTL Configuration (backward compatible with REDIS_ prefixes)
    REDIS_TTL_LLM_RESPONSE: int = Field(
        default=86400, description="TTL for LLM response cache (24 hours)"
    )
    REDIS_TTL_EMBEDDINGS: int = Field(
        default=86400, description="TTL for embeddings cache (24 hours)"
    )
    REDIS_TTL_VECTOR_RESULTS: int = Field(
        default=3600, description="TTL for vector retrieval results (1 hour)"
    )
    REDIS_TTL_SESSIONS: int = Field(
        default=86400, description="TTL for session data (24 hours)"
    )
    REDIS_TTL_DOC_CHUNKS: int = Field(
        default=86400, description="TTL for document chunks cache (24 hours)"
    )
    REDIS_TTL_TRANSLATION: int = Field(
        default=604800, description="TTL for translation cache (7 days)"
    )

    # Cache Warming Configuration
    REDIS_CACHE_WARMING_ENABLED: bool = Field(
        default=False,
        description="Enable cache warming on startup (disabled without Redis)",
    )
    REDIS_METRICS_RESET_INTERVAL: int = Field(
        default=3600, description="Metrics reset interval in seconds (1 hour)"
    )

    # Cache Monitoring Configuration
    CACHE_MONITORING_ENABLED: bool = Field(
        default=True, description="Enable cache monitoring"
    )
    CACHE_MONITORING_INTERVAL: int = Field(
        default=60, description="Monitoring collection interval in seconds"
    )
    CACHE_ALERTS_ENABLED: bool = Field(default=True, description="Enable cache alerts")
    CACHE_PERFORMANCE_LOGGING: bool = Field(
        default=True, description="Enable detailed performance logging"
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        env_prefix = ""
        extra = "ignore"

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        return [
            origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()
        ]

    @property
    def database_url_safe(self) -> str:
        """Return database URL without sensitive information for logging."""
        if self.DATABASE_URL.startswith("sqlite"):
            return self.DATABASE_URL
        if self.DATABASE_URL.startswith("postgresql"):
            return self.DATABASE_URL
        # For other databases, mask password if present
        return "***hidden**" if "@" in self.DATABASE_URL else self.DATABASE_URL


# Global settings instance
settings = Settings()
