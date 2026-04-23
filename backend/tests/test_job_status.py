"""Tests for job status transitions: queued → processing → complete."""

from unittest.mock import patch, MagicMock

import pytest

from models.resume import JobStatus
from services.job_service import create_job, get_job, update_job


@pytest.mark.asyncio
async def test_initial_status_is_queued(fake_redis):
    """Creating a job sets status to queued."""
    from unittest.mock import patch

    with patch("db.redis_client._redis", fake_redis):
        job_id = "test-job-001"
        out = await create_job(job_id)
        assert out.status == JobStatus.queued
        assert out.job_id == job_id


@pytest.mark.asyncio
async def test_status_transitions_queued_to_processing(fake_redis):
    with patch("db.redis_client._redis", fake_redis):
        job_id = "test-job-002"
        await create_job(job_id)
        await update_job(job_id, JobStatus.processing)
        out = await get_job(job_id)
        assert out.status == JobStatus.processing


@pytest.mark.asyncio
async def test_status_transitions_processing_to_complete(fake_redis):
    from unittest.mock import patch

    with patch("db.redis_client._redis", fake_redis):
        job_id = "test-job-003"
        await create_job(job_id)
        await update_job(job_id, JobStatus.processing)
        result_payload = {"skills": ["Python", "SQL"], "skill_count": 2}
        await update_job(job_id, JobStatus.complete, result=result_payload)

        out = await get_job(job_id)
        assert out.status == JobStatus.complete
        assert out.result == result_payload
        assert out.error is None


@pytest.mark.asyncio
async def test_status_transitions_processing_to_failed(fake_redis):
    from unittest.mock import patch

    with patch("db.redis_client._redis", fake_redis):
        job_id = "test-job-004"
        await create_job(job_id)
        await update_job(job_id, JobStatus.processing)
        await update_job(job_id, JobStatus.failed, error="SpaCy model not loaded")

        out = await get_job(job_id)
        assert out.status == JobStatus.failed
        assert out.error == "SpaCy model not loaded"


@pytest.mark.asyncio
async def test_get_nonexistent_job_raises_404(fake_redis):
    from unittest.mock import patch

    from fastapi import HTTPException

    with patch("db.redis_client._redis", fake_redis):
        with pytest.raises(HTTPException) as exc_info:
            await get_job("nonexistent-job-id")
        assert exc_info.value.status_code == 404
        assert exc_info.value.detail["code"] == "JOB_NOT_FOUND"


@pytest.mark.asyncio
async def test_full_status_via_api(async_client, auth_headers, fake_redis):
    """GET /api/resume/status/{job_id} reflects Redis state."""
    import io

    content = b"Python SQL TensorFlow"
    files = {"file": ("resume.txt", io.BytesIO(content), "text/plain")}
    upload_resp = await async_client.post(
        "/api/resume/upload", headers=auth_headers, files=files
    )
    assert upload_resp.status_code == 202
    job_id = upload_resp.json()["job_id"]

    status_resp = await async_client.get(
        f"/api/resume/status/{job_id}", headers=auth_headers
    )
    assert status_resp.status_code == 200
    data = status_resp.json()
    assert data["job_id"] == job_id
    assert data["status"] in ("queued", "processing", "complete", "failed")
