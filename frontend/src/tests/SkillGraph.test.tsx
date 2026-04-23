import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SkillGraph from '../components/SkillGraph';
import { useGraphStore } from '../store/graphStore';
import { MemoryRouter } from 'react-router-dom';

// Mock the store
vi.mock('../store/graphStore', () => ({
  useGraphStore: vi.fn(),
}));

// Mock ForceGraph2D as it's hard to test canvas-based components in JSDOM
vi.mock('react-force-graph-2d', () => ({
  default: () => <div data-testid="force-graph" />,
}));

describe('SkillGraph Component', () => {
  const mockNodes = [
    { id: '1', name: 'React', category: 'Frontend' },
    { id: '2', name: 'Node.js', category: 'Backend' },
  ];
  const mockEdges = [{ source: '1', target: '2' }];
  const mockSetSelectedNode = vi.fn();

  beforeEach(() => {
    vi.mocked(useGraphStore).mockReturnValue({
      nodes: mockNodes,
      edges: mockEdges,
      selectedNode: null,
      setSelectedNode: mockSetSelectedNode,
      setGraphData: vi.fn(),
      isLoading: false,
      error: null,
      fetchGraphData: vi.fn(),
    });
  });

  it('renders the graph and allows category filtering', () => {
    render(
      <MemoryRouter>
        <SkillGraph />
      </MemoryRouter>
    );
    
    expect(screen.getByTestId('force-graph')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /frontend/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /backend/i })).toBeInTheDocument();
  });

  it('shows the detail panel when a node is selected', () => {
    vi.mocked(useGraphStore).mockReturnValue({
      nodes: mockNodes,
      edges: mockEdges,
      selectedNode: { id: '1', name: 'React', category: 'Frontend', confidence: 0.9 },
      setSelectedNode: mockSetSelectedNode,
      setGraphData: vi.fn(),
      isLoading: false,
      error: null,
      fetchGraphData: vi.fn(),
    });

    render(
      <MemoryRouter>
        <SkillGraph />
      </MemoryRouter>
    );

    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getAllByText('Frontend')[0]).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
  });
});
