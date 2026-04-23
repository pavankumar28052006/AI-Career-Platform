"""Tests for POST /api/auth/register and POST /api/auth/login."""

import pytest


@pytest.mark.asyncio
async def test_register_success(async_client):
    resp = await async_client.post(
        "/api/auth/register",
        json={"email": "new@example.com", "password": "password123", "full_name": "New User"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "new@example.com"
    assert "id" in data
    assert "hashed_password" not in data


@pytest.mark.asyncio
async def test_register_duplicate_email(async_client, neo4j_store):
    # Register once
    await async_client.post(
        "/api/auth/register",
        json={"email": "dup@example.com", "password": "password123", "full_name": "Dup User"},
    )
    # Try again
    resp = await async_client.post(
        "/api/auth/register",
        json={"email": "dup@example.com", "password": "password123", "full_name": "Dup User"},
    )
    assert resp.status_code == 409
    assert resp.json()["detail"]["code"] == "AUTH_USER_ALREADY_EXISTS"


@pytest.mark.asyncio
async def test_login_success(async_client, neo4j_store):
    await async_client.post(
        "/api/auth/register",
        json={"email": "login@example.com", "password": "password123", "full_name": "Login User"},
    )
    resp = await async_client.post(
        "/api/auth/login",
        json={"email": "login@example.com", "password": "password123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(async_client, neo4j_store):
    await async_client.post(
        "/api/auth/register",
        json={"email": "wrongpw@example.com", "password": "correct", "full_name": "WP User"},
    )
    resp = await async_client.post(
        "/api/auth/login",
        json={"email": "wrongpw@example.com", "password": "wrong"},
    )
    assert resp.status_code == 401
    assert resp.json()["detail"]["code"] == "AUTH_INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_login_unknown_email(async_client):
    resp = await async_client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": "password"},
    )
    assert resp.status_code == 401
    assert resp.json()["detail"]["code"] == "AUTH_INVALID_CREDENTIALS"
