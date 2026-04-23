"""Skills router — list known skills and synchronous extraction demo."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from core.logging import get_logger
from core.security import get_current_user
from db.neo4j_client import run_query
from services.skill_extractor import extract_skills

router = APIRouter(prefix="/api/skills", tags=["skills"])
logger = get_logger(__name__)


class ExtractRequest(BaseModel):
    text: str


@router.get("/")
async def list_skills(user_id: str = Depends(get_current_user)) -> dict:
    """Return all known Skill nodes from Neo4j."""
    records = await run_query("MATCH (s:Skill) RETURN s.name AS name ORDER BY s.name")
    skills = [r["name"] for r in records]
    return {"skills": skills, "count": len(skills)}


@router.post("/extract")
async def extract(
    body: ExtractRequest,
    user_id: str = Depends(get_current_user),
) -> dict:
    """Synchronously extract skills from free-form *text* (demo endpoint)."""
    skills = await extract_skills(body.text)
    logger.info("Skills extracted via /extract endpoint", extra={"count": len(skills)})
    return {"skills": skills, "count": len(skills)}
