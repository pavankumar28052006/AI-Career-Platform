/**
 * SkillGraph.tsx — Force-directed skill knowledge graph.
 *
 * Fetches nodes from GET /api/graph/skills on mount (if not already loaded),
 * then displays them as an interactive 2D force graph.
 */
import React, { useState, useMemo, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useGraphStore } from '../store/graphStore';
import { Filter, X, Layers, ChevronRight, AlertCircle, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

// Category → colour map
const CAT_COLORS: Record<string, string> = {
  Frontend:  '#60a5fa',
  Backend:   '#a78bfa',
  DevOps:    '#34d399',
  Database:  '#f59e0b',
  'ML/AI':   '#f472b6',
  General:   '#94a3b8',
};

type SkeletonNodeStyle = {
  width: string;
  height: string;
  left: string;
  top: string;
  opacity: number;
};

const createSkeletonNodeStyles = (count: number): SkeletonNodeStyle[] =>
  Array.from({ length: count }, (_, i) => {
    const base = (i * 9301 + 49297) % 233280;
    const next = (base * 9301 + 49297) % 233280;
    const next2 = (next * 9301 + 49297) % 233280;
    return {
      width: `${40 + (base / 233280) * 60}px`,
      height: '24px',
      left: `${10 + (next / 233280) * 80}%`,
      top: `${10 + (next2 / 233280) * 80}%`,
      opacity: 0.5,
    };
  });

const SkillGraph: React.FC = () => {
  const { nodes, edges, selectedNode, setSelectedNode, isLoading, error, fetchGraphData } = useGraphStore();
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const navigate = useNavigate();
  const skeletonNodeStyles = useMemo(() => createSkeletonNodeStyles(12), []);

  // Fetch on mount if no data yet
  useEffect(() => {
    if (nodes.length === 0 && !isLoading) {
      fetchGraphData();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const categories = useMemo(() => {
    const cats = new Set<string>();
    nodes.forEach(n => { if (n.category) cats.add(n.category); });
    return Array.from(cats);
  }, [nodes]);

  const filteredData = useMemo(() => {
    if (!filterCategory) return { nodes, links: edges };
    const filteredNodes = nodes.filter(n => n.category === filterCategory);
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = edges.filter((e) => {
      const sourceId = typeof e.source === 'string' ? e.source : (e.source as { id?: string })?.id;
      const targetId = typeof e.target === 'string' ? e.target : (e.target as { id?: string })?.id;
      return !!sourceId && !!targetId && nodeIds.has(sourceId) && nodeIds.has(targetId);
    });
    return { nodes: filteredNodes, links: filteredEdges };
  }, [nodes, edges, filterCategory]);

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="relative w-full h-[600px] rounded-3xl overflow-hidden border border-white/10 bg-black/30 flex flex-col items-center justify-center gap-5">
        <div className="shimmer absolute inset-0" />
        <div className="relative z-10 space-y-4 text-center">
          <div className="w-14 h-14 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin mx-auto" />
          <div className="space-y-1">
            <p className="text-white/60 font-semibold text-sm">Building your skill graph…</p>
            <p className="text-white/30 text-xs">Querying knowledge graph</p>
          </div>
        </div>
        {/* Fake skeleton nodes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {skeletonNodeStyles.map((style, i) => (
            <div
              key={i}
              className="skeleton absolute rounded-full"
              style={style}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="relative w-full h-[400px] rounded-3xl border border-red-500/20 bg-red-500/5 flex flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <div>
          <p className="text-white/70 font-semibold">Failed to load skill graph</p>
          <p className="text-white/30 text-sm mt-1">{error}</p>
        </div>
        <button
          onClick={() => fetchGraphData()}
          className="btn-primary px-5 py-2 rounded-xl text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Empty state (backend returned no nodes) ───────────────────────────────
  if (nodes.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full h-[400px] rounded-3xl border border-white/[0.06] bg-white/[0.02] flex flex-col items-center justify-center gap-5 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <UploadCloud className="w-8 h-8 text-blue-400" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white">No Skills in Graph Yet</h3>
          <p className="text-white/40 text-sm max-w-xs">
            Upload your resume to extract skills and build your interactive knowledge graph.
          </p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="btn-primary px-6 py-2.5 rounded-xl text-sm"
        >
          Upload Resume
        </button>
      </motion.div>
    );
  }

  return (
    <div className="relative w-full h-[620px] rounded-3xl overflow-hidden border border-white/10 bg-black/40 backdrop-blur-md">
      {/* ── Filter bar ── */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 p-1.5 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-xl">
        <Filter className="w-3.5 h-3.5 text-white/30 ml-1.5" />
        <button
          onClick={() => setFilterCategory(null)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            !filterCategory ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-white/40 hover:text-white hover:bg-white/5'
          }`}
        >
          All ({nodes.length})
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat === filterCategory ? null : cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterCategory === cat
                ? 'text-white shadow-lg'
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
            style={filterCategory === cat ? { background: CAT_COLORS[cat] + '40', border: `1px solid ${CAT_COLORS[cat]}60` } : {}}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Legend ── */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-1 p-3 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-xl">
        {categories.map(cat => (
          <div key={cat} className="flex items-center gap-2 text-xs text-white/50">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CAT_COLORS[cat] ?? '#94a3b8' }} />
            {cat}
          </div>
        ))}
      </div>

      {/* ── Force graph ── */}
      <ForceGraph2D
        graphData={filteredData}
        nodeLabel="name"
        nodeAutoColorBy="category"
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={(d) => ((d as { value?: number }).value ?? 0.3) * 0.003}
        linkColor={() => 'rgba(255,255,255,0.08)'}
        nodeCanvasObject={(node: Record<string, unknown>, ctx, globalScale) => {
          const label = String(node['name'] ?? '');
          const category = String(node['category'] ?? 'General');
          const color = CAT_COLORS[category] ?? '#94a3b8';
          const isSelected = selectedNode?.id === node['id'];

          const fontSize = Math.max(10, 14 / globalScale);
          ctx.font = `${isSelected ? 'bold ' : ''}${fontSize}px Inter, sans-serif`;
          const textWidth = ctx.measureText(label).width;
          const pad = fontSize * 0.5;
          const bw = textWidth + pad * 2;
          const bh = fontSize + pad;

          // Background pill
          ctx.beginPath();
          const rx = Number(node['x']);
          const ry = Number(node['y']);
          const radius = bh / 2;
          ctx.roundRect(rx - bw / 2, ry - bh / 2, bw, bh, radius);
          ctx.fillStyle = isSelected ? color + '40' : 'rgba(5,10,25,0.85)';
          ctx.fill();

          // Border
          ctx.strokeStyle = isSelected ? color : color + '60';
          ctx.lineWidth = isSelected ? 2 : 1;
          ctx.stroke();

          // Text
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = isSelected ? '#fff' : color;
          ctx.fillText(label, rx, ry);

          node['__bw'] = bw;
          node['__bh'] = bh;
        }}
        nodePointerAreaPaint={(node: Record<string, unknown>, color, ctx) => {
          ctx.fillStyle = color;
          const bw = node['__bw'] as number | undefined;
          const bh = node['__bh'] as number | undefined;
          if (bw && bh) {
            ctx.fillRect(Number(node['x']) - bw / 2, Number(node['y']) - bh / 2, bw, bh);
          }
        }}
        onNodeClick={(node) => setSelectedNode(node as { id: string; name: string; category?: string; confidence?: number; [key: string]: unknown })}
        backgroundColor="transparent"
        cooldownTicks={120}
      />

      {/* ── Node detail panel ── */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute top-0 right-0 w-72 h-full z-20 bg-black/70 backdrop-blur-2xl border-l border-white/10 p-6 flex flex-col gap-6 shadow-2xl"
          >
            {/* Header */}
            <div className="flex justify-between items-start">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                style={{ background: (CAT_COLORS[selectedNode.category ?? 'General'] ?? '#94a3b8') + '20' }}
              >
                <Layers className="w-5 h-5" style={{ color: CAT_COLORS[selectedNode.category ?? 'General'] ?? '#94a3b8' }} />
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-white/40" />
              </button>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto scroll-thin">
              <div>
                <h3 className="text-xl font-bold text-white">{selectedNode.name}</h3>
                <p className="text-sm font-medium mt-0.5" style={{ color: CAT_COLORS[selectedNode.category ?? 'General'] ?? '#94a3b8' }}>
                  {selectedNode.category ?? 'Skill'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] text-center">
                  <p className="text-[10px] uppercase tracking-wider text-white/30 font-bold mb-1">Confidence</p>
                  <p className="text-lg font-black text-white">
                    {((selectedNode.confidence ?? 0.85) * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] text-center">
                  <p className="text-[10px] uppercase tracking-wider text-white/30 font-bold mb-1">Category</p>
                  <p className="text-xs font-bold text-white">{selectedNode.category ?? 'General'}</p>
                </div>
              </div>

              {/* Confidence bar */}
              <div className="space-y-2">
                <p className="text-[11px] text-white/40 font-bold uppercase tracking-wider">Proficiency</p>
                <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: CAT_COLORS[selectedNode.category ?? 'General'] ?? '#94a3b8' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(selectedNode.confidence ?? 0.85) * 100}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
              </div>

              {/* Related skills placeholder */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/30">
                  Other {selectedNode.category} Skills
                </h4>
                <div className="space-y-1.5">
                  {filteredData.nodes
                    .filter(n => n.category === selectedNode.category && n.id !== selectedNode.id)
                    .slice(0, 4)
                    .map(skill => (
                      <div
                        key={skill.id}
                        onClick={() => setSelectedNode(skill)}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] cursor-pointer transition-colors group"
                      >
                        <span className="text-xs font-medium text-white/70 group-hover:text-white">{skill.name}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-blue-400 transition-colors" />
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SkillGraph;
