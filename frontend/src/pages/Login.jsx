import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Loader2, Mail, Lock, Phone, Timer } from 'lucide-react';
import StarlightLogo from '../components/StarlightLogo';
import VerificationModal from '../components/VerificationModal';

function GoogleIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.29h6.47a5.53 5.53 0 0 1-2.4 3.63v3.02h3.89c2.28-2.1 3.53-5.2 3.53-8.67Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.89-3.02c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.27v3.12A11.99 11.99 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.28 14.27A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.55.38-2.27V6.61H1.27A11.99 11.99 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4.01-3.12Z" />
      <path fill="#EA4335" d="M12 4.78c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.2 15.23 0 12 0A11.99 11.99 0 0 0 1.27 6.61l4.01 3.12C6.23 6.89 8.88 4.78 12 4.78Z" />
    </svg>
  );
}

function AppleIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M16.53 1.92c0 1.04-.39 2.01-1.15 2.83-.82.88-1.8 1.39-2.86 1.31-.13-1 .37-2.06 1.1-2.87.78-.86 2.11-1.52 2.91-1.27Zm3.5 16.38c-.57 1.31-.84 1.9-1.58 3.05-1.03 1.58-2.48 3.55-4.28 3.57-1.6.02-2.02-1.04-4.19-1.03-2.17.01-2.63 1.06-4.23 1.04-1.8-.02-3.18-1.79-4.21-3.37-2.88-4.42-3.18-9.61-1.4-12.37 1.26-1.96 3.25-3.1 5.12-3.1 1.9 0 3.1 1.04 4.68 1.04 1.53 0 2.47-1.04 4.68-1.04 1.67 0 3.44.91 4.7 2.48-4.13 2.26-3.46 8.15.71 9.73Z" />
    </svg>
  );
}

export default function Login({ onLogin, sessionExpiredNotice = false }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState(() => localStorage.getItem('lastEmail') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get('resetToken') || '');
  const [resetMode, setResetMode] = useState(() => Boolean(new URLSearchParams(window.location.search).get('resetToken')));
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(sessionExpiredNotice ? 'Your session has expired. Please sign in again.' : '');
  const [loading, setLoading] = useState(false);
  const [providerLoading, setProviderLoading] = useState('');
  const [verificationModal, setVerificationModal] = useState(null);
  const [lockedUntil, setLockedUntil] = useState(null); // ISO timestamp from server
  const [lockCountdown, setLockCountdown] = useState(0); // seconds remaining
  const lockTimerRef = useRef(null);
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  // Drive the lockout countdown from the server-provided lockedUntil timestamp.
  // The timer is purely cosmetic â€” backend is authoritative on whether the
  // lock has actually expired.
  useEffect(() => {
    if (!lockedUntil) { setLockCountdown(0); return; }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000));
      setLockCountdown(remaining);
      if (remaining === 0) setLockedUntil(null);
    };
    tick();
    lockTimerRef.current = setInterval(tick, 1000);
    return () => clearInterval(lockTimerRef.current);
  }, [lockedUntil]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (isRegister && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);

    try {
      if (resetMode) {
        const res = await fetch(`${apiUrl}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token: resetToken, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not reset password.');
        // Password reset does not auto-login â€” fresh authentication is required.
        // Clear the reset token from the URL, switch to normal login mode,
        // and show a success notice so the user knows to sign in again.
        setResetMode(false);
        setResetToken('');
        setPassword('');
        window.history.replaceState({}, '', '/login');
        setNotice(data.message || 'Password updated. Please sign in with your new password.');
        return;
      }

      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const res = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('lastEmail', email);
        if (data.requiresVerification) {
          setVerificationModal({ email: data.email || email, expiresAt: data.expiresAt, verificationUrl: data.verificationUrl });
        } else {
          onLogin(data.user);
        }
      } else if (data.requiresEmailVerification) {
        setVerificationModal({ email, expiresAt: null, verificationUrl: null });
      } else {
        if (data.lockedUntil) setLockedUntil(data.lockedUntil);
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError(err.message || (resetMode ? 'Could not reset password. Check the link and try again.' : 'Could not connect to the server. Make sure the backend is running.'));
    } finally {
      setLoading(false);
    }
  };

  const requestPasswordReset = async () => {
    setError('');
    setNotice('');
    if (!email.trim()) {
      setError('Enter your email address first.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not request password reset.');
      setNotice(data.resetUrl ? `${data.message} Dev link: ${data.resetUrl}` : data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderAuth = async (provider) => {
    setError('');
    setNotice('');
    setProviderLoading(provider);
    try {
      const res = await fetch(`${apiUrl}/api/auth/provider-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provider.toLowerCase() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `${provider} sign-in is not configured yet.`);
      if (data.url) window.location.href = data.url;
      else setNotice(data.message || `${provider} sign-in will be available after OAuth credentials are configured.`);
    } catch (err) {
      setError(err.message || `${provider} sign-in is not configured yet.`);
    } finally {
      setProviderLoading('');
    }
  };

  const handlePhoneAuth = async () => {
    setError('');
    setNotice('');
    setProviderLoading('Phone');
    try {
      const res = await fetch(`${apiUrl}/api/auth/phone-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    });
    const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Phone sign-in is not configured yet.');
      setNotice(data.message || 'Phone sign-in is not configured yet.');
    } catch (err) {
      setError(err.message || 'Phone sign-in is not configured yet.');
    } finally {
      setProviderLoading('');
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#e8eee9] px-5 py-8 text-[#17221c] sm:px-8 lg:px-16 lg:py-12">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(115deg,transparent_0%,rgba(83,112,92,.16)_46%,transparent_47%),linear-gradient(68deg,transparent_0%,rgba(40,78,51,.12)_62%,transparent_63%)]" />
      <div className="pointer-events-none absolute -left-24 top-[-12rem] h-[30rem] w-[30rem] rounded-full bg-[#70977a]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 right-[-8rem] h-[32rem] w-[32rem] rounded-full bg-[#345b43]/15 blur-3xl" />
      <div className="relative mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-6xl items-center gap-10 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,27rem)] lg:gap-16">
        <section className="hidden lg:block animate-fade-in">
          <StarlightLogo className="mb-20 h-10 text-[#17221c]" showTagline={false} markClassName="h-16 w-16 sm:h-20 sm:w-20" />
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.3em] text-[#46624d]">A softer place for unfinished ideas</p>
          <h1 className="max-w-xl text-6xl font-semibold leading-[0.96] tracking-tight text-[#17221c]">Make room for the next sound.</h1>
          <p className="mt-7 max-w-md text-base leading-relaxed text-[#52655a]">Keep your projects close, hear every version, and share the work when it feels ready.</p>
        </section>

        <div className="mx-auto w-full max-w-sm animate-fade-in">
          <div className="mb-8 lg:hidden"><StarlightLogo className="h-10 text-[#17221c]" showTagline={false} markClassName="h-16 w-16 sm:h-20 sm:w-20" /></div>
          <div className="mb-8 lg:hidden"><h1 className="text-3xl font-semibold tracking-tight">Make room for the next sound.</h1><p className="mt-3 text-sm leading-relaxed text-[#52655a]">Your private studio for projects, playback and collaboration.</p></div>
          <div className="rounded-[2rem] border border-white/70 bg-white/75 p-5 shadow-[0_28px_80px_rgba(35,62,43,.18)] backdrop-blur-xl sm:p-7">
          <p className="mb-4 max-w-sm text-center text-[11px] leading-tight text-[#52655a]">By continuing you confirm that this email belongs to an approved Starlight Station collaborator.</p>

        <div className="flex items-center gap-5 mb-5 border-b border-[rgba(52,72,59,.16)] pb-2 px-3">
          <button 
            type="button"
            onClick={() => { setIsRegister(false); setResetMode(false); setResetToken(''); }}
            className={`text-base font-semibold transition-all relative py-1 ${!isRegister && !resetMode ? 'text-[#17221c]' : 'text-[#718078] hover:text-[#17221c]'}`}>
            Sign in
            {!isRegister && !resetMode && <span className="absolute bottom-[-13px] left-0 right-0 h-[2px] bg-[#6F8974] rounded-full" />}
          </button>
          <button 
            type="button"
            onClick={() => { setIsRegister(true); setResetMode(false); setResetToken(''); }}
            className={`text-base font-semibold transition-all relative py-1 ${isRegister && !resetMode ? 'text-[#17221c]' : 'text-[#718078] hover:text-[#17221c]'}`}>
            Create account
            {isRegister && !resetMode && <span className="absolute bottom-[-13px] left-0 right-0 h-[2px] bg-[#6F8974] rounded-full" />}
          </button>
        </div>

        <div className="w-full">
          <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-[#cbd8ce] bg-white/55 p-4 shadow-sm sm:p-5">
            <label className="relative block">
              <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#46624d]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="h-11 w-full rounded-xl bg-white/80 border border-[#bdcdbf] pl-11 pr-4 text-left text-sm font-medium text-[#17221c] placeholder:text-[#718078] focus:outline-none focus:border-[#6F8974] focus:ring-1 focus:ring-[#6F8974] transition-all"
                required={!resetMode}
                disabled={resetMode}
              />
            </label>
            <label className="relative block">
              <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#46624d]" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={resetMode ? 'New password' : 'Password'}
                minLength={8}
                className="h-11 w-full rounded-xl bg-white/80 border border-[#bdcdbf] pl-11 pr-12 text-left text-sm font-medium text-[#17221c] placeholder:text-[#718078] focus:outline-none focus:border-[#6F8974] focus:ring-1 focus:ring-[#6F8974] transition-all"
                required
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#667268] transition-colors hover:text-[#34483B]" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </label>
            {!isRegister && !resetMode && (
              <div className="flex justify-end px-1">
                <button
                  type="button"
                  onClick={requestPasswordReset}
                  className="text-xs font-medium text-[#667268] transition-colors hover:text-[#6F8974]"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {isRegister && !resetMode && <label className="relative block">
              <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#667268]" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="h-12 w-full rounded-xl bg-[#E5DFD2] border border-[rgba(52,72,59,.16)] pl-11 pr-12 text-left text-sm font-medium text-[#34483B] placeholder:text-[#7D897F] focus:outline-none focus:border-[#6F8974] focus:ring-1 focus:ring-[#6F8974] transition-all"
                required
              />
              <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#667268] transition-colors hover:text-[#34483B]" aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}>
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </label>}

            {error && (
              <div className="rounded-xl border border-[#FF5C6C]/20 bg-[#FF5C6C]/10 px-4 py-3 text-left text-xs font-medium text-[#FF5C6C]">
                {error}
              </div>
            )}

            {lockCountdown > 0 && (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs text-amber-300">
                <Timer className="h-4 w-4 shrink-0" />
                <span>
                  Account locked â€” try again in{' '}
                  <span className="tabular-nums font-semibold">
                    {Math.floor(lockCountdown / 60)}:{String(lockCountdown % 60).padStart(2, '0')}
                  </span>
                </span>
              </div>
            )}

            {notice && (
              <div className="rounded-xl border border-[#6F8974]/20 bg-[#6F8974]/10 px-4 py-3 text-left text-xs font-medium text-[#6F8974]">
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || lockCountdown > 0}
              className="mx-auto flex h-11 w-[92%] items-center justify-center rounded-xl bg-[#6F8974] text-sm font-bold text-[#F3EBDD] transition-all hover:bg-[#9BAF9B] active:scale-[0.99] disabled:opacity-50 shadow-md mt-1"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin text-[#F3EBDD]" /> : (resetMode ? 'Reset password' : isRegister ? 'Create account' : 'Sign in')}
            </button>
          </form>

          <div className="my-2 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#52655a] md:flex-col md:justify-center">
            <div className="h-px flex-1 bg-border md:h-full md:w-px" />
            <span>OR</span>
            <div className="h-px flex-1 bg-border md:h-full md:w-px" />
          </div>

            <div className="grid content-center gap-2 rounded-2xl border border-[#cbd8ce] bg-white/45 p-2.5 sm:p-3">
            <button
              type="button"
              onClick={() => handleProviderAuth('Google')}
              disabled={Boolean(providerLoading)}
              className="mx-auto flex min-h-10 w-[92%] items-center justify-center gap-3 rounded-xl border border-[#bdcdbf] bg-white/65 px-4 py-2.5 text-sm font-semibold text-[#17221c] transition-all hover:border-[#6F8974] hover:bg-[#fff] hover:scale-[1.01]"
            >
              {providerLoading === 'Google' ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon className="h-5 w-5" />}
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => handleProviderAuth('Apple')}
              disabled={Boolean(providerLoading)}
              className="mx-auto flex min-h-10 w-[92%] items-center justify-center gap-3 rounded-xl border border-[#bdcdbf] bg-white/65 px-4 py-2.5 text-sm font-semibold text-[#17221c] transition-all hover:border-[#6F8974] hover:bg-[#fff] hover:scale-[1.01]"
            >
              {providerLoading === 'Apple' ? <Loader2 className="h-5 w-5 animate-spin" /> : <AppleIcon className="h-5 w-5" />}
              Continue with Apple
            </button>
            <button
              type="button"
              onClick={handlePhoneAuth}
              disabled={Boolean(providerLoading)}
              className="mx-auto flex min-h-10 w-[92%] items-center justify-center gap-3 rounded-xl border border-[#bdcdbf] bg-white/65 px-4 py-2.5 text-sm font-semibold text-[#17221c] transition-all hover:border-[#6F8974] hover:bg-[#fff] hover:scale-[1.01]"
            >
              {providerLoading === 'Phone' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Phone className="h-5 w-5" />}
              Continue with phone number
            </button>
            {resetMode && (
              <button type="button" onClick={() => { setResetMode(false); setResetToken(''); window.history.replaceState(null, '', '/login'); }} className="block w-full text-center text-xs font-semibold text-secondary-label underline-offset-4 transition-colors hover:text-primary-label hover:underline">
                Back to login
              </button>
            )}
          </div>
          </div>
        </div>

        </div>

      </div>

      {verificationModal && (
        <VerificationModal
          email={verificationModal.email}
          expiresAt={verificationModal.expiresAt || new Date(Date.now() + 300000).toISOString()}
          verificationUrl={verificationModal.verificationUrl}
          apiUrl={apiUrl}
          onVerified={(userData) => {
            setVerificationModal(null);
            onLogin(userData);
          }}
          onClose={() => setVerificationModal(null)}
        />
      )}
    </div>
  );
}


