"""Pytest configuration and shared fixtures.

Mocks:
- Neo4j driver (in-memory dict store)
- Redis client (in-memory dict store)
- OpenAI AsyncOpenAI (controllable call counter)
"""

from __future__ import annotations

import asyncio
import json
import uuid
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# ── In-memory Neo4j stub ──────────────────────────────────────────────────────

class _FakeSession:
    def __init__(self, store: dict) -> None:
        self._store = store
        self._result: list[dict] = []

    async def run(self, cypher: str, params: dict | None = None) -> "_FakeResult":
        params = params or {}
        cypher_l = cypher.lower().strip()

        if "match (n) detach delete n" in cypher_l:
            self._store.clear()
            self._result = []

        elif "create (u:user" in cypher_l:
            uid = params.get("id", str(uuid.uuid4()))
            self._store.setdefault("users", {})[uid] = params
            self._result = []

        elif "match (u:user {email:" in cypher_l:
            users = self._store.get("users", {})
            email = params.get("email", "")
            found = [v for v in users.values() if v.get("email") == email]
            if "hashed_password" in cypher_l:
                self._result = [
                    {
                        "id": u["id"],
                        "email": u["email"],
                        "full_name": u["full_name"],
                        "hashed_password": u["hashed_password"],
                    }
                    for u in found
                ]
            else:
                self._result = [{"id": u["id"]} for u in found]

        elif "match (r:role)-[:requires]->(s:skill)" in cypher_l and "collect" in cypher_l:
            roles_skills = self._store.get("role_skills", {})
            self._result = [
                {"role": role, "required_skills": skills}
                for role, skills in roles_skills.items()
            ]

        elif "match (r:role {name:" in cypher_l and "requires" in cypher_l:
            role = params.get("role", "")
            skills = self._store.get("role_skills", {}).get(role, [])
            self._result = [{"skill": s} for s in skills]

        elif "match (r:role {name:" in cypher_l and "leads_to" in cypher_l:
            role = params.get("role", "")
            paths = self._store.get("paths", {}).get(role, [])
            self._result = paths

        elif "match (r:role {name:" in cypher_l:
            role = params.get("role", "")
            roles = self._store.get("roles", [])
            self._result = [{"name": r} for r in roles if r == role]

        elif "match (s:skill)" in cypher_l:
            skills = self._store.get("skills", [])
            self._result = [{"name": s} for s in skills]

        else:
            self._result = []

        return _FakeResult(self._result)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        pass


class _FakeResult:
    def __init__(self, records: list[dict]) -> None:
        self._records = records

    async def data(self) -> list[dict]:
        return self._records


class _FakeDriver:
    def __init__(self, store: dict) -> None:
        self._store = store

    def session(self):
        return _FakeSession(self._store)

    async def verify_connectivity(self) -> None:
        pass

    async def close(self) -> None:
        pass


# ── In-memory Redis stub ──────────────────────────────────────────────────────

class _FakeRedis:
    def __init__(self) -> None:
        self._data: dict[str, str] = {}

    async def ping(self) -> bool:
        return True

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        self._data[key] = str(value)

    async def get(self, key: str) -> str | None:
        val = self._data.get(key)
        return str(val) if val is not None else None

    async def delete(self, key: str) -> None:
        self._data.pop(key, None)

    async def incr(self, key: str) -> int:
        current = int(self._data.get(key, 0))
        current += 1
        self._data[key] = str(current)
        return current

    async def close(self) -> None:
        pass


class _FakeArqPool:
    async def enqueue_job(self, *args, **kwargs):
        return MagicMock()

    async def close(self):
        pass


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def neo4j_store() -> dict:
    """Shared mutable store for the fake Neo4j driver."""
    return {
        "skills": ["Python", "SQL", "Machine Learning", "Data Analysis",
                   "TensorFlow", "Docker"],
        "roles": ["Data Scientist", "Data Engineer", "ML Engineer"],
        "role_skills": {
            "Data Scientist": ["Python", "SQL", "Machine Learning", "Statistics", "NLP"],
            "Data Engineer": ["Python", "SQL", "Spark", "Kafka", "Docker"],
            "ML Engineer": ["Python", "Machine Learning", "TensorFlow", "PyTorch",
                            "Docker", "Kubernetes"],
        },
        "paths": {
            "Data Analyst": [
                {"role": "Data Scientist", "level": "mid"},
                {"role": "Data Engineer", "level": "mid"},
            ]
        },
        "users": {},
    }


@pytest.fixture
def fake_redis() -> _FakeRedis:
    return _FakeRedis()


@pytest_asyncio.fixture
async def async_client(
    neo4j_store: dict,
    fake_redis: _FakeRedis,
) -> AsyncGenerator[AsyncClient, None]:
    """Return an AsyncClient wired to the FastAPI app with all externals mocked."""
    fake_driver = _FakeDriver(neo4j_store)

    async def mock_create_pool(*args, **kwargs):
        return _FakeArqPool()

    with (
        patch("db.neo4j_client._driver", fake_driver),
        patch("db.redis_client._redis", fake_redis),
        patch("db.neo4j_client.init_neo4j", new_callable=AsyncMock),
        patch("db.neo4j_client.close_neo4j", new_callable=AsyncMock),
        patch("db.redis_client.init_redis", new_callable=AsyncMock),
        patch("db.redis_client.close_redis", new_callable=AsyncMock),
        patch("main.create_pool", new_callable=AsyncMock, side_effect=mock_create_pool),
    ):
        from main import app
        app.state.arq_pool = _FakeArqPool()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            yield client


@pytest.fixture
def auth_headers(neo4j_store: dict) -> dict[str, str]:
    """Return JWT auth headers for a pre-registered test user."""
    from core.security import create_access_token, hash_password

    user_id = str(uuid.uuid4())
    neo4j_store["users"][user_id] = {
        "id": user_id,
        "email": "test@example.com",
        "full_name": "Test User",
        "hashed_password": hash_password("password123"),
    }
    token = create_access_token(subject=user_id)
    return {"Authorization": f"Bearer {token}"}
