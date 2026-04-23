"""Neo4j seed / migration script.

Responsibilities:
  - Create uniqueness constraints and indexes for performance.
  - Skill nodes extracted from user resumes are created dynamically by job_service.py.
  - Role definitions and career paths are handled by the AI model (ai_career_service.py).
    There is no static role or skill seed data — any role name is supported dynamically.

Usage::

    python -m db.seed
"""

import asyncio

from db.neo4j_client import close_neo4j, init_neo4j, run_query
from core.logging import get_logger

logger = get_logger(__name__)


async def seed() -> None:
    """Create Neo4j schema constraints and indexes."""
    await init_neo4j()
    try:
        # ── Uniqueness constraints ────────────────────────────────────────────
        # Prevent duplicate User nodes by email and id
        await run_query(
            "CREATE CONSTRAINT user_id_unique IF NOT EXISTS "
            "FOR (u:User) REQUIRE u.id IS UNIQUE"
        )
        await run_query(
            "CREATE CONSTRAINT user_email_unique IF NOT EXISTS "
            "FOR (u:User) REQUIRE u.email IS UNIQUE"
        )

        # Prevent duplicate Skill nodes by name
        await run_query(
            "CREATE CONSTRAINT skill_name_unique IF NOT EXISTS "
            "FOR (s:Skill) REQUIRE s.name IS UNIQUE"
        )

        # ── Indexes for query performance ─────────────────────────────────────
        # Index on Skill name for fast MERGE during resume processing
        await run_query(
            "CREATE INDEX skill_name_index IF NOT EXISTS "
            "FOR (s:Skill) ON (s.name)"
        )

        logger.info(
            "Neo4j schema setup complete. "
            "Constraints: user_id_unique, user_email_unique, skill_name_unique. "
            "Index: skill_name_index."
        )
        logger.info(
            "NOTE: Role/skill data is now AI-driven (no seed data required). "
            "Any role name is supported dynamically via the OpenAI API."
        )

    finally:
        await close_neo4j()


if __name__ == "__main__":
    asyncio.run(seed())
