import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, MailWarning } from 'lucide-react';
import StarlightLogo from '../components/StarlightLogo';

export default function VerifyEmail({ onLogin }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading', message: 'Verifying your email...' });
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setState({ status: 'error', message: 'Verification token is missing.' });
      return;
    }

    let cancelled = false;
    async function verify() {
      try {
        const res = await fetch(`${apiUrl}/api/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not verify email.');
        if (cancelled) return;
        onLogin(data.user);
        setState({ status: 'success', message: 'Email verified. Opening your library...' });
        window.setTimeout(() => navigate('/library', { replace: true }), 700);
      } catch (error) {
        if (!cancelled) setState({ status: 'error', message: error.message });
      }
    }
    verify();
    return () => { cancelled = true; };
  }, [apiUrl, navigate, onLogin, params]);

  const success = state.status === 'success';
  const loading = state.status === 'loading';

  return (
    <div className="min-h-screen bg-[#050505] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1a0d06] via-[#050505] to-[#050505] text-[#F7F4EC] px-5 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col items-center justify-center text-center">
        <StarlightLogo className="logo-glow mb-8 h-24 w-full max-w-xs text-primary-label" />
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-shading text-primary-label">
          {loading ? <Loader2 className="h-7 w-7 animate-spin" /> : success ? <CheckCircle2 className="h-7 w-7" /> : <MailWarning className="h-7 w-7" />}
        </div>
        <h1 className="text-2xl font-semibold">{success ? 'Verified' : loading ? 'Checking link' : 'Link problem'}</h1>
        <p className="mt-3 text-sm leading-relaxed text-secondary-label">{state.message}</p>
        {!loading && !success && (
          <Link to="/login" className="mt-7 inline-flex h-11 items-center justify-center rounded-full bg-primary-label px-6 text-sm font-semibold text-primary-background">
            Back to login
          </Link>
        )}
      </div>
    </div>
  );
}
