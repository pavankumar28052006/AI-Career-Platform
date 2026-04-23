/**
 * App.tsx — Root router and main layout shell.
 *
 * Provides a sticky navigation header with user greeting, animated nav-links,
 * and wraps all protected routes in the auth guard.
 */
import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
  NavLink,
  useLocation,
} from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AuthGuard from './components/AuthGuard';
import ResumeUpload from './components/ResumeUpload';
import SkillGraph from './components/SkillGraph';
import SkillGapAnalyzer from './components/SkillGapAnalyzer';
import CareerRoadmap from './components/CareerRoadmap';
import AuthPage from './components/AuthPage';
import { useAuthStore } from './store/authStore';

// ─── Logo ────────────────────────────────────────────────────────────────────
const Logo: React.FC = () => (
  <div className="flex items-center gap-2.5 group">
    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-shadow duration-300">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2L14 5.5V10.5L8 14L2 10.5V5.5L8 2Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
        <circle cx="8" cy="8" r="2" fill="white"/>
      </svg>
    </div>
    <span className="text-xl font-black tracking-tight" style={{ fontFamily: 'Outfit, Inter, sans-serif' }}>
      AI<span className="gradient-text">Career</span>
    </span>
  </div>
);

// ─── User Avatar ──────────────────────────────────────────────────────────────
const UserAvatar: React.FC<{ name?: string; email: string }> = ({ name, email }) => {
  const initial = (name ?? email).charAt(0).toUpperCase();
  return (
    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/40 to-purple-600/40 border border-white/10 flex items-center justify-center text-sm font-black text-white">
      {initial}
    </div>
  );
};

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV_LINKS = [
  { to: '/',          label: 'Upload',    end: true },
  { to: '/dashboard', label: 'Dashboard', end: false },
  { to: '/graph',     label: 'Graph',     end: false },
  { to: '/analysis',  label: 'Analysis',  end: false },
  { to: '/roadmap',   label: 'Roadmap',   end: false },
];

// ─── Main Layout ──────────────────────────────────────────────────────────────
const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { logout, user } = useAuthStore();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-mesh text-white">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/[0.05] bg-[#030712]/85 backdrop-blur-xl">
        <nav className="max-w-7xl mx-auto px-5 lg:px-10 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="hover:opacity-90 transition-opacity flex-shrink-0" aria-label="Home">
            <Logo />
          </Link>

          {/* Nav links */}
          <div className="flex items-center gap-0.5">
            {NAV_LINKS.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `nav-link px-3.5 py-2 rounded-lg transition-colors hover:bg-white/[0.04] ${isActive ? 'active' : ''}`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>

          {/* Right: user info + logout */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {user && (
              <div className="hidden sm:flex items-center gap-2.5">
                <UserAvatar name={user.full_name} email={user.email} />
                <div className="leading-tight">
                  <p className="text-xs font-bold text-white/80 leading-none">
                    {user.full_name ?? user.email.split('@')[0]}
                  </p>
                  <p className="text-[10px] text-white/30 mt-0.5">{user.email}</p>
                </div>
              </div>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-red-400/60 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-200"
              aria-label="Sign out"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </nav>
      </header>

      {/* Page content */}
      <main className="max-w-7xl mx-auto px-5 lg:px-10 py-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

// ─── Section header ───────────────────────────────────────────────────────────
const SectionHeader: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div className="mb-8">
    <h2 className="text-3xl font-black tracking-tight text-white" style={{ fontFamily: 'Outfit, Inter, sans-serif' }}>
      {title}
    </h2>
    <p className="mt-1 text-white/35 text-sm font-medium">{subtitle}</p>
  </div>
);

// ─── App ──────────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Auth */}
        <Route path="/login"    element={<AuthPage mode="login"    />} />
        <Route path="/register" element={<AuthPage mode="register" />} />

        {/* Upload / Home */}
        <Route path="/" element={
          <AuthGuard>
            <MainLayout>
              <ResumeUpload />
            </MainLayout>
          </AuthGuard>
        } />

        {/* Dashboard */}
        <Route path="/dashboard" element={
          <AuthGuard>
            <MainLayout>
              <div className="space-y-16 fade-up">
                <section>
                  <SectionHeader title="Skill Knowledge Graph" subtitle="Your extracted skills visualised as an interactive network" />
                  <SkillGraph />
                </section>
                <section>
                  <SectionHeader title="Role Gap Analysis" subtitle="See where you stand vs. your target role" />
                  <SkillGapAnalyzer />
                </section>
              </div>
            </MainLayout>
          </AuthGuard>
        } />

        {/* Graph */}
        <Route path="/graph" element={
          <AuthGuard>
            <MainLayout>
              <div className="space-y-6 fade-up">
                <SectionHeader title="Skill Knowledge Graph" subtitle="Click any node to explore skill relationships and confidence scores" />
                <SkillGraph />
              </div>
            </MainLayout>
          </AuthGuard>
        } />

        {/* Analysis */}
        <Route path="/analysis" element={
          <AuthGuard>
            <MainLayout>
              <div className="space-y-6 fade-up">
                <SectionHeader title="Role Gap Analysis" subtitle="Compare your current skills against target role requirements" />
                <SkillGapAnalyzer />
              </div>
            </MainLayout>
          </AuthGuard>
        } />

        {/* Roadmap */}
        <Route path="/roadmap" element={
          <AuthGuard>
            <MainLayout>
              <div className="fade-up">
                <CareerRoadmap />
              </div>
            </MainLayout>
          </AuthGuard>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
