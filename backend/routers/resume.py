"""Resume router.

POST /api/resume/upload  — validates file, enqueues job, returns job_id < 200 ms.
GET  /api/resume/status/{job_id} — polls Redis for current job state.
"""

import asyncio
import io

from fastapi import APIRouter, Depends, File, Request, UploadFile, status
from pypdf import PdfReader

from core.config import get_settings
from core.errors import ErrorCode, raise_error
from core.logging import get_logger, user_id_ctx_var
from core.security import get_current_user
from models.resume import JobStatusOut, ResumeUploadResponse
from services.job_service import create_job, get_job, new_job_id

router = APIRouter(prefix="/api/resume", tags=["resume"])
logger = get_logger(__name__)

_ALLOWED_CONTENT_TYPES = {
    "text/plain",
    "application/pdf",
    "application/octet-stream",  # some clients send this for .txt
}


@router.post(
    "/upload",
    response_model=ResumeUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def upload_resume(
    request: Request,
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
) -> ResumeUploadResponse:
    """Accept a resume file and immediately return a job_id.

    Validation is the only work done synchronously — this handler must
    complete in well under 200 ms to meet the SLA.
    """
    settings = get_settings()
    user_id_ctx_var.set(user_id)

    # ── 1. Content-type check ─────────────────────────────────────────────────
    content_type = (file.content_type or "").split(";")[0].strip()
    filename = file.filename or ""
    lower_name = filename.lower()
    is_pdf = content_type == "application/pdf" or lower_name.endswith(".pdf")
    is_text = content_type == "text/plain" or lower_name.endswith(".txt")
    if not (is_pdf or is_text):
        raise_error(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            ErrorCode.RESUME_INVALID_TYPE,
            f"Unsupported file type '{content_type}'. Accepted: .txt, .pdf",
        )

    # ── 2. Size check (read up to max+1 bytes) ────────────────────────────────
    max_bytes = settings.max_upload_size_bytes
    chunk = await file.read(max_bytes + 1)
    if len(chunk) > max_bytes:
        raise_error(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            ErrorCode.RESUME_TOO_LARGE,
            f"File exceeds the {settings.max_upload_size_mb} MB limit.",
        )
    if not chunk:
        raise_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            ErrorCode.RESUME_EMPTY,
            "Uploaded file is empty.",
        )

    # ── 3. Decode text ────────────────────────────────────────────────────────
    if is_pdf:
        try:
            reader = PdfReader(io.BytesIO(chunk))
            text = "\n".join([page.extract_text() or "" for page in reader.pages])
        except Exception as e:
            logger.error(f"Failed to parse PDF: {e}")
            raise_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                ErrorCode.RESUME_PARSE_ERROR,
                "Could not extract text from the PDF file.",
            )
    else:
        try:
            text = chunk.decode("utf-8", errors="replace")
        except Exception:  # noqa: BLE001
            raise_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                ErrorCode.RESUME_PARSE_ERROR,
                "Could not decode the uploaded file as text.",
            )

    # ── 4. Create job record in Redis, enqueue arq background task ───────────
    job_id = new_job_id()
    await create_job(job_id, user_id=user_id)

    arq_pool = request.app.state.arq_pool
    await arq_pool.enqueue_job("process_resume_job", job_id, text, user_id)

    logger.info("Resume upload accepted and queued to arq", extra={"job_id": job_id, "user_id": user_id})
    return ResumeUploadResponse(job_id=job_id)


@router.get("/status/{job_id}", response_model=JobStatusOut)
async def get_resume_status(
    job_id: str,
    user_id: str = Depends(get_current_user),
) -> JobStatusOut:
    """Return the current processing status for *job_id*."""
    job = await get_job(job_id)
    if job.user_id and job.user_id != user_id:
        raise_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.JOB_NOT_FOUND,
            f"Job '{job_id}' not found or has expired.",
        )
    return job
