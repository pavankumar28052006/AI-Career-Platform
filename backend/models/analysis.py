"""Analysis result Pydantic models — AI-driven, richly typed."""

from typing import Optional

from pydantic import BaseModel, Field


# ── Shared sub-models ──────────────────────────────────────────────────────────

class SalaryRange(BaseModel):
    min: int = Field(0, description="Minimum annual salary in USD")
    max: int = Field(0, description="Maximum annual salary in USD")


class LearningResource(BaseModel):
    skill: str
    resource: str
    url: str


# ── Gap Analysis ───────────────────────────────────────────────────────────────

class SkillGapResult(BaseModel):
    """Output of the AI-powered skill gap analyser."""

    gap_score: float = Field(
        description="0 = perfect match, 1 = no overlap."
    )
    matching_skills: list[str]
    missing_skills: list[str]
    target_role: str

    # AI-enriched fields
    confidence: float = Field(0.0, ge=0.0, le=1.0, description="AI confidence in the analysis")
    estimated_weeks: int = Field(0, description="Estimated weeks to close the skill gap")
    learning_resources: list[LearningResource] = Field(default_factory=list)
    role_summary: str = Field("", description="Brief description of the target role")
    salary_range: SalaryRange = Field(default_factory=SalaryRange)
    demand: str = Field("medium", description="Job market demand: low | medium | high | very_high")


# ── Career Recommendations ─────────────────────────────────────────────────────

class CareerRecommendation(BaseModel):
    """A single AI-recommended career path entry."""

    role: str
    match_score: float = Field(ge=0.0, le=1.0)
    next_steps: list[str]
    required_skills: list[str]
    missing_skills: list[str]

    # AI-enriched fields
    track: str = Field("other", description="Career track: data | ml | engineering | software | platform | leadership")
    why: str = Field("", description="Personalized reason this role fits the candidate")
    salary_range: SalaryRange = Field(default_factory=SalaryRange)
    demand: str = Field("medium", description="Job market demand")


# ── Request bodies ─────────────────────────────────────────────────────────────

class SkillGapRequest(BaseModel):
    """Request body for POST /api/analysis/gap."""

    resume_skills: list[str]
    target_role: str


class RecommendRequest(BaseModel):
    """Request body for POST /api/analysis/recommend."""

    skills: list[str]
    gap_result: Optional[SkillGapResult] = None


# ── Career Path Map ────────────────────────────────────────────────────────────

class ProgressionPath(BaseModel):
    path_name: str
    steps: list[str]


class CareerPathMap(BaseModel):
    """AI-generated career progression map."""

    current_role: str
    recommended_next: list[str]
    progression_paths: list[ProgressionPath]
    timeline_years: dict[str, int]
    key_skills_to_grow: list[str]


class CareerPathRequest(BaseModel):
    """Request body for POST /api/analysis/career-map."""

    current_role: str
    target_role: Optional[str] = None

