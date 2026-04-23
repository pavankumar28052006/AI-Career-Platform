"""AI Career Service — GPT-powered role analysis, gap scoring, and career path recommendation.

This module replaces the static Neo4j role/skill graph with dynamic AI inference.
The AI model determines required skills, gap scores, and career paths on-the-fly,
meaning ANY role name is supported — not just a predefined list.

Cache strategy: Redis → OpenAI (gpt-4o-mini with structured output) → graceful fallback
Cache TTL: 7 days for role skills (stable data), 1 day for recommendations (personalized).
"""

import hashlib
import json
from typing import Optional

from tenacity import retry, stop_after_attempt, wait_exponential

from core.config import get_settings
from core.logging import get_logger
from db.redis_client import cache_get, cache_set

logger = get_logger(__name__)

_ROLE_SKILLS_TTL = 604_800   # 7 days — role skill requirements are stable
_RECOMMEND_TTL   = 86_400    # 1 day  — recommendations are personalized


# ── Cache helpers ─────────────────────────────────────────────────────────────

def _role_cache_key(role: str) -> str:
    return "ai:role_skills:" + hashlib.sha256(role.lower().encode()).hexdigest()


def _recommend_cache_key(skills: list[str]) -> str:
    key_str = ",".join(sorted(s.lower() for s in skills))
    return "ai:recommend:" + hashlib.sha256(key_str.encode()).hexdigest()


def _gap_cache_key(skills: list[str], role: str) -> str:
    skills_str = ",".join(sorted(s.lower() for s in skills))
    key_str = f"{role.lower()}::{skills_str}"
    return "ai:gap:" + hashlib.sha256(key_str.encode()).hexdigest()


# ── OpenAI helpers ────────────────────────────────────────────────────────────

def _get_client():
    import openai
    settings = get_settings()
    # Point the OpenAI library to Groq's compatible endpoints
    return openai.AsyncOpenAI(
        api_key=settings.openai_api_key, 
        base_url="https://api.groq.com/openai/v1"
    )


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def _chat(system: str, user: str, max_tokens: int = 800) -> str:
    """Call GPT and return the raw text content."""
    client = _get_client()
    response = await client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        temperature=0.2,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
    )
    return response.choices[0].message.content or "{}"


# ── 1. Role Skill Requirements ────────────────────────────────────────────────

async def get_role_required_skills(role: str) -> dict:
    """
    Ask the AI what skills are required for a given role.

    Returns a dict with:
        required_skills: list[str]
        core_skills: list[str]      — must-have subset
        nice_to_have: list[str]     — bonus skills
        seniority_hint: str         — "junior" | "mid" | "senior"
        avg_salary_inr: dict        — {"min": int, "max": int}
        demand: str                 — "low" | "medium" | "high" | "very_high"
    """
    cache_key = _role_cache_key(role)
    cached = await cache_get(cache_key)
    if cached is not None:
        logger.info("Role skills cache hit", extra={"role": role})
        return cached  # type: ignore[return-value]

    system = (
        "You are a senior technical recruiter and career coach with deep knowledge of the "
        "software engineering and data science job market. "
        "Always respond with valid JSON only — no markdown, no explanation."
    )
    user = (
        f'Provide a structured skill profile for the role: "{role}".\n\n'
        "Return a JSON object with exactly these keys:\n"
        '  "required_skills": [list of 8-15 technical skill strings],\n'
        '  "core_skills": [list of 4-6 must-have skills from required_skills],\n'
        '  "nice_to_have": [list of 3-5 bonus skills NOT in required_skills],\n'
        '  "seniority_hint": "junior" | "mid" | "senior",\n'
        '  "avg_salary_inr": {"min": integer, "max": integer} (in INR),\n'
        '  "demand": "low" | "medium" | "high" | "very_high",\n'
        '  "summary": "one sentence describing the role"\n'
        "\nSkill strings must be concise and industry-standard (e.g. 'Python', 'React', 'Kubernetes')."
    )

    try:
        raw = await _chat(system, user, max_tokens=600)
        data = json.loads(raw)
        # Validate essential keys exist
        if "required_skills" not in data or not data["required_skills"]:
            raise ValueError("Missing required_skills in AI response")
        await cache_set(cache_key, data, ttl=_ROLE_SKILLS_TTL)
        logger.info("Role skills fetched from AI", extra={"role": role, "count": len(data["required_skills"])})
        return data
    except Exception as exc:
        logger.error("AI role skill fetch failed", extra={"role": role, "error": str(exc)})
        # Graceful fallback — return an empty but valid structure
        return {
            "required_skills": [],
            "core_skills": [],
            "nice_to_have": [],
            "seniority_hint": "mid",
            "avg_salary_inr": {"min": 0, "max": 0},
            "demand": "medium",
            "summary": f"Role profile for {role} could not be generated.",
        }


# ── 2. Skill Gap Analysis ─────────────────────────────────────────────────────

async def ai_analyze_gap(resume_skills: list[str], target_role: str) -> dict:
    """
    Ask the AI to perform a detailed skill gap analysis.

    Returns a dict with:
        gap_score: float (0=perfect match, 1=no overlap)
        matching_skills: list[str]
        missing_skills: list[str]
        target_role: str
        confidence: float
        estimated_weeks: int
        learning_resources: list[{"skill": str, "resource": str, "url": str}]
        role_summary: str
        salary_range: {"min": int, "max": int}
        demand: str
    """
    cache_key = _gap_cache_key(resume_skills, target_role)
    cached = await cache_get(cache_key)
    if cached is not None:
        logger.info("Gap analysis cache hit", extra={"role": target_role})
        return cached  # type: ignore[return-value]

    skills_str = ", ".join(resume_skills) if resume_skills else "none"

    system = (
        "You are an expert technical career advisor. Analyze skill gaps precisely. "
        "Always respond with valid JSON only — no markdown, no explanation."
    )
    user = (
        f'Analyze the skill gap between a candidate and the role "{target_role}".\n\n'
        f"Candidate's current skills: {skills_str}\n\n"
        "Return a JSON object with exactly these keys:\n"
        '  "gap_score": float between 0.0 (perfect match) and 1.0 (no overlap),\n'
        '  "matching_skills": [skills from candidate that match the role requirements],\n'
        '  "missing_skills": [skills the role requires that the candidate lacks, ordered by importance],\n'
        '  "confidence": float between 0.0 and 1.0 (how confident you are in this analysis),\n'
        '  "estimated_weeks": integer (realistic weeks to close the gap with focused study),\n'
        '  "learning_resources": [\n'
        '    {"skill": "skill name", "resource": "resource title", "url": "https://..."}\n'
        "    (3-5 items for the most critical missing skills, use real well-known resources)\n"
        "  ],\n"
        '  "role_summary": "brief description of the role",\n'
        '  "salary_range": {"min": integer, "max": integer},\n'
        '  "demand": "low" | "medium" | "high" | "very_high"\n'
        "\nBe realistic and precise. gap_score should reflect actual overlap, not just count."
    )

    try:
        raw = await _chat(system, user, max_tokens=800)
        data = json.loads(raw)
        data["target_role"] = target_role
        await cache_set(cache_key, data, ttl=86_400)  # 1 day
        logger.info(
            "AI gap analysis complete",
            extra={"role": target_role, "gap_score": data.get("gap_score"), "missing": len(data.get("missing_skills", []))},
        )
        return data
    except Exception as exc:
        logger.error("AI gap analysis failed", extra={"role": target_role, "error": str(exc)})
        return {
            "gap_score": 1.0,
            "matching_skills": [],
            "missing_skills": [],
            "target_role": target_role,
            "confidence": 0.0,
            "estimated_weeks": 0,
            "learning_resources": [],
            "role_summary": "Analysis could not be completed.",
            "salary_range": {"min": 0, "max": 0},
            "demand": "unknown",
        }


# ── 3. Career Path Recommendations ───────────────────────────────────────────

async def ai_recommend_careers(skills: list[str]) -> list[dict]:
    """
    Ask the AI to recommend career paths based on the candidate's skills.

    Returns a list of dicts, each with:
        role: str
        match_score: float
        next_steps: list[str]
        required_skills: list[str]
        missing_skills: list[str]
        salary_range: {"min": int, "max": int}
        demand: str
        track: str
        why: str   — personalized explanation
    """
    cache_key = _recommend_cache_key(skills)
    cached = await cache_get(cache_key)
    if cached is not None:
        logger.info("Career recommendations cache hit")
        return cached  # type: ignore[return-value]

    skills_str = ", ".join(skills) if skills else "none"

    system = (
        "You are an expert technical career advisor. Recommend realistic, personalized career paths. "
        "Always respond with valid JSON only — no markdown, no explanation."
    )
    user = (
        "Based on the following candidate skills, recommend the top 8 best-fit career roles.\n\n"
        f"Candidate's skills: {skills_str}\n\n"
        "Return a JSON object with key 'recommendations' containing a list of 8 role objects.\n"
        "Each role object must have exactly these keys:\n"
        '  "role": "role title",\n'
        '  "match_score": float between 0.0 and 1.0 (based on actual skill overlap),\n'
        '  "track": "data" | "ml" | "engineering" | "software" | "platform" | "leadership" | "other",\n'
        '  "why": "1-2 sentence personalized reason why this fits their skills",\n'
        '  "required_skills": [6-10 key skills for this role],\n'
        '  "missing_skills": [skills they lack for this role, ordered by importance],\n'
        '  "next_steps": ["Learn X", "Build a project with Y", ...] (3-4 actionable steps),\n'
        '  "salary_range": {"min": integer, "max": integer},\n'
        '  "demand": "low" | "medium" | "high" | "very_high"\n\n'
        "Order the list by match_score descending. Be realistic — not everything should be high match."
    )

    try:
        raw = await _chat(system, user, max_tokens=1200)
        data = json.loads(raw)
        recommendations = data.get("recommendations", [])
        await cache_set(cache_key, recommendations, ttl=_RECOMMEND_TTL)
        logger.info("AI career recommendations generated", extra={"count": len(recommendations)})
        return recommendations
    except Exception as exc:
        logger.error("AI career recommendation failed", extra={"error": str(exc)})
        return []


# ── 4. Career Path Map ────────────────────────────────────────────────────────

async def ai_career_path_map(current_role: str, target_role: Optional[str] = None) -> dict:
    """
    Ask the AI to generate a career progression map from current_role.

    Returns:
        current_role: str
        progression_paths: list of paths, each path being a list of role steps
        recommended_next: list[str]  — immediate next roles
        timeline_years: dict[str, int]  — role → typical years to reach it
    """
    cache_key = "ai:path:" + hashlib.sha256(f"{current_role}:{target_role}".encode()).hexdigest()
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    system = (
        "You are a senior engineering career strategist. Always respond with valid JSON only."
    )

    target_clause = f' The candidate wants to eventually reach: "{target_role}".' if target_role else ""
    user = (
        f'Generate a career progression map for someone currently at the "{current_role}" level.{target_clause}\n\n'
        "Return a JSON object with exactly these keys:\n"
        '  "current_role": the current role string,\n'
        '  "recommended_next": [list of 2-3 immediate next role titles],\n'
        '  "progression_paths": [\n'
        '    {"path_name": "e.g. ML Track", "steps": ["Role A", "Role B", "Role C"]}\n'
        "  ],\n"
        '  "timeline_years": {"Role Title": estimated_years_integer, ...},\n'
        '  "key_skills_to_grow": [list of 5 skills to focus on for advancement]\n'
    )

    try:
        raw = await _chat(system, user, max_tokens=700)
        data = json.loads(raw)
        data["current_role"] = current_role
        await cache_set(cache_key, data, ttl=_ROLE_SKILLS_TTL)
        return data
    except Exception as exc:
        logger.error("AI career path map failed", extra={"error": str(exc)})
        return {
            "current_role": current_role,
            "recommended_next": [],
            "progression_paths": [],
            "timeline_years": {},
            "key_skills_to_grow": [],
        }
