import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchGraphSkills } from '../api/analysisApi';

export interface GraphNode {
  id: string;
  name: string;
  category?: string;
  confidence?: number;
  [key: string]: unknown;
}

export interface GraphEdge {
  source: string;
  target: string;
  [key: string]: unknown;
}

interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNode: GraphNode | null;
  isLoading: boolean;
  error: string | null;
  setGraphData: (nodes: GraphNode[], edges: GraphEdge[]) => void;
  setSelectedNode: (node: GraphNode | null) => void;
  fetchGraphData: (force?: boolean) => Promise<void>;
}

function inferCategory(name: string): string {
  const n = name.toLowerCase();
  if (/react|vue|angular|html|css|tailwind|next|svelte|redux|typescript|javascript/.test(n)) return 'Frontend';
  if (/python|django|fastapi|flask|node|express|java|spring|go|rust|ruby|rails/.test(n)) return 'Backend';
  if (/aws|gcp|azure|docker|kubernetes|terraform|ci\/cd|jenkins|github actions/.test(n)) return 'DevOps';
  if (/postgres|mysql|mongo|redis|neo4j|sql|sqlite|dynamo/.test(n)) return 'Database';
  if (/machine learning|deep learning|nlp|pytorch|tensorflow|scikit|pandas|numpy/.test(n)) return 'ML/AI';
  return 'General';
}

function buildEdges(nodes: GraphNode[]): GraphEdge[] {
  const byCategory: Record<string, GraphNode[]> = {};
  nodes.forEach((n) => {
    const cat = n.category ?? 'General';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(n);
  });

  const edges: GraphEdge[] = [];
  Object.values(byCategory).forEach((group) => {
    if (group.length < 2) return;
    const hub = group[0];
    for (let i = 1; i < group.length; i++) {
      edges.push({ source: hub.id, target: group[i].id, value: 0.5 });
    }
    const cats = Object.keys(byCategory);
    const idx = cats.indexOf(group[0].category ?? 'General');
    if (idx > 0) {
      const prevHub = byCategory[cats[idx - 1]][0];
      edges.push({ source: hub.id, target: prevHub.id, value: 0.3 });
    }
  });
  return edges;
}

export const useGraphStore = create<GraphState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      selectedNode: null,
      isLoading: false,
      error: null,

      setGraphData: (nodes, edges) => set({ nodes, edges }),
      setSelectedNode: (node) => set({ selectedNode: node }),

      fetchGraphData: async (force = false) => {
        if (get().isLoading) return;
        if (!force && get().nodes.length > 0) return;

        set({ isLoading: true, error: null });
        try {
          const data = await fetchGraphSkills();
          const nodes: GraphNode[] = data.skills.map((name, i) => ({
            id: String(i),
            name,
            category: inferCategory(name),
            confidence: 0.7 + Math.random() * 0.3,
          }));
          const edges = buildEdges(nodes);
          set({ nodes, edges, isLoading: false });
        } catch (err) {
          set({ error: (err as { message?: string }).message ?? 'Failed to load graph.', isLoading: false });
        }
      },
    }),
    {
      name: 'graph-storage',
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
      }),
    }
  )
);
