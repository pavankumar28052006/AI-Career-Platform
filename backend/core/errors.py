"""Centralised error codes and HTTP exception helpers.

Every HTTPException raised by this application must use ``raise_error()``
so that all error responses share a consistent JSON shape.
"""

from enum import Enum

from fastapi import HTTPException
from pydantic import BaseModel


class ErrorCode(str, Enum):
    """Typed error codes — no bare strings in HTTPException details."""

    # Auth
    AUTH_INVALID_CREDENTIALS = "AUTH_INVALID_CREDENTIALS"
    AUTH_INVALID_TOKEN = "AUTH_INVALID_TOKEN"
    AUTH_USER_ALREADY_EXISTS = "AUTH_USER_ALREADY_EXISTS"
    AUTH_USER_NOT_FOUND = "AUTH_USER_NOT_FOUND"

    # Resume / Upload
    RESUME_TOO_LARGE = "RESUME_TOO_LARGE"
    RESUME_INVALID_TYPE = "RESUME_INVALID_TYPE"
    RESUME_EMPTY = "RESUME_EMPTY"
    RESUME_PARSE_ERROR = "RESUME_PARSE_ERROR"

    # Job
    JOB_NOT_FOUND = "JOB_NOT_FOUND"
    JOB_PROCESSING_FAILED = "JOB_PROCESSING_FAILED"

    # Skills / Analysis
    SKILLS_EXTRACTION_FAILED = "SKILLS_EXTRACTION_FAILED"
    ANALYSIS_INVALID_ROLE = "ANALYSIS_INVALID_ROLE"
    ANALYSIS_INSUFFICIENT_DATA = "ANALYSIS_INSUFFICIENT_DATA"

    # Graph / Neo4j
    GRAPH_NODE_NOT_FOUND = "GRAPH_NODE_NOT_FOUND"
    GRAPH_QUERY_FAILED = "GRAPH_QUERY_FAILED"

    # Generic
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR"
    NOT_FOUND = "NOT_FOUND"
    VALIDATION_ERROR = "VALIDATION_ERROR"


class ErrorDetail(BaseModel):
    """Uniform error response body."""

    code: ErrorCode
    message: str


def raise_error(status_code: int, code: ErrorCode, message: str) -> None:
    """Raise an HTTPException with a typed ``ErrorDetail`` payload.

    Usage::

        raise_error(status.HTTP_401_UNAUTHORIZED,
                    ErrorCode.AUTH_INVALID_CREDENTIALS,
                    "Email or password is incorrect.")
    """
    raise HTTPException(
        status_code=status_code,
        detail=ErrorDetail(code=code, message=message).model_dump(),
    )
