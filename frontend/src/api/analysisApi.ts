/**
 * analysisApi.ts — Typed wrappers for all analysis-related backend endpoints.
 *
 * Mirrors the Pydantic models defined in backend/models/analysis.py.
 */

import client from './client';

// ─── Backend response types ────────────────────────────────────────────────

export interface SalaryRange {
  min: number;
  max: number;
}

export interface LearningResource {
  skill: string;
  resource: string;
  url: string;
}

export interface SkillGapResult {
  /** 0 = perfect match, 1 = no overlap */
  gap_score: number;
  matching_skills: string[];
  missing_skills: string[];
  target_role: string;
  /** AI confidence in the analysis (0–1) */
  confidence: number;
  /** Estimated weeks to close the gap */
  estimated_weeks: number;
  learning_resources: LearningResource[];
  role_summary: string;
  salary_range: SalaryRange;
  /** Job market demand: low | medium | high | very_high */
  demand: string;
}

export interface CareerRecommendation {
  role: string;
  /** 0–1, higher = better match */
  match_score: number;
  next_steps: string[];
  required_skills: string[];
  missing_skills: string[];
  /** Career track: data | ml | engineering | software | platform | leadership | other */
  track: string;
  /** Personalized reason this role fits the candidate */
  why: string;
  salary_range: SalaryRange;
  /** Job market demand: low | medium | high | very_high */
  demand: string;
}

export interface GraphSkillsResponse {
  skills: string[];
  count: number;
}

// ─── API calls ────────────────────────────────────────────────────────────

/**
 * POST /api/analysis/gap
 * Returns a gap score + matching/missing skill lists for the given role.
 */
export async function fetchGapAnalysis(
  resumeSkills: string[],
  targetRole: string,
): Promise<SkillGapResult> {
  return client.post('/api/analysis/gap', {
    resume_skills: resumeSkills,
    target_role: targetRole,
  }) as Promise<SkillGapResult>;
}

/**
 * POST /api/analysis/recommend
 * Returns an ordered list of career path recommendations.
 */
export async function fetchRecommendations(
  skills: string[],
  gapResult?: SkillGapResult | null,
): Promise<CareerRecommendation[]> {
  return client.post('/api/analysis/recommend', {
    skills,
    gap_result: gapResult ?? null,
  }) as Promise<CareerRecommendation[]>;
}

/**
 * GET /api/graph/skills
 * Returns all Skill nodes from the Neo4j graph.
 */
export async function fetchGraphSkills(): Promise<GraphSkillsResponse> {
  return client.get('/api/graph/skills') as Promise<GraphSkillsResponse>;
}
