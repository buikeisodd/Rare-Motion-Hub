import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Project from './pages/Project';
import SharedItem from './pages/SharedItem';
import ProjectInsights from './pages/ProjectInsights';

function WelcomeBack({ user, onDone }) {
  const seenKey = `seen-welcome-${user.id}`;

  const handleProceed = () => {
    localStorage.setItem(seenKey, 'true');
    onDone();
  };

  return (
    <div className="min-h-screen bg-primary-background px-6 py-12 flex flex-col">
      <div className="text-3xl font-bold tracking-tighter text-primary-label">[untitled]</div>
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-xl text-center animate-welcome-rise">
          <div className="mx-auto mb-10 h-44 w-44 rounded-[2rem] bg-shading border border-border overflow-hidden shadow-2xl animate-record-float">
            <div className="h-full w-full rounded-full border-[18px] border-[#2b2b2b] bg-[radial-gradient(circle_at_50%_50%,#161616_0_7%,transparent_8%),conic-gradient(from_35deg,#f7fbf1,#ff9bdf,#f5fff4,#f4a2dc,#f7fbf1)] animate-spin-slow" />
          </div>
          <p className="text-secondary-label text-sm font-medium uppercase tracking-[0.28em] mb-4">Welcome back</p>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-normal mb-8">
            {user.name}
          </h1>
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
      <div className="text-3xl font-bold tracking-tighter text-primary-label">[untitled]</div>
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center animate-welcome-rise">
          <div className="mx-auto mb-8 h-36 w-36 rounded-[1.75rem] bg-shading border border-border overflow-hidden shadow-2xl animate-record-float">
            <div className="h-full w-full rounded-full border-[15px] border-[#2b2b2b] bg-[radial-gradient(circle_at_50%_50%,#161616_0_7%,transparent_8%),conic-gradient(from_35deg,#f7fbf1,#ff9bdf,#f5fff4,#f4a2dc,#f7fbf1)] animate-spin-slow" />
          </div>
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
    return () => {
      cancelled = true;
    };
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
  };

  const handleUserUpdate = (nextUser) => {
    setUser(nextUser);
    localStorage.setItem('user', JSON.stringify(nextUser));
  };

  return (
    <div className="min-h-screen bg-primary-background text-primary-label font-sans selection:bg-highlight selection:text-white">
      <BrowserRouter>
        {!user ? (
          <Routes>
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/" element={<AuthLanding user={user} justAuthenticated={justAuthenticated} onDone={() => setJustAuthenticated(false)} />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/library" element={<Dashboard user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />} />
            <Route path="/project/:id" element={<Project user={user} onLogout={handleLogout} />} />
            <Route path="/project/:id/insights" element={<ProjectInsights user={user} />} />
            <Route path="/shared/:type/:id" element={<SharedItem user={user} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </BrowserRouter>
    </div>
  );
}

export default App;
