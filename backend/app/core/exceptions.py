"""
Olivia Backend Modern Exception Handling System

Implements modern 2025 exception handling patterns with proper HTTP status codes,
structured logging, and consistent error responses.
"""

from typing import Any, Dict, Optional
from fastapi import HTTPException, status
from pydantic import BaseModel
import traceback
import logging

logger = logging.getLogger(__name__)


class OliviaBaseException(Exception):
    """Base exception for all Olivia-specific exceptions."""

    def __init__(
        self,
        message: str,
        error_code: str = "ERROR",
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[Dict[str, Any]] = None,
        cause: Optional[Exception] = None,
    ):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}
        self.cause = cause
        super().__init__(self.message)

    def to_http_exception(self) -> HTTPException:
        """Convert to FastAPI HTTPException."""
        return HTTPException(
            status_code=self.status_code,
            detail={
                "error": {
                    "code": self.error_code,
                    "message": self.message,
                    "details": self.details,
                    "type": self.__class__.__name__,
                }
            },
        )


class ValidationError(OliviaBaseException):
    """Input validation error."""

    def __init__(
        self,
        message: str,
        field: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            error_code="VALIDATION_ERROR",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details={"field": field, **(details or {})},
        )


class AuthenticationError(OliviaBaseException):
    """Authentication failure error."""

    def __init__(self, message: str = "Authentication failed"):
        super().__init__(
            message=message,
            error_code="AUTHENTICATION_ERROR",
            status_code=status.HTTP_401_UNAUTHORIZED,
            details={"challenge": "Bearer"},
        )


class AuthorizationError(OliviaBaseException):
    """Authorization failure error."""

    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__(
            message=message,
            error_code="AUTHORIZATION_ERROR",
            status_code=status.HTTP_403_FORBIDDEN,
        )


class ResourceNotFoundError(OliviaBaseException):
    """Resource not found error."""

    def __init__(self, resource_type: str, resource_id: Any):
        super().__init__(
            message=f"{resource_type} with id '{resource_id}' not found",
            error_code="RESOURCE_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
            details={"resource_type": resource_type, "resource_id": resource_id},
        )


class DuplicateResourceError(OliviaBaseException):
    """Duplicate resource error."""

    def __init__(self, resource_type: str, field: str, value: Any):
        super().__init__(
            message=f"{resource_type} with {field} '{value}' already exists",
            error_code="DUPLICATE_RESOURCE",
            status_code=status.HTTP_409_CONFLICT,
            details={"resource_type": resource_type, "field": field, "value": value},
        )


class ServiceUnavailableError(OliviaBaseException):
    """External service unavailable error."""

    def __init__(self, service_name: str, original_error: Optional[Exception] = None):
        super().__init__(
            message=f"Service '{service_name}' is currently unavailable",
            error_code="SERVICE_UNAVAILABLE",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details={"service": service_name},
            cause=original_error,
        )


class RAGServiceError(OliviaBaseException):
    """RAG service specific error."""

    def __init__(self, operation: str, original_error: Optional[Exception] = None):
        super().__init__(
            message=f"RAG operation '{operation}' failed",
            error_code="RAG_SERVICE_ERROR",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details={"operation": operation},
            cause=original_error,
        )


class MilvusConnectionError(ServiceUnavailableError):
    """Milvus connection specific error."""

    def __init__(self, original_error: Optional[Exception] = None):
        super().__init__("Milvus", original_error)
        self.error_code = "MILVUS_CONNECTION_ERROR"


class OllamaConnectionError(ServiceUnavailableError):
    """Ollama connection specific error."""

    def __init__(self, original_error: Optional[Exception] = None):
        super().__init__("Ollama", original_error)
        self.error_code = "OLLAMA_CONNECTION_ERROR"


class ErrorResponse(BaseModel):
    """Standard error response format."""

    error: Dict[str, Any]
    timestamp: str
    request_id: Optional[str] = None


def handle_exception(exc: Exception) -> HTTPException:
    """Global exception handler that converts exceptions to HTTP exceptions."""

    if isinstance(exc, OliviaBaseException):
        return exc.to_http_exception()

    # Handle known FastAPI exceptions
    if isinstance(exc, HTTPException):
        return exc

    # Log unexpected exceptions
    logger.error(
        f"Unexpected exception: {type(exc).__name__}: {str(exc)}",
        extra={
            "exception_type": type(exc).__name__,
            "exception_message": str(exc),
            "traceback": traceback.format_exc(),
        },
    )

    # Return generic internal server error
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred",
                "type": "InternalServerError",
            }
        },
    )


def async_error_handler(func):
    """Decorator for async error handling."""

    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except Exception as exc:
            return handle_exception(exc)

    return wrapper


def sync_error_handler(func):
    """Decorator for sync error handling."""

    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as exc:
            return handle_exception(exc)

    return wrapper
