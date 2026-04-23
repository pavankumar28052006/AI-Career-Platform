/**
 * ResumeUpload.tsx — Drag-and-drop PDF upload with async job polling.
 *
 * After job completes, fetches the skill graph and extracted skills
 * into their respective stores before navigating to the dashboard.
 */
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, CheckCircle, AlertCircle, Loader2, FileText, X, Sparkles, BarChart3, Map } from 'lucide-react';
import client from '../api/client';
import { cn } from '../lib/cn';
import { useGraphStore } from '../store/graphStore';
import { useAnalysisStore } from '../store/analysisStore';

// ─── Upload step indicators ─────────────────────────────────────────────────
const STEPS = [
  { icon: Upload,    label: 'Upload',  key: 'upload'  },
  { icon: Sparkles,  label: 'Extract', key: 'extract' },
  { icon: BarChart3, label: 'Analyse', key: 'analyse' },
  { icon: Map,       label: 'Roadmap', key: 'done'    },
];

type StepKey = 'idle' | 'upload' | 'extract' | 'analyse' | 'done';

const STEP_ORDER: StepKey[] = ['upload', 'extract', 'analyse', 'done'];

function getActiveStep(status: string | null, isUploading: boolean): StepKey {
  if (!isUploading) return 'idle';
  if (!status) return 'upload';
  if (status === 'processing') return 'extract';
  if (status === 'complete') return 'done';
  return 'analyse';
}

const ResumeUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const { fetchGraphData, setGraphData } = useGraphStore();
  const { setExtractedSkills, setGapResult, setRoadmap } = useAnalysisStore();

  const activeStep = getActiveStep(status, isUploading);

  const isResumeFile = (selected: File) => {
    const fileType = (selected.type || '').toLowerCase();
    const fileName = (selected.name || '').toLowerCase();
    const acceptedPdfTypes = new Set([
      'application/pdf', 'application/x-pdf',
      'application/acrobat', 'applications/vnd.pdf', 'text/pdf',
    ]);
    const acceptedTextTypes = new Set(['text/plain']);
    return acceptedPdfTypes.has(fileType) || acceptedTextTypes.has(fileType) || fileName.endsWith('.pdf') || fileName.endsWith('.txt');
  };

  const validateAndSetFile = (selected: File) => {
    setError(null);
    if (!isResumeFile(selected)) { setError('Only PDF or TXT files are accepted.'); return; }
    if (selected.size > 5 * 1024 * 1024) { setError('File exceeds 5 MB. Please compress and retry.'); return; }
    setFile(selected);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) validateAndSetFile(f);
  };

  const cleanupPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const onJobComplete = async (response: Record<string, unknown>) => {
    cleanupPolling();
    // Populate extracted skills from job result if present
    const result = response['result'] as Record<string, unknown> | undefined;
    const graphNodes = result?.['graph_nodes'] as string[] | undefined;
    const extractedSkills = result?.['skills'] as string[] | undefined;

    const resolvedSkills = extractedSkills ?? [];

    if (resolvedSkills.length > 0) {
      setExtractedSkills(resolvedSkills);
    } else {
      setExtractedSkills([]);
      setGraphData([], []);
      setGapResult(null);
      setRoadmap([]);
      setIsUploading(false);
      setStatus('failed');
      setError('No technical skills were found in this file. Please upload a valid resume.');
      return;
    }

    if (!graphNodes?.length) {
      await fetchGraphData(true);
    }
    setIsUploading(false);
    navigate('/dashboard');
  };

  const checkStatus = async (jobId: string) => {
    try {
      const response = await client.get(`/api/resume/status/${jobId}`) as Record<string, unknown>;
      const jobStatus = response['status'] as string;
      const progress_pct = response['progress_pct'] as number | undefined;
      const jobError = response['error'] as string | undefined;
      setUploadProgress(progress_pct ?? 0);
      setStatus(jobStatus);

      if (jobStatus === 'complete') {
        await onJobComplete(response);
      } else if (jobStatus === 'failed') {
        cleanupPolling();
        setError(jobError ?? 'Processing failed. Please try again.');
        setIsUploading(false);
      }
    } catch (err: unknown) {
      cleanupPolling();
      setError((err as { message?: string }).message ?? 'Error checking job status.');
      setIsUploading(false);
    }
  };

  const startPolling = (jobId: string) => {
    checkStatus(jobId);
    pollIntervalRef.current = window.setInterval(() => checkStatus(jobId), 2000);
  };

  useEffect(() => () => cleanupPolling(), []);

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    setUploadProgress(0);
    setStatus(null);
    setExtractedSkills([]);
    setGapResult(null);
    setRoadmap([]);
    setGraphData([], []);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await client.post('/api/resume/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }) as Record<string, unknown>;
      const jobId = response['job_id'] as string | undefined;
      if (jobId) {
        setUploadProgress(10);
        startPolling(jobId);
      } else {
        setError('Upload succeeded but no job ID was returned.');
        setIsUploading(false);
      }
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? 'Upload failed.');
      setIsUploading(false);
    }
  };

  const statusLabel =
    status === 'processing'
      ? 'Extracting skills from your file...'
      : status === 'complete'
      ? 'Analysis complete'
      : 'Uploading your file...';

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12">
      <div className="w-full max-w-2xl space-y-6">
        {/* ── Heading ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest mb-2">
            <span className="status-dot live" />
            AI-Powered Analysis
          </div>
          <h1 className="text-5xl font-black tracking-tight" style={{ fontFamily: 'Outfit, Inter, sans-serif' }}>
            Identify Your{' '}
            <span className="gradient-text">Potential</span>
          </h1>
          <p className="text-white/40 text-lg">
            Upload your resume to generate your interactive skill knowledge graph
          </p>
        </motion.div>

        {/* ── Drop Zone ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) validateAndSetFile(f);
          }}
          className={cn(
            'relative group cursor-pointer rounded-3xl p-12 transition-all duration-300 border-2 border-dashed flex flex-col items-center justify-center gap-5',
            isDragging   && 'border-blue-500 bg-blue-500/[0.06] scale-[1.01] shadow-lg shadow-blue-500/10',
            !isDragging && !file && 'border-white/[0.08] bg-white/[0.015] hover:border-white/20 hover:bg-white/[0.03]',
            file && !isDragging && 'border-green-500/30 bg-green-500/[0.03]',
          )}
        >
          <input
            type="file"
            aria-label="Resume upload"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={handleFileChange}
            accept=".pdf,.txt,text/plain"
            disabled={isUploading}
          />

          <AnimatePresence mode="wait">
            {file ? (
              <motion.div
                key="file"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-3 text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-green-500/15 border border-green-500/25 flex items-center justify-center shadow-lg shadow-green-500/10">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <div>
                  <p className="font-bold text-white text-lg flex items-center gap-2">
                    <FileText className="w-4 h-4 text-white/25 inline" />
                    {file.name}
                  </p>
                  <p className="text-sm text-white/30 mt-0.5">
                    {(file.size / 1024 / 1024).toFixed(2)} MB · {file.name.toLowerCase().endsWith('.txt') ? 'TXT' : 'PDF'}
                  </p>
                </div>
                {!isUploading && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="flex items-center gap-1.5 text-xs text-white/25 hover:text-white/60 transition-colors"
                  >
                    <X className="w-3 h-3" /> Remove file
                  </button>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-4 text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center group-hover:bg-blue-500/10 group-hover:border-blue-500/20 transition-all duration-300">
                  <Upload className="w-7 h-7 text-white/20 group-hover:text-blue-400 transition-colors duration-300" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-white/55 group-hover:text-white/80 transition-colors">
                    Drag & drop or <span className="text-blue-400">browse</span>
                  </p>
                  <p className="text-sm text-white/25 mt-1">PDF or TXT files — max 5 MB</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Error ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/[0.08] border border-red-500/20 text-red-400"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Progress ── */}
        <AnimatePresence>
          {isUploading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="glass rounded-2xl p-5 space-y-4"
            >
              <div className="flex justify-between items-center text-sm">
                <span className="text-white/60 font-medium flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  {statusLabel}
                </span>
                <span className="text-blue-400 font-bold tabular-nums">{uploadProgress}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                <motion.div
                  className="h-full progress-bar"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>

              {/* Step indicators */}
              <div className="flex items-center gap-2 pt-1">
                {STEPS.map((step, i) => {
                  const stepIdx = STEP_ORDER.indexOf(step.key as StepKey);
                  const activeIdx = STEP_ORDER.indexOf(activeStep);
                  const isDone = stepIdx < activeIdx;
                  const isActive = stepIdx === activeIdx;
                  return (
                    <React.Fragment key={step.key}>
                      <div className={cn(
                        'flex items-center gap-1.5 text-xs font-semibold transition-all duration-300',
                        isDone   && 'text-green-400',
                        isActive && 'text-blue-400',
                        !isDone && !isActive && 'text-white/20',
                      )}>
                        <step.icon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{step.label}</span>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className={cn('flex-1 h-px transition-all duration-500', isDone ? 'bg-green-500/40' : 'bg-white/[0.06]')} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CTA Button ── */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={handleUpload}
          disabled={!file || isUploading}
          whileHover={file && !isUploading ? { scale: 1.01 } : {}}
          whileTap={file && !isUploading ? { scale: 0.98 } : {}}
          className={cn(
            'w-full h-14 rounded-2xl font-bold text-base transition-all duration-300 flex items-center justify-center gap-2.5',
            file && !isUploading ? 'btn-primary' : 'bg-white/[0.04] text-white/20 cursor-not-allowed border border-white/[0.05]',
          )}
        >
          {isUploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Analysing Skill Set…
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Analyse My Resume
            </>
          )}
        </motion.button>

        {/* ── Feature cards ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-3 gap-4 pt-2"
        >
          {[
            { icon: '🔒', label: 'Secure Upload',       desc: 'Files never stored' },
            { icon: '⚡', label: 'AI in Seconds',        desc: 'Gemini-powered extraction' },
            { icon: '🗺️', label: 'Career Roadmap',       desc: 'Personalised steps' },
          ].map(({ icon, label, desc }) => (
            <div key={label} className="flex flex-col items-center gap-2 py-4 px-3 rounded-2xl bg-white/[0.018] border border-white/[0.05] text-center card-hover">
              <span className="text-2xl">{icon}</span>
              <span className="text-xs font-bold text-white/50">{label}</span>
              <span className="text-[10px] text-white/25">{desc}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default ResumeUpload;
