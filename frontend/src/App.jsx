import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Project from './pages/Project';

function WelcomeBack({ user }) {
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
            className="inline-flex items-center justify-center rounded-full bg-primary-label px-8 py-4 text-primary-background font-semibold shadow-2xl hover:scale-[1.02] transition-transform"
          >
            Proceed to library
          </Link>
        </div>
      </main>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
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
            <Route path="/" element={<WelcomeBack user={user} />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/library" element={<Dashboard user={user} onLogout={handleLogout} />} />
            <Route path="/project/:id" element={<Project user={user} onLogout={handleLogout} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </BrowserRouter>
    </div>
  );
}

export default App;
