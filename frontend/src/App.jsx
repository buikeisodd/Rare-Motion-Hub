import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Project from './pages/Project';
import Folder from './pages/Folder';
import SharedItem from './pages/SharedItem';
import ProjectInsights from './pages/ProjectInsights';
import StarlightLogo from './components/StarlightLogo';
import { AudioProvider, useAudio } from './context/AudioContext';
import AudioPlayer from './components/AudioPlayer';

function DesktopOnly({ children }) {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (isDesktop) return children;

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-8 text-center">
      <StarlightLogo className="h-16 w-56 text-white opacity-80 mb-12" />
      <div className="mb-8 text-6xl">🖥️</div>
      <h1 className="text-2xl font-semibold text-white mb-3">Desktop only</h1>
      <p className="text-[#888] text-base max-w-xs leading-relaxed">
        Starlight Station is built for desktop. Please open this on a laptop or desktop computer to continue.
      </p>
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
    <div className="min-h-screen bg-primary-background px-6 py-12 flex flex-col">
      <StarlightLogo className="h-14 w-48 text-primary-label opacity-90" />
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-xl text-center animate-welcome-rise">
          <StarlightLogo className="mx-auto mb-10 h-32 w-80 text-primary-label opacity-90 animate-record-float" />
          <p className="text-secondary-label text-sm font-medium uppercase tracking-[0.28em] mb-4">Welcome back</p>
          <h1 className="text-5xl font-semibold tracking-normal mb-8">{user.name}</h1>
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
    <div className="min-h-screen bg-primary-background px-6 py-12 flex flex-col">
      <StarlightLogo className="h-14 w-48 text-primary-label opacity-90" />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center animate-welcome-rise">
          <StarlightLogo className="mx-auto mb-8 h-28 w-72 text-primary-label opacity-90 animate-record-float" />
          <p className="text-secondary-label text-sm font-medium uppercase tracking-[0.28em] mb-3">Welcome back</p>
          <h1 className="text-4xl font-semibold tracking-normal">{user.name}</h1>
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

function AnimatedRoutes({ user, handleLogin, handleLogout, handleUserUpdate, justAuthenticated, setJustAuthenticated }) {
  const location = useLocation();

  if (!user) {
    return (
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Login onLogin={handleLogin} /></motion.div>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<DesktopOnly><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><AuthLanding user={user} justAuthenticated={justAuthenticated} onDone={() => setJustAuthenticated(false)} /></motion.div></DesktopOnly>} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/library" element={<DesktopOnly><motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}><Dashboard user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} /></motion.div></DesktopOnly>} />
        <Route path="/folder/:id" element={<DesktopOnly><motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}><Folder user={user} onLogout={handleLogout} /></motion.div></DesktopOnly>} />
        <Route path="/project/:id" element={<DesktopOnly><motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}><Project user={user} onLogout={handleLogout} /></motion.div></DesktopOnly>} />
        <Route path="/project/:id/insights" element={<DesktopOnly><motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}><ProjectInsights user={user} /></motion.div></DesktopOnly>} />
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

  if (!currentTrack) return null;

  const player = (
    <AudioPlayer
      tracks={tracks}
      currentTrack={currentTrack}
      projectName={projectName}
      isPlaying={isPlaying}
      cardModal={isInsights}
      onPlayPause={(playing) => {
        setIsPlaying(playing);
        if (!playing) setCurrentTrack(null);
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

function App() {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [justAuthenticated, setJustAuthenticated] = useState(false);
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    async function refreshUser() {
      try {
        const res = await fetch(`${apiUrl}/api/users/${user.id}`);
        const data = await res.json();
        if (!cancelled && res.ok && data.user) {
          setUser(data.user);
          localStorage.setItem('user', JSON.stringify(data.user));
        }
      } catch (err) {
        console.error('Failed to refresh user profile', err);
      }
    }

    refreshUser();
    return () => { cancelled = true; };
  }, [apiUrl, user?.id]);

  const handleLogin = (userData) => {
    setUser(userData);
    setJustAuthenticated(true);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    setJustAuthenticated(false);
    localStorage.removeItem('user');
    // Audio cleanup is handled by AudioContext unmounting
  };

  const handleUserUpdate = (nextUser) => {
    setUser(nextUser);
    localStorage.setItem('user', JSON.stringify(nextUser));
  };

  return (
    <div className="min-h-screen bg-primary-background text-primary-label font-sans">
      <AudioProvider key={user?.id || "guest"}>
        <BrowserRouter>
          <AnimatedRoutes 
            user={user} 
            handleLogin={handleLogin} 
            handleLogout={handleLogout} 
            handleUserUpdate={handleUserUpdate}
            justAuthenticated={justAuthenticated}
            setJustAuthenticated={setJustAuthenticated}
          />
          <GlobalAudioPlayer />
        </BrowserRouter>
      </AudioProvider>
    </div>
  );
}

export default App;
