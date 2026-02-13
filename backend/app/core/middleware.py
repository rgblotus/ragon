"""
Olivia Backend Modern Middleware System (2025)

Implements modern FastAPI middleware patterns including:
- Request/response logging with structured logging
- Performance monitoring
- Security headers
- CORS handling
- Error handling middleware
"""

import time
import uuid
import json
from typing import Callable
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import logging

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Modern request/response logging middleware with structured logging."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate unique request ID
        request_id = str(uuid.uuid4())
        start_time = time.time()

        # Add request ID to request state for later use
        request.state.request_id = request_id

        # Log request
        logger.info(f"Request started: {request.method} {request.url.path}")

        try:
            response = await call_next(request)
            process_time = time.time() - start_time

            # Log response - avoid extra fields that may cause issues
            logger.info(
                f"Request completed: {response.status_code} | {request.method} {request.url.path} | {round(process_time, 3)}s",
            )

            # Add security headers
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time"] = str(round(process_time, 3))

            return response

        except Exception as e:
            process_time = time.time() - start_time

            # Log error without extra fields to avoid hash issues
            logger.error(
                f"Request failed: {str(e)} | {request.method} {request.url.path} | {round(process_time, 3)}s",
                exc_info=True,
            )

            # Return error response
            return JSONResponse(
                status_code=500,
                content={
                    "error": {
                        "code": "INTERNAL_SERVER_ERROR",
                        "message": "An unexpected error occurred",
                        "request_id": request_id,
                    }
                },
            )


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Modern security headers middleware."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Add modern security headers
        security_headers = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
        }

        for header, value in security_headers.items():
            response.headers[header] = value

        return response


class PerformanceMonitoringMiddleware(BaseHTTPMiddleware):
    """Modern performance monitoring middleware."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()

        response = await call_next(request)

        process_time = time.time() - start_time

        # Log performance metrics without extra fields
        logger.info(
            f"Performance: {request.method} {request.url.path} | {response.status_code} | {round(process_time, 3)}s"
        )

        # Add performance header
        response.headers["X-Process-Time"] = str(round(process_time, 3))

        return response


def setup_middleware(app: FastAPI):
    """Setup all modern middleware."""

    # Add middleware in correct order
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(PerformanceMonitoringMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)

    logger.info("✅ Modern middleware configured successfully")
