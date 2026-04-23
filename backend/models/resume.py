"""Resume and job-processing Pydantic models."""

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel


class JobStatus(str, Enum):
    """Lifecycle states for an async resume processing job."""

    queued = "queued"
    processing = "processing"
    complete = "complete"
    failed = "failed"


class ResumeUploadResponse(BaseModel):
    """Immediate response returned by POST /api/resume/upload."""

    job_id: str
    status: JobStatus = JobStatus.queued
    message: str = "Resume queued for processing."


class JobStatusOut(BaseModel):
    """Full job status snapshot returned by GET /api/resume/status/{job_id}."""

    job_id: str
    status: JobStatus
    result: Optional[Any] = None
    error: Optional[str] = None
    user_id: Optional[str] = None
    progress_pct: Optional[int] = None
