/**
 * AuthPage.tsx — Split hero + glassmorphism form with animated background.
 * Connects to POST /api/auth/register and POST /api/auth/login.
 */
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Shield, TrendingUp, Map, Eye, EyeOff } from 'lucide-react';
import client from '../api/client';
import { useAuthStore } from '../store/authStore';

type Mode = 'login' | 'register';

const FEATURES = [
  { icon: Sparkles,   color: 'text-blue-400',   bg: 'bg-blue-500/10',   label: 'AI Skill Extraction',   desc: 'Parse any resume in seconds' },
  { icon: TrendingUp, color: 'text-purple-400',  bg: 'bg-purple-500/10', label: 'Gap Analysis',           desc: 'Know exactly what to learn' },
  { icon: Map,        color: 'text-emerald-400', bg: 'bg-emerald-500/10',label: 'Career Roadmap',         desc: 'Step-by-step growth plan' },
  { icon: Shield,     color: 'text-amber-400',   bg: 'bg-amber-500/10',  label: 'Secure & Private',       desc: 'Your data stays yours' },
];

const AuthPage: React.FC<{ mode: Mode }> = ({ mode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const loginToStore = useAuthStore((s) => s.login);

  const [fullName, setFullName]     = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const isRegister = mode === 'register';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isRegister) {
        await client.post('/api/auth/register', { full_name: fullName, email, password });
      }
      const loginResponse = await client.post('/api/auth/login', { email, password }) as {
        access_token: string;
        user: { id: string; email: string; full_name?: string };
      };
      loginToStore(
        { id: loginResponse.user.id, email: loginResponse.user.email, full_name: loginResponse.user.full_name },
        loginResponse.access_token,
      );
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (err) {
      setError((err as { message?: string }).message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-mesh flex">
      {/* ── Animated background orbs ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="orb w-[500px] h-[500px] bg-blue-600/[0.08] -top-40 -left-40" style={{ animationDelay: '0s' }} />
        <div className="orb w-[400px] h-[400px] bg-purple-600/[0.08] -bottom-32 -right-32" style={{ animationDelay: '3s' }} />
        <div className="orb w-[300px] h-[300px] bg-indigo-600/[0.06] top-1/2 left-1/3" style={{ animationDelay: '5s' }} />
      </div>

      {/* ── Left hero panel (hidden on mobile) ── */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] xl:w-[55%] p-12 xl:p-16 relative overflow-hidden border-r border-white/[0.04]">
        {/* Logo */}
        <div className="flex items-center gap-3 z-10">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-xl shadow-blue-500/30">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
              <path d="M8 2L14 5.5V10.5L8 14L2 10.5V5.5L8 2Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <circle cx="8" cy="8" r="2" fill="white"/>
            </svg>
          </div>
          <span className="text-xl font-black tracking-tight text-white">
            AI<span className="gradient-text">Career</span>
          </span>
        </div>

        {/* Hero copy */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="z-10 space-y-8"
        >
          <div className="space-y-4">
            <div className="badge badge-blue w-fit">
              <span className="status-dot live" />
              AI-Powered Platform
            </div>
            <h1 className="text-5xl xl:text-6xl font-black tracking-tight leading-[1.05]" style={{ fontFamily: 'Outfit, Inter, sans-serif' }}>
              Accelerate Your<br />
              <span className="gradient-text">Tech Career</span>
            </h1>
            <p className="text-white/50 text-lg leading-relaxed max-w-md">
              Upload your resume. Get an interactive skill graph, gap analysis,
              and a personalised learning roadmap — in under 30 seconds.
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, color, bg, label, desc }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.08, duration: 0.5 }}
                className="glass rounded-2xl p-4 space-y-2 card-hover"
              >
                <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <p className="text-sm font-bold text-white">{label}</p>
                <p className="text-xs text-white/40">{desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Bottom tagline */}
        <p className="text-xs text-white/20 font-medium z-10">
          © 2025 AICareer Platform · Built with FastAPI + React
        </p>
      </div>

      {/* ── Right: Auth form ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L14 5.5V10.5L8 14L2 10.5V5.5L8 2Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
                <circle cx="8" cy="8" r="2" fill="white"/>
              </svg>
            </div>
            <span className="text-xl font-black tracking-tight text-white">AI<span className="gradient-text">Career</span></span>
          </div>

          <form onSubmit={submit} className="glass rounded-3xl p-8 space-y-5 shadow-2xl border border-white/[0.08]">
            {/* Header */}
            <div className="space-y-1 mb-2">
              <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'Outfit, Inter, sans-serif' }}>
                {isRegister ? 'Create your account' : 'Welcome back'}
              </h1>
              <p className="text-white/40 text-sm">
                {isRegister
                  ? 'Start your AI-powered career journey today'
                  : 'Sign in to continue to your dashboard'}
              </p>
            </div>

            {isRegister && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Full Name</label>
                <input
                  className="w-full h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 text-white placeholder-white/20 text-sm transition-all"
                  placeholder="Jane Smith"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Email</label>
              <input
                className="w-full h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 text-white placeholder-white/20 text-sm transition-all"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Password</label>
              <div className="relative">
                <input
                  className="w-full h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 pr-11 text-white placeholder-white/20 text-sm transition-all"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                  </svg>
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full h-12 rounded-xl text-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Please wait…
                </span>
              ) : isRegister ? 'Create Account' : 'Sign In'}
            </button>

            <hr className="divider" />

            <p className="text-center text-sm text-white/40">
              {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
              <Link
                className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                to={isRegister ? '/login' : '/register'}
              >
                {isRegister ? 'Sign in' : 'Sign up free'}
              </Link>
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default AuthPage;
