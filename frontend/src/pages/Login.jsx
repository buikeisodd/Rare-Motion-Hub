import { useState } from 'react';
import { Loader2 } from 'lucide-react';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:3001/api/auth', {
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
    } catch (err) {
      setError('Could not connect to the server. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-primary-background">
      {/* Subtle background glow effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white opacity-[0.02] rounded-full blur-[120px] pointer-events-none"></div>

      <div className="z-10 w-full max-w-md p-8 animate-fade-in">
        <div className="flex justify-center mb-12">
          {/* Faux logo representation */}
          <div className="text-3xl font-bold tracking-tighter text-primary-label">
            [untitled]
          </div>
        </div>

        <div className="glass rounded-3xl p-8 shadow-2xl">
          <h2 className="text-xl font-medium mb-2 text-center">Welcome back</h2>
          <p className="text-sm text-secondary-label text-center mb-8">
            Enter your email to access your sacred place for work-in-progress music.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full bg-shading border border-border rounded-xl px-4 py-3 text-primary-label placeholder:text-secondary-label focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                required
              />
            </div>
            
            {error && (
              <div className="text-red-400 text-sm text-center bg-red-400/10 py-2 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-label text-primary-background font-medium rounded-xl px-4 py-3 hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-70"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
