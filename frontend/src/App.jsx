import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Login from './pages/Login';
import VerifyEmail from './pages/VerifyEmail';
import Dashboard from './pages/Dashboard';
import Project from './pages/Project';
import Folder from './pages/Folder';
import SharedItem from './pages/SharedItem';
import ProjectInsights from './pages/ProjectInsights';
import Feed from './pages/Feed';
import Saved from './pages/Saved';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Search from './pages/Search';
import { AudioProvider, useAudio } from './context/AudioContext';
import AudioPlayer from './components/AudioPlayer';
import MobileBottomNav from './components/MobileBottomNav';
import ChatInbox from './components/ChatInbox';

function DesktopOnly({ children }) {
  return children;
}

function WelcomeSignal({ compact = false }) {
  const size = compact ? 'h-24 w-32' : 'h-32 w-44';
  return (
    <div className={`relative mx-auto flex items-center justify-center gap-1.5 ${size}`} aria-hidden="true">
      <div className="absolute inset-x-1/2 top-1/2 h-px -translate-x-1/2 -translate-y-1/2 bg-accent/20" />
      {[18, 34, 58, 86, 48, 72, 38, 62, 28, 46, 76, 52, 30].map((height, index) => (
        <span key={index} className="relative z-10 w-1.5 rounded-full bg-accent shadow-[0_0_18px_rgba(255,138,61,0.35)] animate-wave" style={{ height: `${height}%`, animationDelay: `${index * 70}ms` }} />
      ))}
    </div>
  );
}

function WelcomeBack({ user, onDone }) {
  const seenKey = `seen-welcome-${user.id}`;

  const handleProceed = () => {
    localStorage.setItem(seenKey, 'true');
    onDone();
  };

  return (
    <div className="min-h-screen bg-[#080909] text-[#34483B] px-6 py-12 flex flex-col relative overflow-hidden">
      <div className="pointer-events-none absolute -left-32 top-[-12rem] h-[28rem] w-[28rem] rounded-full bg-[#FF8A3D]/[0.06] blur-3xl" />
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-xl text-center animate-welcome-rise">
          <WelcomeSignal />
          <p className="text-primary-label/70 text-xs font-semibold uppercase tracking-[0.28em] mb-4">Your studio is ready</p>
          <h1 className="text-5xl font-semibold tracking-tight mb-8">{user.name}</h1>
          <Link
            to="/library"
            onClick={handleProceed}
            className="inline-flex items-center justify-center rounded-full bg-primary-label px-8 py-4 text-primary-background font-semibold shadow-2xl hover:scale-[1.02] transition-transform"
          >
            Proceed to library
          </Link>
        </div>
      </main>
    </div>
  );
}

function WelcomeAnimation({ user, onDone }) {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onDone();
      navigate('/library', { replace: true });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [navigate, onDone]);

  return (
    <div className="min-h-screen bg-[#080909] text-[#34483B] px-6 py-12 flex flex-col relative overflow-hidden">
      <div className="pointer-events-none absolute -right-32 bottom-[-12rem] h-[28rem] w-[28rem] rounded-full bg-[#8DEBFF]/[0.05] blur-3xl" />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center animate-welcome-rise">
          <WelcomeSignal compact />
          <p className="text-primary-label/70 text-xs font-semibold uppercase tracking-[0.28em] mb-3">Picking up where you left off</p>
          <h1 className="text-4xl font-semibold tracking-tight">{user.name}</h1>
        </div>
      </main>
    </div>
  );
}

function AuthLanding({ user, justAuthenticated, onDone }) {
  const hasSeenWelcome = localStorage.getItem(`seen-welcome-${user.id}`) === 'true';
  if (!justAuthenticated) return <Navigate to="/library" replace />;
  return hasSeenWelcome ? <WelcomeAnimation user={user} onDone={onDone} /> : <WelcomeBack user={user} onDone={onDone} />;
}

function AnimatedRoutes({ user, authStatus, handleLogin, handleLogout, handleUserUpdate, justAuthenticated, setJustAuthenticated }) {
  const location = useLocation();

  // While session restore is in-flight, render nothing to avoid a flash
  // of the login page for users who do have a valid session.
  if (authStatus === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-primary-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary-label/20 border-t-primary-label animate-spin" />
      </div>
    );
  }

  // Session-expired: show login with a banner so the user understands why.
  if (authStatus === 'session-expired') {
    return (
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Login onLogin={handleLogin} sessionExpiredNotice />
            </motion.div>
          } />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AnimatePresence>
    );
  }

  // Locked (suspended/deactivated): allow login/verify routes but not app.
  if (authStatus === 'locked') {
    return (
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Login onLogin={handleLogin} /></motion.div>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AnimatePresence>
    );
  }

  if (authStatus === 'unauthenticated') {
    return (
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Login onLogin={handleLogin} /></motion.div>} />
          <Route path="/verify-email" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><VerifyEmail onLogin={handleLogin} /></motion.div>} />
          <Route path="/shared/:type/:id" element={<motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}><SharedItem user={null} /></motion.div>} />
          <Route path="/shared/link/:token" element={<motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}><SharedItem user={null} isLink={true} /></motion.div>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AnimatePresence>
    );
  }

  // authenticated-unverified: only verify-email route is accessible.
  if (authStatus === 'authenticated-unverified') {
    return (
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/verify-email" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><VerifyEmail onLogin={handleLogin} /></motion.div>} />
          <Route path="*" element={<Navigate to="/verify-email" replace />} />
        </Routes>
      </AnimatePresence>
    );
  }

  // authenticated-verified: full application access.
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><AuthLanding user={user} justAuthenticated={justAuthenticated} onDone={() => setJustAuthenticated(false)} /></motion.div>} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/verify-email" element={<Navigate to="/" replace />} />
        <Route path="/library" element={<motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}><Dashboard user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} /></motion.div>} />
        <Route path="/feed" element={<motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}><Feed user={user} /></motion.div>} />
        <Route path="/search" element={<motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}><Search user={user} /></motion.div>} />
        <Route path="/saved" element={<motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}><Saved /></motion.div>} />
        <Route path="/settings" element={<motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}><Settings user={user} onLogout={handleLogout} /></motion.div>} />
        <Route path="/profile/:id" element={<motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}><Profile user={user} onUserUpdate={handleUserUpdate} /></motion.div>} />
        <Route path="/folder/:id" element={<motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}><Folder user={user} onLogout={handleLogout} /></motion.div>} />
        <Route path="/project/:id" element={<motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}><Project user={user} onLogout={handleLogout} /></motion.div>} />
        <Route path="/project/:id/insights" element={<motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}><ProjectInsights user={user} /></motion.div>} />
        <Route path="/shared/:type/:id" element={<motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}><SharedItem user={user} /></motion.div>} />
        <Route path="/shared/link/:token" element={<motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}><SharedItem user={user} isLink={true} /></motion.div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function GlobalAudioPlayer() {
  const { currentTrack, tracks, projectName, isPlaying, setIsPlaying, setCurrentTrack } = useAudio();
  const location = useLocation();
  const isInsights = /\/project\/[^/]+\/insights/.test(location.pathname);
  const isFeed = location.pathname === '/feed';

  if (!currentTrack || isFeed) return null;

  const player = (
    <AudioPlayer
      tracks={tracks}
      currentTrack={currentTrack}
      projectName={projectName}
      isPlaying={isPlaying}
      cardModal={isInsights}
      onPlayPause={(playing) => {
        setIsPlaying(playing);
      }}
      onDismiss={() => {
        setIsPlaying(false);
        setCurrentTrack(null);
      }}
      onTrackChange={(track) => {
        setCurrentTrack(track);
        setIsPlaying(true);
      }}
    />
  );

  // On insights, wrap the card modal in a fixed bottom-right container
  if (isInsights) return (
    <div className="fixed bottom-6 right-6 z-50">
      {player}
    </div>
  );

  return player;
}

const IDLE_LIMIT_MS = 15 * 60 * 1000;
const IDLE_WARNING_MS = 60 * 1000;

function IdleLogoutGuard({ user, onLogout }) {
  const { isPlaying } = useAudio();
  const [warningOpen, setWarningOpen] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const warnedRef = useRef(false);

  useEffect(() => {
    if (!user) return undefined;

    const markActive = () => {
      lastActivityRef.current = Date.now();
      warnedRef.current = false;
      setWarningOpen(false);
    };
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'];
    events.forEach((event) => window.addEventListener(event, markActive, { passive: true }));
    return () => events.forEach((event) => window.removeEventListener(event, markActive));
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    if (isPlaying) {
      lastActivityRef.current = Date.now();
      warnedRef.current = false;
      setWarningOpen(false);
      return undefined;
    }

    const timer = window.setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor >= IDLE_LIMIT_MS) {
        onLogout();
        return;
      }
      if (idleFor >= IDLE_LIMIT_MS - IDLE_WARNING_MS && !warnedRef.current) {
        warnedRef.current = true;
        setWarningOpen(true);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isPlaying, onLogout, user]);

  if (!user || !warningOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-[#1c1c1e] p-5 text-center shadow-2xl animate-slide-up">
        <h2 className="text-lg font-semibold text-primary-label">Still there?</h2>
        <p className="mt-2 text-sm leading-relaxed text-secondary-label">
          You have been inactive for a while. Move, click, or press any key to stay signed in.
        </p>
        <button
          type="button"
          onClick={() => {
            lastActivityRef.current = Date.now();
            warnedRef.current = false;
            setWarningOpen(false);
          }}
          className="mt-5 h-11 w-full rounded-full bg-primary-label text-sm font-semibold text-primary-background transition-transform hover:scale-[1.01]"
        >
          Keep me signed in
        </button>
      </div>
    </div>
  );
}

function MobileRouteChrome({ user, onInbox }) {
  const location = useLocation();
  if (!user || location.pathname !== '/feed') return null;
  return <MobileBottomNav user={user} onInbox={onInbox} />;
}

function App() {
  // ── Auth state machine ────────────────────────────────────────────────────
  // Explicit states, derived from the live server response — never from
  // localStorage or frontend-only logic:
  //   loading              → startup, /api/auth/me not yet resolved
  //   unauthenticated      → no valid session (no cookies / cookies expired)
  //   authenticated-unverified → valid session, emailVerified = false
  //   authenticated-verified   → valid session, active account (normal flow)
  //   locked               → account locked or suspended
  //   session-expired      → was authenticated, server rejected the session
  //
  // Security note: these states gate routing and UI only. Actual access
  // control is enforced server-side — the frontend state is never trusted
  // as a security mechanism.
  const [authStatus, setAuthStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [justAuthenticated, setJustAuthenticated] = useState(false);
  const [mobileInboxOpen, setMobileInboxOpen] = useState(false);
  const authEpoch = useRef(0);
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  const deriveAuthStatus = (userData) => {
    if (!userData) return 'unauthenticated';
    const status = userData.accountStatus;
    if (status === 'suspended' || status === 'deactivated') return 'locked';
    if (userData.emailVerified === false || status === 'pending_verification') return 'authenticated-unverified';
    return 'authenticated-verified';
  };

  // On startup: call GET /api/auth/me to restore session from cookies.
  // This does NOT rotate the refresh token (unlike using POST /auth/refresh
  // directly). The fetch interceptor handles silent refresh+retry if the
  // access token cookie is already expired by the time this fires.
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const requestEpoch = authEpoch.current;
      try {
        const res = await fetch(`${apiUrl}/api/auth/me`, { credentials: 'include' });
        if (cancelled) return;
        // A slow startup request must not undo a login that completed while
        // it was in flight (common on mobile networks).
        if (requestEpoch !== authEpoch.current) return;
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
            setAuthStatus(deriveAuthStatus(data.user));
            return;
          }
        }
        setAuthStatus('unauthenticated');
      } catch {
        if (!cancelled && requestEpoch === authEpoch.current) setAuthStatus('unauthenticated');
      }
    }

    restoreSession();
    return () => { cancelled = true; };
  }, [apiUrl]);

  // Keep user profile fresh after login.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    async function refreshUser() {
      try {
        const res = await fetch(`${apiUrl}/api/auth/${user.id}`, { credentials: 'include' });
        const data = await res.json();
        if (!cancelled && res.ok && data.user) {
          setUser(data.user);
          setAuthStatus(deriveAuthStatus(data.user));
        }
      } catch {
        // Non-fatal — cached user state remains
      }
    }

    refreshUser();
    return () => { cancelled = true; };
  }, [apiUrl, user?.id]);

  // Listen for the forced-logout event dispatched by the fetch interceptor.
  useEffect(() => {
    const onAuthLogout = () => {
      setUser(null);
      setAuthStatus('session-expired');
      setJustAuthenticated(false);
    };
    window.addEventListener('auth:logout', onAuthLogout);
    return () => window.removeEventListener('auth:logout', onAuthLogout);
  }, []);

  const handleLogin = (userData) => {
    authEpoch.current += 1;
    setUser(userData);
    setAuthStatus(deriveAuthStatus(userData));
    setJustAuthenticated(true);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('accessToken');
  };

  const handleLogout = async () => {
    try {
      await fetch(`${apiUrl}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {}
    setUser(null);
    setAuthStatus('unauthenticated');
    setJustAuthenticated(false);
  };

  const handleUserUpdate = (nextUser) => {
    setUser(nextUser);
  };

  return (
    <div className="min-h-screen bg-primary-background text-primary-label font-sans">
      <AudioProvider key={user?.id || "guest"}>
        <BrowserRouter>
          <AnimatedRoutes 
            user={user}
            authStatus={authStatus}
            handleLogin={handleLogin} 
            handleLogout={handleLogout} 
            handleUserUpdate={handleUserUpdate}
            justAuthenticated={justAuthenticated}
            setJustAuthenticated={setJustAuthenticated}
          />
          <GlobalAudioPlayer />
          <IdleLogoutGuard user={user} onLogout={handleLogout} />
          <MobileRouteChrome user={user} onInbox={() => setMobileInboxOpen(true)} />
          {user && <ChatInbox user={user} isOpen={mobileInboxOpen} onToggle={() => setMobileInboxOpen((value) => !value)} />}
        </BrowserRouter>
      </AudioProvider>
    </div>
  );
}

export default App;
