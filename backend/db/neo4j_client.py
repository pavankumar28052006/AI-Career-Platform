"""Async Neo4j driver singleton."""

from typing import Any, Optional

from neo4j import AsyncDriver, AsyncGraphDatabase

from core.config import get_settings
from core.logging import get_logger

logger = get_logger(__name__)
_driver: Optional[AsyncDriver] = None


async def init_neo4j() -> None:
    """Initialise the Neo4j async driver. Called once at app startup."""
    global _driver
    settings = get_settings()
    _driver = AsyncGraphDatabase.driver(
        settings.neo4j_uri,
        auth=(settings.neo4j_user, settings.neo4j_password),
    )
    # Verify connectivity
    await _driver.verify_connectivity()
    logger.info("Neo4j connected", extra={"uri": settings.neo4j_uri})


async def close_neo4j() -> None:
    """Close the Neo4j driver. Called once at app shutdown."""
    global _driver
    if _driver:
        await _driver.close()
        _driver = None
        logger.info("Neo4j connection closed")


def get_driver() -> AsyncDriver:
    """Return the shared AsyncDriver. Raises if not yet initialised."""
    if _driver is None:
        raise RuntimeError("Neo4j driver is not initialised. Call init_neo4j() first.")
    return _driver


async def run_query(cypher: str, params: Optional[dict] = None) -> list[dict[str, Any]]:
    """Execute a Cypher query and return all records as plain dicts."""
    driver = get_driver()
    async with driver.session() as session:
        result = await session.run(cypher, params or {})
        records = await result.data()
        return records
