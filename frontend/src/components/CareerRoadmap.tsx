/**
 * CareerRoadmap.tsx — Phased learning roadmap wired to POST /api/analysis/recommend.
 *
 * Maps CareerRecommendation[] from the backend into UI-friendly RoadmapStep[] via the store.
 * Displays salary ranges, demand signals, personalized reasons, and a working export.
 */
import React, { useEffect } from 'react';
import { useAnalysisStore, toRoadmapStep } from '../store/analysisStore';
import { useGraphStore } from '../store/graphStore';
import { fetchRecommendations } from '../api/analysisApi';
import type { CareerRecommendation } from '../api/analysisApi';
import { motion, type Variants } from 'framer-motion';
import {
  BookOpen, Download, UploadCloud,
  RefreshCw, Map, IndianRupee, TrendingUp, Lightbulb,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/cn';

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.15 } },
};

const item: Variants = {
  hidden: { opacity: 0, x: -20 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};

const DEMAND_COLORS: Record<string, string> = {
  very_high: 'badge-green',
  high:      'badge-blue',
  medium:    'badge-amber',
  low:       'badge-red',
};

// ── Skeleton card ─────────────────────────────────────────────────────────────
const SkeletonCard = ({ index }: { index: number }) => (
  <div className="relative pl-20">
    <div className="absolute left-5 top-5 w-6 h-6 skeleton rounded-full" />
    <div className="glass rounded-2xl p-6 space-y-4">
      <div className="skeleton h-3 w-16 rounded" />
      <div className="skeleton h-5 w-56 rounded" />
      <div className="skeleton h-4 w-full rounded" />
      <div className="skeleton h-4 w-4/5 rounded" />
      <div className="flex gap-2">
        {[0,1,2].map(i => <div key={i} className="skeleton h-6 w-16 rounded-lg" style={{ animationDelay: `${index * 0.1 + i * 0.05}s` }} />)}
      </div>
    </div>
  </div>
);

// ── Export utility ────────────────────────────────────────────────────────────
function exportRoadmapAsText(recs: CareerRecommendation[]): void {
  const lines: string[] = [
    'AI Career Platform — Personalised Learning Roadmap',
    '='.repeat(52),
    `Generated: ${new Date().toLocaleString()}`,
    '',
  ];

  recs.forEach((rec, i) => {
    lines.push(`Step ${String(i + 1).padStart(2, '0')} — Transition to ${rec.role}`);
    lines.push('-'.repeat(50));
    lines.push(`Match Score : ${Math.round(rec.match_score * 100)}%`);
    if (rec.salary_range?.min || rec.salary_range?.max) {
      lines.push(`Salary Range: ₹${(rec.salary_range.min / 100000).toFixed(1).replace('.0', '')}L – ₹${(rec.salary_range.max / 100000).toFixed(1).replace('.0', '')}L`);
    }
    if (rec.demand) lines.push(`Demand      : ${rec.demand.replace('_', ' ')}`);
    if (rec.why)   lines.push(`Why this fits: ${rec.why}`);
    lines.push('');
    lines.push('Required Skills:');
    rec.required_skills.forEach(s => lines.push(`  • ${s}`));
    lines.push('');
    lines.push('Next Steps:');
    rec.next_steps.forEach(s => lines.push(`  → ${s}`));
    lines.push('');
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'career-roadmap.txt';
  a.click();
  URL.revokeObjectURL(url);
}

const CareerRoadmap: React.FC = () => {
  const navigate = useNavigate();
  const {
    roadmap, extractedSkills, gapResult,
    isLoadingRoadmap, setRoadmap, setLoadingRoadmap, refreshSkills
  } = useAnalysisStore();
  const { isLoading: isGraphLoading } = useGraphStore();

  // Store raw recommendations alongside roadmap for export
  const [rawRecs, setRawRecs] = React.useState<CareerRecommendation[]>([]);

  const hasResume = extractedSkills.length > 0;

  // Sync skills on mount or when missing
  useEffect(() => {
    if (!hasResume && !isGraphLoading) {
      refreshSkills();
    }
  }, [hasResume, isGraphLoading, refreshSkills]);

  const loadRoadmap = async () => {
    if (!hasResume) return;
    setLoadingRoadmap(true);
    try {
      const recs = await fetchRecommendations(extractedSkills, gapResult);
      setRawRecs(recs);
      setRoadmap(recs.map(toRoadmapStep));
    } catch {
      setRawRecs([]);
      setRoadmap([]);
    } finally {
      setLoadingRoadmap(false);
    }
  };

  useEffect(() => {
    if (!hasResume) {
      setRoadmap([]);
      setRawRecs([]);
      return;
    }
    loadRoadmap();
  }, [hasResume, gapResult, extractedSkills, setRoadmap]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── No resume state ──────────────────────────────────────────────────────
  if (!hasResume && roadmap.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-12 flex flex-col items-center justify-center gap-5 text-center max-w-xl mx-auto"
      >
        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
          <Map className="w-8 h-8 text-purple-400" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white">No Roadmap Generated Yet</h3>
          <p className="text-white/40 text-sm max-w-xs">
            Upload your resume first, or click sync if you've already uploaded.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/')}
            className="btn-primary px-6 py-2.5 rounded-xl text-sm"
          >
            <UploadCloud className="w-4 h-4 inline mr-2" />
            Upload Resume
          </button>
          <button
            onClick={() => refreshSkills()}
            className="px-6 py-2.5 rounded-xl text-sm bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/70 transition-all flex items-center gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", isGraphLoading && "animate-spin")} />
            Sync Skills
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-12">
      {/* ── Header ── */}
      <div className="text-center space-y-3 max-w-xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-widest">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
          AI Generated
        </div>
        <h2 className="text-4xl font-black tracking-tight text-white" style={{ fontFamily: 'Outfit, Inter, sans-serif' }}>
          Your Path to <span className="gradient-text">Success</span>
        </h2>
        <p className="text-white/40">
          A step-by-step technical roadmap derived from your skill gaps and market demand.
        </p>
        {hasResume && (
          <button
            onClick={loadRoadmap}
            disabled={isLoadingRoadmap}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] text-white/50 hover:text-white/80 text-xs font-semibold transition-all mt-2 disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRoadmap ? 'animate-spin' : ''}`} />
            {isLoadingRoadmap ? 'Generating…' : 'Regenerate'}
          </button>
        )}
      </div>

      {/* ── Timeline ── */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative space-y-6 max-w-3xl mx-auto"
      >
        {/* Vertical connector */}
        <div className="absolute left-8 top-6 bottom-16 w-px step-line" />

        {isLoadingRoadmap ? (
          <>{[0, 1, 2].map(i => <SkeletonCard key={i} index={i} />)}</>
        ) : (
          roadmap.map((step, index) => {
            const rec = rawRecs[index];
            return (
              <motion.div key={step.title} variants={item} className="relative pl-20">
                {/* Node */}
                <div className="absolute left-5 top-5 w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 border-2 border-[#030712] shadow-[0_0_14px_rgba(59,130,246,0.55)] flex items-center justify-center z-10">
                  <span className="text-[9px] font-black text-white">{index + 1}</span>
                </div>

                {/* Card */}
                <div className="glass rounded-2xl p-6 space-y-5 card-hover border border-white/[0.06]">
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Step {String(index + 1).padStart(2, '0')}</span>
                      <h3 className="text-xl font-bold text-white leading-tight">{step.title}</h3>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {rec?.demand && (
                        <span className={cn('badge', DEMAND_COLORS[rec.demand] ?? 'badge-blue')}>
                          {rec.demand.replace('_', ' ')} demand
                        </span>
                      )}
                      {rec?.match_score !== undefined && (
                        <span className="badge badge-blue">{Math.round(rec.match_score * 100)}% match</span>
                      )}
                    </div>
                  </div>

                  <p className="text-white/50 text-sm leading-relaxed">{step.description}</p>

                  {/* Personalized why (AI explanation) */}
                  {rec?.why && (
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-purple-500/[0.05] border border-purple-500/[0.10]">
                      <Lightbulb className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-white/50 italic">{rec.why}</p>
                    </div>
                  )}

                  {/* Salary range */}
                  {rec?.salary_range && (rec.salary_range.min > 0 || rec.salary_range.max > 0) && (
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      <IndianRupee className="w-3.5 h-3.5 text-green-400" />
                      Salary: <span className="text-white/70 font-semibold">
                        ₹{(rec.salary_range.min / 100000).toFixed(1).replace('.0', '')}L – ₹{(rec.salary_range.max / 100000).toFixed(1).replace('.0', '')}L
                      </span>
                    </div>
                  )}

                  {/* Skill tags */}
                  <div className="flex flex-wrap gap-2">
                    {step.skills.map((skill) => (
                      <span key={skill} className="badge badge-white">{skill}</span>
                    ))}
                  </div>

                  {/* Resources */}
                  {step.resources.length > 0 && (
                    <div className="pt-4 border-t border-white/[0.05] space-y-3">
                      <h4 className="text-[11px] font-bold uppercase tracking-widest text-white/25 flex items-center gap-1.5">
                        <BookOpen className="w-3 h-3" /> Learning Path
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {step.resources.map((r) => (
                          <div
                            key={r.title}
                            className="group flex items-center justify-between p-3 rounded-xl bg-white/[0.025] hover:bg-white/[0.06] border border-white/[0.05] transition-colors"
                          >
                            <span className="text-xs font-semibold text-white/60 truncate group-hover:text-white/90 transition-colors">
                              → {r.title}
                            </span>
                            <TrendingUp className="w-3 h-3 text-white/20 group-hover:text-blue-400 transition-colors flex-shrink-0 ml-2" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}

        {/* Export CTA */}
        {!isLoadingRoadmap && roadmap.length > 0 && (
          <motion.div variants={item} className="flex justify-center pt-4 pl-20">
            <button
              onClick={() => exportRoadmapAsText(rawRecs)}
              className="btn-primary inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl text-sm shadow-xl"
            >
              <Download className="w-4 h-4" />
              Export Learning Roadmap
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default CareerRoadmap;
