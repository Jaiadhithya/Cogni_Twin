"""Structured JSON logging configuration."""

import logging
import sys
from datetime import datetime, timezone
from typing import Any, Mapping

from pythonjsonlogger import jsonlogger

from src.config import settings

class CustomJsonFormatter(jsonlogger.JsonFormatter):
    """Custom JSON formatter following the spec structure."""
    
    def add_fields(
        self,
        log_record: dict[str, Any],
        record: logging.LogRecord,
        message_dict: dict[str, Any],
    ) -> None:
        """Add custom fields to the JSON log record."""
        super().add_fields(log_record, record, message_dict)
        
        # Core fields
        log_record["timestamp"] = datetime.now(timezone.utc).isoformat()
        log_record["level"] = record.levelname
        log_record["logger"] = record.name
        log_record["message"] = record.getMessage()
        log_record["module"] = record.module
        log_record["function"] = record.funcName
        
        # Request tracing
        log_record["request_id"] = getattr(record, "request_id", None)
        
        # Remove standard fields that are now mapped to custom fields
        for field in ["levelname", "name", "funcName"]:
            log_record.pop(field, None)
            
        # Extra fields block
        extra: dict[str, Any] = {}
        for key, val in record.__dict__.items():
            # Filter out standard LogRecord attributes
            if key not in {
                "args", "asctime", "created", "exc_info", "exc_text", "filename",
                "funcName", "levelname", "levelno", "lineno", "module", "msecs",
                "message", "msg", "name", "pathname", "process", "processName",
                "relativeCreated", "stack_info", "thread", "threadName", "taskName",
                "request_id",
            }:
                extra[key] = val
                
        if record.exc_info:
            extra["exc_info"] = self.formatException(record.exc_info)
            
        log_record["extra"] = extra


def setup_logging() -> None:
    """Initialize structured logging."""
    logger = logging.getLogger()
    
    # Set the root logger level
    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    logger.setLevel(level)

    # Clear existing handlers
    if logger.hasHandlers():
        logger.handlers.clear()

    # Configure stdout handler
    handler = logging.StreamHandler(sys.stdout)
    formatter = CustomJsonFormatter()
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    # Prevent uvicorn/fastapi from overriding our logger
    logging.getLogger("uvicorn.access").handlers = [handler]
    logging.getLogger("uvicorn.error").handlers = [handler]
    logging.getLogger("uvicorn.access").propagate = False
    logging.getLogger("uvicorn.error").propagate = False
