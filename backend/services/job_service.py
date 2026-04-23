"""Job service — async resume processing with Redis-backed status tracking.

Redis key schema:  ``job:{job_id}``  (JSON hash, TTL = 1 h)
Status lifecycle:  queued → processing → complete | failed
"""

import json
import uuid
from typing import Optional

from fastapi import status as http_status

from core.errors import ErrorCode, raise_error
from core.logging import get_logger, job_id_ctx_var, user_id_ctx_var
from db.neo4j_client import run_query
from db.redis_client import get_redis
from models.resume import JobStatus, JobStatusOut
from services.skill_extractor import extract_skills

logger = get_logger(__name__)

_JOB_TTL = 3600  # 1 hour


def _job_key(job_id: str) -> str:
    return f"job:{job_id}"


def new_job_id() -> str:
    """Generate a new unique job identifier."""
    return str(uuid.uuid4())


async def create_job(job_id: str, user_id: Optional[str] = None) -> JobStatusOut:
    """Write initial ``queued`` status for *job_id* to Redis with 1 h TTL."""
    redis = get_redis()
    payload = {"status": JobStatus.queued, "result": None, "error": None, "user_id": user_id}
    await redis.set(_job_key(job_id), json.dumps(payload, default=str), ex=_JOB_TTL)
    logger.info("Job created", extra={"job_id": job_id})
    return JobStatusOut(job_id=job_id, status=JobStatus.queued, user_id=user_id)


async def update_job(
    job_id: str,
    status: JobStatus,
    result: Optional[object] = None,
    error: Optional[str] = None,
    user_id: Optional[str] = None,
    progress_pct: Optional[int] = None,
) -> None:
    """Update the Redis record for *job_id*, resetting its TTL."""
    redis = get_redis()
    existing_raw = await redis.get(_job_key(job_id))
    existing = json.loads(existing_raw) if existing_raw else {}
    # Derive progress from status if not explicitly set
    if progress_pct is None:
        progress_pct = {
            JobStatus.queued: 5,
            JobStatus.processing: 50,
            JobStatus.complete: 100,
            JobStatus.failed: 0,
        }.get(status, 0)
    payload = {
        "status": status,
        "result": result,
        "error": error,
        "user_id": user_id if user_id is not None else existing.get("user_id"),
        "progress_pct": progress_pct,
    }
    await redis.set(_job_key(job_id), json.dumps(payload, default=str), ex=_JOB_TTL)
    logger.info("Job updated", extra={"job_id": job_id, "status": status})


async def get_job(job_id: str) -> JobStatusOut:
    """Return the current :class:`JobStatusOut` for *job_id*.

    Raises ``JOB_NOT_FOUND`` (404) if the key does not exist in Redis.
    """
    redis = get_redis()
    raw = await redis.get(_job_key(job_id))
    if raw is None:
        raise_error(
            http_status.HTTP_404_NOT_FOUND,
            ErrorCode.JOB_NOT_FOUND,
            f"Job '{job_id}' not found or has expired.",
        )
    data = json.loads(raw)
    return JobStatusOut(
        job_id=job_id,
        status=JobStatus(data["status"]),
        result=data.get("result"),
        error=data.get("error"),
        user_id=data.get("user_id"),
        progress_pct=data.get("progress_pct"),
    )


async def process_resume_job(ctx: dict, job_id: str, text: str, user_id: str) -> None:
    """Background coroutine that processes a resume and updates job status.
    
    Receives `ctx` from ARQ.
    Transition:  queued (already set) → processing → complete | failed
    """
    job_id_ctx_var.set(job_id)
    user_id_ctx_var.set(user_id)
    try:
        await update_job(job_id, JobStatus.processing, user_id=user_id)
        logger.info("Processing resume job", extra={"job_id": job_id, "user_id": user_id})

        skills = await extract_skills(text)

        normalized_skills = sorted({skill.strip().title() for skill in skills if skill.strip()})

        user_exists = await run_query(
            "MATCH (u:User {id: $user_id}) RETURN u.id AS id LIMIT 1",
            {"user_id": user_id},
        )
        if not user_exists:
            raise_error(
                http_status.HTTP_404_NOT_FOUND,
                ErrorCode.AUTH_USER_NOT_FOUND,
                f"User '{user_id}' does not exist.",
            )

        # Treat each upload as a fresh analysis by replacing existing user-skill links.
        await run_query(
            """
            MATCH (u:User {id: $user_id})-[rel:HAS_SKILL]->(:Skill)
            DELETE rel
            """,
            {"user_id": user_id},
        )

        # Optimization: Batch insert skills using UNWIND
        if normalized_skills:
            await run_query(
                """
                UNWIND $skills AS skill_name
                MERGE (s:Skill {name: skill_name})
                WITH s
                MATCH (u:User {id: $user_id})
                MERGE (u)-[:HAS_SKILL]->(s)
                """,
                {"skills": normalized_skills, "user_id": user_id}
            )

        result = {
            "skills": normalized_skills,
            "skill_count": len(normalized_skills),
            "user_id": user_id,
        }
        await update_job(job_id, JobStatus.complete, result=result, user_id=user_id)
        logger.info("Job complete", extra={"job_id": job_id, "skill_count": len(normalized_skills)})

        redis = get_redis()
        await redis.incr("metrics:total_jobs_processed")

    except Exception as exc:  # noqa: BLE001
        logger.error("Job failed", extra={"job_id": job_id, "error": str(exc)})
        await update_job(job_id, JobStatus.failed, error=str(exc), user_id=user_id)
