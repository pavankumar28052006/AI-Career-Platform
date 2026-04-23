/**
 * SkillGapAnalyzer.tsx — Role selector + free-text input with live gap scoring wired to the backend.
 *
 * Calls POST /api/analysis/gap when the user picks or types a target role,
 * then displays match score, matched skills, missing skills, salary data,
 * demand signal, and AI-generated learning resources.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAnalysisStore } from '../store/analysisStore';
import { useGraphStore } from '../store/graphStore';
import { fetchGapAnalysis } from '../api/analysisApi';
import {
  Target, ChevronDown, TrendingUp, AlertTriangle, CheckCircle2,
  RefreshCw, UploadCloud, BookOpen, ExternalLink, DollarSign, Zap,
  Clock, ChevronRight,
} from 'lucide-react';
import { cn } from '../lib/cn';
import { useNavigate } from 'react-router-dom';

const PRESET_ROLES = [
  'Full Stack Engineer',
  'Data Analyst',
  'Data Scientist',
  'ML Engineer',
  'Backend Engineer',
  'Data Engineer',
  'AI Research Scientist',
  'DevOps Engineer',
  'Product Manager',
  'Cloud Architect',
];

const DEMAND_COLORS: Record<string, string> = {
  very_high: 'badge-green',
  high:      'badge-blue',
  medium:    'badge-amber',
  low:       'badge-red',
};

const DEMAND_LABELS: Record<string, string> = {
  very_high: '🔥 Very High Demand',
  high:      '📈 High Demand',
  medium:    '📊 Medium Demand',
  low:       '📉 Low Demand',
};

// ─── Skeleton row ─────────────────────────────────────────────────────────────
const SkeletonRow = () => (
  <tr>
    <td className="px-5 py-4"><div className="skeleton h-4 w-32 rounded-md" /></td>
    <td className="px-5 py-4"><div className="skeleton h-2 w-28 rounded-md mx-auto" /></td>
    <td className="px-5 py-4 flex justify-end"><div className="skeleton h-5 w-16 rounded-full ml-auto" /></td>
  </tr>
);

const SkillGapAnalyzer: React.FC = () => {
  const navigate = useNavigate();
  const { gapResult, extractedSkills, isLoadingGap, setGapResult, setLoadingGap, refreshSkills } = useAnalysisStore();
  const { isLoading: isGraphLoading } = useGraphStore();
  const [selectedRole, setSelectedRole] = useState(PRESET_ROLES[0]);
  const [customRole, setCustomRole] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [showResources, setShowResources] = useState(false);
  const hasResume = extractedSkills.length > 0;

  const activeRole = useCustom ? customRole.trim() : selectedRole;

  // Sync skills on mount or when missing
  useEffect(() => {
    if (!hasResume && !isGraphLoading) {
      refreshSkills();
    }
  }, [hasResume, isGraphLoading, refreshSkills]);

  const runAnalysis = useCallback(async (role: string) => {
    if (!hasResume || !role) return;
    setLoadingGap(true);
    try {
      const result = await fetchGapAnalysis(extractedSkills, role);
      setGapResult(result);
    } catch {
      setGapResult(null);
    } finally {
      setLoadingGap(false);
    }
  }, [extractedSkills, hasResume, setGapResult, setLoadingGap]);

  // Run on mount and on role change (preset only)
  useEffect(() => {
    if (hasResume && !useCustom) {
      runAnalysis(selectedRole);
    }
  }, [selectedRole, runAnalysis, hasResume, useCustom]);

  // Derived values
  const matchPct = gapResult ? Math.round((1 - gapResult.gap_score) * 100) : null;
  const circumference = 2 * Math.PI * 52;
  const dashOffset = matchPct !== null ? circumference - (circumference * matchPct) / 100 : circumference;

  const scoreColor =
    matchPct === null ? 'text-white/40'
    : matchPct >= 80 ? 'text-green-400'
    : matchPct >= 60 ? 'text-blue-400'
    : 'text-amber-400';

  // ── No resume uploaded yet ─────────────────────────────────────────────────
  if (!hasResume && !gapResult) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-12 flex flex-col items-center justify-center gap-5 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <UploadCloud className="w-8 h-8 text-blue-400" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white">No Resume Analysed Yet</h3>
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
            <RefreshCw className={cn('w-4 h-4', isGraphLoading && 'animate-spin')} />
            Sync Skills
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Role selector row ── */}
      <div className="glass rounded-2xl p-5 space-y-4">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-blue-400" /> Target Role
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Preset dropdown */}
          <div className="relative flex-1">
            <select
              value={selectedRole}
              onChange={(e) => { setSelectedRole(e.target.value); setUseCustom(false); }}
              disabled={isLoadingGap || useCustom}
              className="w-full h-11 pl-4 pr-10 rounded-xl bg-white/[0.04] border border-white/[0.08] appearance-none cursor-pointer font-semibold text-sm text-white disabled:opacity-50"
            >
              {PRESET_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-2 text-white/20 text-xs font-bold">
            <div className="h-px flex-1 bg-white/10 sm:hidden" />
            OR
            <div className="h-px flex-1 bg-white/10 sm:hidden" />
          </div>

          {/* Custom role input */}
          <div className="relative flex-1 flex gap-2">
            <input
              type="text"
              placeholder="Type any role…"
              value={customRole}
              onChange={(e) => { setCustomRole(e.target.value); setUseCustom(!!e.target.value); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && customRole.trim()) runAnalysis(customRole.trim()); }}
              className="flex-1 h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-white/20 font-medium"
            />
            {customRole && (
              <button
                onClick={() => runAnalysis(customRole.trim())}
                disabled={isLoadingGap || !customRole.trim()}
                className="h-11 px-4 rounded-xl btn-primary text-sm font-bold flex items-center gap-1.5 disabled:opacity-40 flex-shrink-0"
              >
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Analyse</span>
              </button>
            )}
          </div>

          {/* Re-analyse */}
          <button
            onClick={() => runAnalysis(activeRole)}
            disabled={isLoadingGap || !hasResume || !activeRole}
            className="h-11 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] font-semibold text-xs text-white/60 hover:text-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-40 flex-shrink-0"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isLoadingGap && 'animate-spin')} />
            {isLoadingGap ? 'Analysing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── Main results grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Radial score + stats ── */}
        <div className="lg:col-span-1 space-y-4">
          {/* Radial score */}
          <div className="glass rounded-2xl p-6 flex flex-col items-center gap-5">
            <div className="relative w-44 h-44">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                <motion.circle
                  cx="60" cy="60" r="52"
                  fill="none"
                  stroke="url(#scoreGrad)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: dashOffset }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                />
                <defs>
                  <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {isLoadingGap ? (
                  <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-400 rounded-full animate-spin" />
                ) : (
                  <>
                    <motion.span
                      className={cn('text-4xl font-black', scoreColor)}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                    >
                      {matchPct !== null ? `${matchPct}%` : '--'}
                    </motion.span>
                    <span className="text-[10px] uppercase tracking-widest text-white/30 font-bold mt-0.5">Match</span>
                  </>
                )}
              </div>
            </div>

            {matchPct !== null && !isLoadingGap && (
              <div className={cn(
                'badge',
                matchPct >= 80 ? 'badge-green'
                : matchPct >= 60 ? 'badge-blue'
                : 'badge-amber',
              )}>
                <TrendingUp className="w-3 h-3" />
                {matchPct >= 80 ? 'Excellent Match' : matchPct >= 60 ? 'Strong Potential' : 'Room to Grow'}
              </div>
            )}

            {gapResult && !isLoadingGap && (
              <p className="text-xs text-white/30 text-center leading-relaxed">
                You match <span className="text-white/60 font-bold">{matchPct}%</span> of skills required for{' '}
                <span className="text-white/60 font-bold">{gapResult.target_role}</span>.
              </p>
            )}
          </div>

          {/* Stats cards */}
          {gapResult && !isLoadingGap && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              {/* Salary */}
              {gapResult.salary_range && (gapResult.salary_range.min > 0 || gapResult.salary_range.max > 0) && (
                <div className="glass rounded-xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Salary Range</p>
                    <p className="text-sm font-bold text-white">
                      ₹{(gapResult.salary_range.min / 100000).toFixed(1).replace('.0', '')}L – ₹{(gapResult.salary_range.max / 100000).toFixed(1).replace('.0', '')}L
                    </p>
                  </div>
                </div>
              )}

              {/* Demand */}
              {gapResult.demand && (
                <div className="glass rounded-xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Market Demand</p>
                    <span className={cn('badge text-xs', DEMAND_COLORS[gapResult.demand] ?? 'badge-blue')}>
                      {DEMAND_LABELS[gapResult.demand] ?? gapResult.demand}
                    </span>
                  </div>
                </div>
              )}

              {/* Timeline */}
              {gapResult.estimated_weeks > 0 && (
                <div className="glass rounded-xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Gap Closure Time</p>
                    <p className="text-sm font-bold text-white">{gapResult.estimated_weeks} weeks focused study</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* ── Right: Matched + Missing skills ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Role summary */}
          {gapResult?.role_summary && !isLoadingGap && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-4 flex items-start gap-3"
            >
              <ChevronRight className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-white/60 leading-relaxed">{gapResult.role_summary}</p>
            </motion.div>
          )}

          {/* Matched skills */}
          {(gapResult?.matching_skills?.length ?? 0) > 0 && !isLoadingGap && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-5 space-y-3"
            >
              <h3 className="font-bold flex items-center gap-2 text-sm text-white">
                <CheckCircle2 className="text-green-400 w-4 h-4" />
                Skills You Have
                <span className="badge badge-green ml-auto">{gapResult!.matching_skills.length} matched</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {gapResult!.matching_skills.map((skill) => (
                  <span key={skill} className="badge badge-green">{skill}</span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Missing skills table */}
          <div className="glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2 text-white text-sm">
                <AlertTriangle className="text-amber-400 w-4 h-4" />
                Skill Gaps Identified
              </h3>
              {isLoadingGap ? (
                <div className="skeleton h-5 w-20 rounded-full" />
              ) : (
                <span className="badge badge-amber">{gapResult?.missing_skills.length ?? 0} missing</span>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-white/[0.06]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-white/30">Skill</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-white/30 text-center">Priority</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-white/30 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {isLoadingGap ? (
                    <>{[0,1,2,3].map(i => <SkeletonRow key={i} />)}</>
                  ) : gapResult?.missing_skills && gapResult.missing_skills.length > 0 ? (
                    gapResult.missing_skills.map((skill, i) => {
                      const importance = Math.max(0.4, 1 - i * 0.12);
                      return (
                        <motion.tr
                          key={skill}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.06 }}
                          className="hover:bg-white/[0.025] transition-colors"
                        >
                          <td className="px-5 py-3.5 font-semibold text-white/90 text-sm">{skill}</td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <motion.div
                                  className={cn(
                                    'h-full rounded-full',
                                    importance > 0.75 ? 'bg-red-500'
                                    : importance > 0.55 ? 'bg-amber-500'
                                    : 'bg-blue-500',
                                  )}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${importance * 100}%` }}
                                  transition={{ duration: 0.8, delay: i * 0.06 }}
                                />
                              </div>
                              <span className="text-xs font-bold text-white/30 tabular-nums w-8">
                                {Math.round(importance * 100)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <span className={cn('badge', importance > 0.75 ? 'badge-red' : 'badge-amber')}>
                              Missing
                            </span>
                          </td>
                        </motion.tr>
                      );
                    })
                  ) : !isLoadingGap && (
                    <tr>
                      <td colSpan={3} className="px-5 py-8 text-center text-white/30 text-sm">
                        {gapResult ? '🎉 You have all required skills!' : 'Run analysis to see results'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Top recommendation */}
            {gapResult?.missing_skills?.[0] && !isLoadingGap && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/[0.06] border border-blue-500/[0.12] text-blue-400 text-sm"
              >
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  Acquiring{' '}
                  <span className="font-bold text-white">{gapResult.missing_skills[0]}</span>{' '}
                  would be your highest-impact next step for{' '}
                  <span className="text-white/70">{gapResult.target_role}</span>.
                </span>
              </motion.div>
            )}
          </div>

          {/* Learning Resources */}
          {gapResult?.learning_resources && gapResult.learning_resources.length > 0 && !isLoadingGap && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-5 space-y-3"
            >
              <button
                onClick={() => setShowResources(r => !r)}
                className="w-full flex items-center justify-between"
              >
                <h3 className="font-bold flex items-center gap-2 text-white text-sm">
                  <BookOpen className="text-purple-400 w-4 h-4" />
                  AI-Recommended Learning Resources
                  <span className="badge badge-purple">{gapResult.learning_resources.length}</span>
                </h3>
                <ChevronDown className={cn('w-4 h-4 text-white/30 transition-transform', showResources && 'rotate-180')} />
              </button>
              <AnimatePresence>
                {showResources && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                      {gapResult.learning_resources.map((res) => (
                        <a
                          key={res.skill}
                          href={res.url && res.url !== '#' ? res.url : undefined}
                          target={res.url && res.url !== '#' ? '_blank' : undefined}
                          rel="noreferrer"
                          className="group flex items-start gap-3 p-3 rounded-xl bg-white/[0.025] hover:bg-white/[0.06] border border-white/[0.05] transition-colors cursor-pointer"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-blue-400 truncate">{res.skill}</p>
                            <p className="text-xs text-white/50 truncate group-hover:text-white/80 transition-colors">{res.resource}</p>
                          </div>
                          <ExternalLink className="w-3 h-3 text-white/20 group-hover:text-blue-400 transition-colors flex-shrink-0 mt-0.5" />
                        </a>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SkillGapAnalyzer;
