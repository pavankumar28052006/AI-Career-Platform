"""Structured JSON logging configuration."""

import json
import logging
import sys
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any

request_id_ctx_var: ContextVar[str] = ContextVar("request_id", default="")
user_id_ctx_var: ContextVar[str] = ContextVar("user_id", default="")
job_id_ctx_var: ContextVar[str] = ContextVar("job_id", default="")


class _JsonFormatter(logging.Formatter):
    """Emit log records as single-line JSON objects."""

    def format(self, record: logging.LogRecord) -> str:  # noqa: A003
        log_obj: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        req_id = request_id_ctx_var.get()
        if req_id:
            log_obj["request_id"] = req_id
        usr_id = user_id_ctx_var.get()
        if usr_id:
            log_obj["user_id"] = usr_id
        job_id = job_id_ctx_var.get()
        if job_id:
            log_obj["job_id"] = job_id
        
        # Include any extra fields attached via logger.info("msg", extra={...})
        standard_keys = {
            "args", "asctime", "created", "exc_info", "exc_text", "filename",
            "funcName", "levelname", "levelno", "lineno", "message", "module",
            "msecs", "msg", "name", "pathname", "process", "processName",
            "relativeCreated", "stack_info", "thread", "threadName",
        }
        extra = {k: v for k, v in record.__dict__.items() if k not in standard_keys}
        if extra:
            log_obj["extra"] = extra
        if record.exc_info and record.exc_info[0] is not None:
            log_obj["exc_info"] = self.formatException(record.exc_info)  # type: ignore[arg-type]
        return json.dumps(log_obj, default=str)


def get_logger(name: str) -> logging.Logger:
    """Return a named logger that emits JSON to stdout."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(_JsonFormatter())
        logger.addHandler(handler)
        logger.propagate = False
    return logger


def configure_root_logger(level: str = "INFO") -> None:
    """Call once at app startup to configure the root logger level."""
    logging.getLogger().setLevel(getattr(logging, level.upper(), logging.INFO))
