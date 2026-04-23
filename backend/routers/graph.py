"""Neo4j graph router — user skill nodes and AI-powered career path queries.

User skill data (HAS_SKILL relationships) is stored in Neo4j.
Career path intelligence is provided by the AI model (no hardcoded LEADS_TO edges needed).
"""

from fastapi import APIRouter, Depends

from core.errors import ErrorCode, raise_error
from core.logging import get_logger
from core.security import get_current_user
from db.neo4j_client import run_query
from services.ai_career_service import ai_career_path_map

router = APIRouter(prefix="/api/graph", tags=["graph"])
logger = get_logger(__name__)


@router.get("/skills")
async def list_skill_nodes(user_id: str = Depends(get_current_user)) -> dict:
    """Return all Skill nodes linked to the current user from the Neo4j graph."""
    records = await run_query(
        "MATCH (u:User {id: $user_id})-[:HAS_SKILL]->(s:Skill) RETURN s.name AS name ORDER BY s.name",
        {"user_id": user_id}
    )
    skills = [r["name"] for r in records]
    return {"skills": skills, "count": len(skills)}


@router.get("/paths/{role}")
async def get_career_paths(role: str, user_id: str = Depends(get_current_user)) -> dict:
    """
    Return AI-generated career progression paths from *role*.

    Uses the AI model to determine realistic next roles and progression tracks —
    no hardcoded LEADS_TO graph edges needed.
    """
    data = await ai_career_path_map(current_role=role)

    if not data.get("recommended_next") and not data.get("progression_paths"):
        raise_error(
            404,
            ErrorCode.GRAPH_NODE_NOT_FOUND,
            f"Could not generate a career map for role '{role}'.",
        )

    logger.info("Career paths returned via AI", extra={"role": role, "user_id": user_id})
    return {
        "from_role": role,
        "recommended_next": data.get("recommended_next", []),
        "progression_paths": data.get("progression_paths", []),
        "timeline_years": data.get("timeline_years", {}),
        "key_skills_to_grow": data.get("key_skills_to_grow", []),
    }

