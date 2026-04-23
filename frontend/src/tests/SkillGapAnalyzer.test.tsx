import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SkillGapAnalyzer from '../components/SkillGapAnalyzer';
import { useAnalysisStore } from '../store/analysisStore';
import { useGraphStore } from '../store/graphStore';
import { MemoryRouter } from 'react-router-dom';

// Mock the store
vi.mock('../store/analysisStore', () => ({
  useAnalysisStore: vi.fn(),
}));

vi.mock('../store/graphStore', () => ({
  useGraphStore: vi.fn(),
}));

describe('SkillGapAnalyzer Component', () => {
  it('renders correctly with gap data and sorts by importance', () => {
    vi.mocked(useGraphStore).mockReturnValue({
      isLoading: false,
    } as never);

    vi.mocked(useAnalysisStore).mockReturnValue({
      gapResult: {
        gap_score: 0.25,
        target_role: 'Backend Engineer',
        matching_skills: ['Python'],
        missing_skills: ['Docker', 'Redis'],
      },
      extractedSkills: ['Python'],
      isLoadingGap: false,
      setGapResult: vi.fn(),
      setLoadingGap: vi.fn(),
      refreshSkills: vi.fn(),
    });

    render(
      <MemoryRouter>
        <SkillGapAnalyzer />
      </MemoryRouter>
    );

    expect(screen.getAllByText('75%')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Backend Engineer')[0]).toBeInTheDocument();

    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Docker');
    expect(rows[2]).toHaveTextContent('Redis');
  });
});
