import { useState } from 'react';
import { Globe2, Loader2, Mail, Lock, Smartphone } from 'lucide-react';
import StarlightLogo from '../components/StarlightLogo';

export default function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState(() => localStorage.getItem('lastEmail') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('lastEmail', email);
        onLogin(data.user, data.token);
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch {
      setError('Could not connect to the server. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleProviderAuth = (provider) => {
    setError(provider + ' sign-in is not connected yet. Use email and password for now.');
  };

  return (
    <div className="min-h-screen bg-primary-background px-5 py-8 sm:px-8 lg:px-20 lg:py-12 relative overflow-hidden">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col items-center justify-center animate-fade-in">
        <StarlightLogo className="logo-glow mb-7 h-24 w-full max-w-sm text-primary-label sm:h-28 sm:max-w-md" />
        
        <h1 className="max-w-md text-center text-2xl font-semibold leading-tight tracking-normal mb-7 sm:text-3xl">
          A sacred place for your work-in-progress music
        </h1>

        <div className="flex space-x-4 mb-6">
          <button 
            onClick={() => setIsRegister(false)}
            className={`text-lg font-semibold transition-colors ${!isRegister ? 'text-primary-label' : 'text-secondary-label'}`}>
            Login
          </button>
          <button 
            onClick={() => setIsRegister(true)}
            className={`text-lg font-semibold transition-colors ${isRegister ? 'text-primary-label' : 'text-secondary-label'}`}>
            Register
          </button>
        </div>

        <div className="grid w-full max-w-4xl gap-4 md:grid-cols-2 md:items-stretch">
          <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-border bg-shading/20 p-3 sm:p-4">
          <label className="relative block">
            <Mail className="absolute left-8 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary-label" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="h-12 w-full rounded-full bg-shading border border-border pl-14 pr-8 text-center text-base font-semibold text-primary-label placeholder:text-secondary-label focus:outline-none focus:ring-2 focus:ring-primary-label/20 transition-all"
              required
            />
          </label>
          <label className="relative block">
            <Lock className="absolute left-8 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary-label" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="h-12 w-full rounded-full bg-shading border border-border pl-14 pr-8 text-center text-base font-semibold text-primary-label placeholder:text-secondary-label focus:outline-none focus:ring-2 focus:ring-primary-label/20 transition-all"
              required
            />
          </label>

          {error && (
            <div className="text-red-300 text-sm text-center bg-red-400/10 py-3 rounded-full border border-red-300/10">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center rounded-full bg-primary-label text-base font-semibold text-primary-background transition-transform hover:scale-[1.01] disabled:opacity-70"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isRegister ? 'Create Account' : 'Login')}
          </button>
        </form>

          <div className="grid gap-3 rounded-2xl border border-border bg-shading/20 p-3 sm:p-4">
            <button type="button" onClick={() => handleProviderAuth('Google')} className="flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-shading text-sm font-semibold text-primary-label transition-all hover:border-primary-label/30 hover:bg-highlight">
              <Globe2 className="h-4 w-4" />
              Continue with Google
            </button>
            <button type="button" onClick={() => handleProviderAuth('Phone')} className="flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-shading text-sm font-semibold text-primary-label transition-all hover:border-primary-label/30 hover:bg-highlight">
              <Smartphone className="h-4 w-4" />
              Continue with phone
            </button>
          </div>
        </div>

        <p className="mt-12 max-w-md text-center text-sm text-secondary-label">
          By continuing you confirm that this email belongs to an approved Starlight Station collaborator.
        </p>
      </div>
    </div>
  );
}
