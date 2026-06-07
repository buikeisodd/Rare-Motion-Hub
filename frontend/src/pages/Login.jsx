import { useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import StarlightLogo from '../components/StarlightLogo';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        onLogin(data.user);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('Could not connect to the server. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary-background px-20 py-12 relative overflow-hidden">
      {/* Logo — blends with dark bg, black in light mode */}
      <StarlightLogo className="h-24 w-80 text-primary-label opacity-90" />

      <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-3xl flex-col items-center justify-center animate-fade-in">
        <StarlightLogo className="mb-14 h-36 w-[28rem] text-primary-label" />

        <h1 className="max-w-xl text-center text-5xl font-semibold leading-tight tracking-normal mb-9">
          A sacred place for your work-in-progress music
        </h1>

        <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-5">
          <label className="relative block">
            <Mail className="absolute left-8 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary-label" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="h-20 w-full rounded-full bg-shading border border-border pl-16 pr-8 text-center text-lg font-semibold text-primary-label placeholder:text-secondary-label focus:outline-none focus:ring-2 focus:ring-primary-label/20 transition-all"
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
            className="flex h-20 w-full items-center justify-center rounded-full bg-primary-label text-lg font-semibold text-primary-background transition-transform hover:scale-[1.01] disabled:opacity-70"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue with email'}
          </button>
        </form>

        <p className="mt-12 max-w-md text-center text-sm text-secondary-label">
          By continuing you confirm that this email belongs to an approved Starlight Station collaborator.
        </p>
      </div>
    </div>
  );
}
