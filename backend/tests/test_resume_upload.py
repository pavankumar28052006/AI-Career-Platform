"""Tests for POST /api/resume/upload — must return job_id within 200 ms."""

import io
import time

import pytest


@pytest.mark.asyncio
async def test_upload_returns_job_id_immediately(async_client, auth_headers):
    content = b"Python SQL Machine Learning Data Analysis TensorFlow Docker"
    files = {"file": ("resume.txt", io.BytesIO(content), "text/plain")}

    start = time.monotonic()
    resp = await async_client.post("/api/resume/upload", headers=auth_headers, files=files)
    elapsed_ms = (time.monotonic() - start) * 1000

    assert resp.status_code == 202
    data = resp.json()
    assert "job_id" in data
    assert data["status"] == "queued"
    assert elapsed_ms < 200, f"Upload took {elapsed_ms:.1f} ms — must be < 200 ms"


@pytest.mark.asyncio
async def test_upload_requires_auth(async_client):
    content = b"Python SQL"
    files = {"file": ("resume.txt", io.BytesIO(content), "text/plain")}
    resp = await async_client.post("/api/resume/upload", files=files)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_upload_rejects_empty_file(async_client, auth_headers):
    files = {"file": ("empty.txt", io.BytesIO(b""), "text/plain")}
    resp = await async_client.post("/api/resume/upload", headers=auth_headers, files=files)
    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "RESUME_EMPTY"


@pytest.mark.asyncio
async def test_upload_rejects_oversized_file(async_client, auth_headers, monkeypatch):
    from core import config as cfg_module
    settings = cfg_module.get_settings()
    monkeypatch.setattr(settings, "max_upload_size_mb", 0)  # effectively 0 bytes

    content = b"Python"
    files = {"file": ("resume.txt", io.BytesIO(content), "text/plain")}
    resp = await async_client.post("/api/resume/upload", headers=auth_headers, files=files)
    assert resp.status_code == 413
    assert resp.json()["detail"]["code"] == "RESUME_TOO_LARGE"
