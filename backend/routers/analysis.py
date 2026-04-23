"""Analysis router — AI-powered skill gap analysis, career recommendations, and path mapping.

All role/skill intelligence is provided by the AI model (GPT-4o-mini).
No hardcoded role data is needed — any role name is supported dynamically.
"""

from fastapi import APIRouter, Depends

from core.logging import get_logger
from core.security import get_current_user
from models.analysis import (
    CareerPathMap,
    CareerPathRequest,
    CareerRecommendation,
    RecommendRequest,
    SkillGapRequest,
    SkillGapResult,
    LearningResource,
    SalaryRange,
)
from services.ai_career_service import (
    ai_analyze_gap,
    ai_career_path_map,
    ai_recommend_careers,
)

router = APIRouter(prefix="/api/analysis", tags=["analysis"])
logger = get_logger(__name__)


@router.post("/gap", response_model=SkillGapResult)
async def skill_gap(
    body: SkillGapRequest,
    user_id: str = Depends(get_current_user),
) -> SkillGapResult:
    """
    AI-powered skill gap analysis for any target role.

    The AI model determines what skills the role requires, computes the gap,
    and returns learning resources, timeline estimates, and salary info.
    No predefined role list — any role name is accepted.
    """
    data = await ai_analyze_gap(body.resume_skills, body.target_role)

    logger.info(
        "Gap analysis requested",
        extra={"user_id": user_id, "role": body.target_role, "gap_score": data.get("gap_score")},
    )

    # Coerce learning_resources dicts → LearningResource objects
    resources = [
        LearningResource(**r) if isinstance(r, dict) else r
        for r in data.get("learning_resources", [])
    ]

    salary_raw = data.get("salary_range", {})
    salary = SalaryRange(
        min=salary_raw.get("min", 0) if isinstance(salary_raw, dict) else 0,
        max=salary_raw.get("max", 0) if isinstance(salary_raw, dict) else 0,
    )

    return SkillGapResult(
        gap_score=float(data.get("gap_score", 1.0)),
        matching_skills=data.get("matching_skills", []),
        missing_skills=data.get("missing_skills", []),
        target_role=body.target_role,
        confidence=float(data.get("confidence", 0.0)),
        estimated_weeks=int(data.get("estimated_weeks", 0)),
        learning_resources=resources,
        role_summary=data.get("role_summary", ""),
        salary_range=salary,
        demand=data.get("demand", "medium"),
    )


@router.post("/recommend", response_model=list[CareerRecommendation])
async def recommend(
    body: RecommendRequest,
    user_id: str = Depends(get_current_user),
) -> list[CareerRecommendation]:
    """
    AI-powered career path recommendations based on the candidate's skills.

    Returns 8 best-fit roles with match scores, salary ranges, demand signals,
    and personalised next steps. No predefined role list required.
    """
    recommendations = await ai_recommend_careers(body.skills)

    logger.info(
        "Recommendations generated",
        extra={"user_id": user_id, "count": len(recommendations)},
    )

    result = []
    for rec in recommendations:
        salary_raw = rec.get("salary_range", {})
        salary = SalaryRange(
            min=salary_raw.get("min", 0) if isinstance(salary_raw, dict) else 0,
            max=salary_raw.get("max", 0) if isinstance(salary_raw, dict) else 0,
        )
        result.append(
            CareerRecommendation(
                role=rec.get("role", ""),
                match_score=float(rec.get("match_score", 0.0)),
                next_steps=rec.get("next_steps", []),
                required_skills=rec.get("required_skills", []),
                missing_skills=rec.get("missing_skills", []),
                track=rec.get("track", "other"),
                why=rec.get("why", ""),
                salary_range=salary,
                demand=rec.get("demand", "medium"),
            )
        )
    return result


@router.post("/career-map", response_model=CareerPathMap)
async def career_map(
    body: CareerPathRequest,
    user_id: str = Depends(get_current_user),
) -> CareerPathMap:
    """
    AI-generated career progression map from a current role.

    Returns recommended next roles, multi-step progression paths,
    timeline estimates, and key skills to develop for advancement.
    """
    data = await ai_career_path_map(body.current_role, body.target_role)

    logger.info(
        "Career map generated",
        extra={"user_id": user_id, "role": body.current_role},
    )

    from models.analysis import ProgressionPath
    paths = [
        ProgressionPath(path_name=p.get("path_name", ""), steps=p.get("steps", []))
        if isinstance(p, dict) else p
        for p in data.get("progression_paths", [])
    ]

    return CareerPathMap(
        current_role=data.get("current_role", body.current_role),
        recommended_next=data.get("recommended_next", []),
        progression_paths=paths,
        timeline_years=data.get("timeline_years", {}),
        key_skills_to_grow=data.get("key_skills_to_grow", []),
    )

