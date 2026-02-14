"""
Olivia Backend Logging Configuration
Provides structured logging for both development and production environments.
"""

import os
import sys
import logging
import logging.handlers
from typing import Dict, Any
from pathlib import Path

from app.rag.config import settings


class StructuredFormatter(logging.Formatter):
    """Custom formatter with structured logging for production."""

    def __init__(self, include_extra: bool = True):
        super().__init__()
        self.include_extra = include_extra

    def format(self, record: logging.LogRecord) -> str:
        # Add timestamp and level
        timestamp = self.formatTime(record, "%Y-%m-%d %H:%M:%S")
        level = record.levelname
        module = record.name
        message = record.getMessage()

        # Create structured format
        parts = [f"{timestamp} - {module} - {level} - {message}"]

        # Add exception info if present
        if record.exc_info:
            parts.append(self.formatException(record.exc_info))

        # Add extra fields in development
        if self.include_extra and hasattr(record, '__dict__'):
            extra_fields = {k: v for k, v in record.__dict__.items()
                          if not k.startswith('_') and k not in
                          ['name', 'msg', 'args', 'levelname', 'levelno',
                           'pathname', 'filename', 'module', 'exc_info',
                           'exc_text', 'stack_info', 'lineno', 'funcName',
                           'created', 'msecs', 'relativeCreated', 'thread',
                           'threadName', 'processName', 'process', 'message']}
            if extra_fields:
                parts.append(f"Extra: {extra_fields}")

        return " | ".join(parts)


class SensitiveDataFilter(logging.Filter):
    """Filter to mask sensitive information in logs."""

    SENSITIVE_KEYS = ['password', 'token', 'secret', 'key', 'authorization']

    def filter(self, record: logging.LogRecord) -> bool:
        if hasattr(record, 'msg') and isinstance(record.msg, str):
            # Mask sensitive data in log messages
            for key in self.SENSITIVE_KEYS:
                if key.lower() in record.msg.lower():
                    record.msg = self._mask_sensitive_data(record.msg)
                    break
        return True

    def _mask_sensitive_data(self, message: str) -> str:
        """Mask sensitive data in log messages."""
        # Simple masking - replace potential sensitive values
        import re
        # Mask patterns like password=secret, token=abc123, etc.
        for key in self.SENSITIVE_KEYS:
            pattern = rf'({key}\s*[:=]\s*)([^\s&]+)'
            message = re.sub(pattern, rf'\1***MASKED***', message, flags=re.IGNORECASE)
        return message


def get_logging_config() -> Dict[str, Any]:
    """Get logging configuration based on environment."""

    # Create logs directory
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)

    # Base configuration
    config = {
        'version': 1,
        'disable_existing_loggers': False,
        'filters': {
            'sensitive_filter': {
                '()': SensitiveDataFilter,
            }
        },
        'formatters': {
            'development': {
                '()': StructuredFormatter,
                'include_extra': True,
            },
            'production': {
                '()': StructuredFormatter,
                'include_extra': False,
            },
            'simple': {
                'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            }
        },
        'handlers': {},
        'loggers': {},
        'root': {
            'level': 'INFO',
            'handlers': ['console'],
        }
    }

    # Console handler (always present)
    config['handlers']['console'] = {
        'class': 'logging.StreamHandler',
        'level': 'DEBUG' if settings.DEBUG else 'INFO',
        'formatter': 'development' if settings.DEBUG else 'production',
        'filters': ['sensitive_filter'],
        'stream': sys.stdout,
    }

    # File handler for all logs
    config['handlers']['file'] = {
        'class': 'logging.handlers.RotatingFileHandler',
        'level': 'DEBUG',
        'formatter': 'production',
        'filters': ['sensitive_filter'],
        'filename': str(log_dir / 'olivia.log'),
        'maxBytes': 10 * 1024 * 1024,  # 10MB
        'backupCount': 5,
        'encoding': 'utf-8',
    }

    # Error-only file handler
    config['handlers']['error_file'] = {
        'class': 'logging.handlers.RotatingFileHandler',
        'level': 'ERROR',
        'formatter': 'production',
        'filters': ['sensitive_filter'],
        'filename': str(log_dir / 'olivia_errors.log'),
        'maxBytes': 5 * 1024 * 1024,  # 5MB
        'backupCount': 3,
        'encoding': 'utf-8',
    }

    # Performance logging handler
    config['handlers']['performance_file'] = {
        'class': 'logging.handlers.TimedRotatingFileHandler',
        'level': 'INFO',
        'formatter': 'simple',
        'filename': str(log_dir / 'olivia_performance.log'),
        'when': 'midnight',
        'backupCount': 30,
        'encoding': 'utf-8',
    }

    # Add handlers to root logger
    config['root']['handlers'] = ['console', 'file', 'error_file']

    # Specific logger configurations
    config['loggers'] = {
        # FastAPI and Uvicorn
        'uvicorn': {
            'level': 'INFO',
            'handlers': ['console', 'file'],
            'propagate': False,
        },
        'uvicorn.error': {
            'level': 'WARNING',
            'handlers': ['console', 'file', 'error_file'],
            'propagate': False,
        },
        'uvicorn.access': {
            'level': 'INFO',
            'handlers': ['console', 'file'],
            'propagate': False,
        },
        'fastapi': {
            'level': 'INFO',
            'handlers': ['console', 'file'],
            'propagate': False,
        },

        # Application modules
        'app': {
            'level': 'DEBUG' if settings.DEBUG else 'INFO',
            'handlers': ['console', 'file', 'error_file'],
            'propagate': False,
        },
        'app.core': {
            'level': 'DEBUG' if settings.DEBUG else 'INFO',
            'handlers': ['console', 'file', 'error_file'],
            'propagate': False,
        },
        'app.core.cache_monitor': {
            'level': 'DEBUG' if settings.DEBUG else 'WARNING',
            'handlers': ['console', 'file', 'performance_file'],
            'propagate': False,
        },
        'app.core.service_manager': {
            'level': 'DEBUG' if settings.DEBUG else 'INFO',
            'handlers': ['console', 'file'],
            'propagate': False,
        },
        'app.rag': {
            'level': 'DEBUG' if settings.DEBUG else 'INFO',
            'handlers': ['console', 'file', 'performance_file'],
            'propagate': False,
        },

        # External libraries - reduce noise in production
        'sentence_transformers': {
            'level': 'WARNING',
            'handlers': ['file'],
            'propagate': False,
        },
        'transformers': {
            'level': 'WARNING',
            'handlers': ['file'],
            'propagate': False,
        },
        'torch': {
            'level': 'WARNING',
            'handlers': ['file'],
            'propagate': False,
        },
        'pymilvus': {
            'level': 'WARNING',
            'handlers': ['file'],
            'propagate': False,
        },
        'redis': {
            'level': 'WARNING',
            'handlers': ['file'],
            'propagate': False,
        },
        'sqlalchemy': {
            'level': 'WARNING',
            'handlers': ['file'],
            'propagate': False,
        },
        'langchain': {
            'level': 'WARNING',
            'handlers': ['file'],
            'propagate': False,
        },
    }

    # Production-specific adjustments
    if not settings.DEBUG:
        # Reduce console verbosity in production
        config['handlers']['console']['level'] = 'WARNING'

        # Add more restrictive filtering
        config['handlers']['console']['formatter'] = 'production'

        # Ensure performance logs are captured
        if 'performance_file' not in config['root']['handlers']:
            config['root']['handlers'].append('performance_file')

    return config


def setup_logging():
    """Initialize logging configuration."""
    import logging.config

    try:
        config = get_logging_config()
        logging.config.dictConfig(config)

        # Log startup message
        logger = logging.getLogger(__name__)
        logger.info("🪵 Logging system initialized successfully")
        logger.info(f"📁 Log files will be written to: {Path('logs').absolute()}")
        logger.info(f"🌍 Environment: {'development' if settings.DEBUG else 'production'}")
        logger.info(f"📊 Log level: {'DEBUG' if settings.DEBUG else 'INFO'}")

    except Exception as e:
        # Fallback logging if configuration fails
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        logging.error(f"Failed to initialize structured logging: {e}")
        logging.warning("Using basic logging configuration")


# Performance logging utilities
class PerformanceLogger:
    """Utility class for performance logging."""

    def __init__(self, logger_name: str = 'performance'):
        self.logger = logging.getLogger(logger_name)

    def log_operation(self, operation: str, duration: float, metadata: Dict[str, Any] = None):
        """Log performance metrics for operations."""
        message = f"Operation '{operation}' completed in {duration:.3f}s"

        if metadata:
            metadata_str = ", ".join(f"{k}={v}" for k, v in metadata.items())
            message += f" | {metadata_str}"

        self.logger.info(message)

    def log_request(self, method: str, path: str, status_code: int, duration: float):
        """Log HTTP request performance."""
        level = logging.WARNING if status_code >= 400 else logging.INFO
        self.logger.log(level, f"{method} {path} - {status_code} - {duration:.3f}s")

    def log_cache_operation(self, operation: str, key: str, hit: bool, duration: float):
        """Log cache operation performance."""
        status = "HIT" if hit else "MISS"
        self.logger.debug(f"Cache {operation} {status} for key '{key}' in {duration:.3f}s")


# Global performance logger instance
performance_logger = PerformanceLogger()