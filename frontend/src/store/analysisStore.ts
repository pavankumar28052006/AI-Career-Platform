import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchGraphSkills } from '../api/analysisApi';
import type { SkillGapResult, CareerRecommendation } from '../api/analysisApi';

// ─── Roadmap step shape (UI-friendly, mapped from CareerRecommendation) ────

export interface RoadmapStep {
  title: string;
  description: string;
  skills: string[];
  resources: Array<{ title: string; url: string }>;
}

export function toRoadmapStep(rec: CareerRecommendation): RoadmapStep {
  return {
    title: `Transition to ${rec.role}`,
    description: rec.why
      ? rec.why
      : `You currently match ${Math.round(rec.match_score * 100)}% of the requirements for ${rec.role}. Focus on the skills listed below to bridge the gap.`,
    skills: rec.required_skills.slice(0, 6),
    resources: rec.next_steps.slice(0, 4).map((step) => ({
      title: step,
      url: '#',
    })),
  };
}

// ─── Store interface ───────────────────────────────────────────────────────

interface AnalysisState {
  gapResult: SkillGapResult | null;
  extractedSkills: string[];
  roadmap: RoadmapStep[];
  isLoadingGap: boolean;
  isLoadingRoadmap: boolean;

  setGapResult: (result: SkillGapResult | null) => void;
  setExtractedSkills: (skills: string[]) => void;
  setRoadmap: (roadmap: RoadmapStep[]) => void;
  setLoadingGap: (v: boolean) => void;
  setLoadingRoadmap: (v: boolean) => void;
  refreshSkills: () => Promise<void>;
}

export const useAnalysisStore = create<AnalysisState>()(
  persist(
    (set) => ({
      gapResult: null,
      extractedSkills: [],
      roadmap: [],
      isLoadingGap: false,
      isLoadingRoadmap: false,

      setGapResult: (result) => set({ gapResult: result }),
      setExtractedSkills: (skills) => set({ extractedSkills: skills }),
      setRoadmap: (roadmap) => set({ roadmap }),
      setLoadingGap: (v) => set({ isLoadingGap: v }),
      setLoadingRoadmap: (v) => set({ isLoadingRoadmap: v }),

      refreshSkills: async () => {
        try {
          const data = await fetchGraphSkills();
          set({ extractedSkills: data.skills });
        } catch (err) {
          console.error("Failed to refresh skills:", err);
        }
      },
    }),
    {
      name: 'analysis-storage',
      // Only persist non-loading state
      partialize: (state) => ({
        extractedSkills: state.extractedSkills,
        gapResult: state.gapResult,
        roadmap: state.roadmap,
      }),
    }
  )
);
