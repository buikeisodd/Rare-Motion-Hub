import { useState } from 'react';
import { Eye, EyeOff, Loader2, Mail, Lock, Phone } from 'lucide-react';
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

export default function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState(() => localStorage.getItem('lastEmail') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get('resetToken') || '');
  const [resetMode, setResetMode] = useState(() => Boolean(new URLSearchParams(window.location.search).get('resetToken')));
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [providerLoading, setProviderLoading] = useState('');
  const [verificationModal, setVerificationModal] = useState(null); // { email, expiresAt, verificationUrl } | null
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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
        onLogin(data.user);
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
        // Login blocked because the account isn't verified yet — reuse the
        // same modal. No expiresAt yet since we didn't just issue a token;
        // the user can tap "resend" to get a fresh one from the backend.
        setVerificationModal({ email, expiresAt: null, verificationUrl: null });
      } else {
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
    <div className="min-h-screen bg-primary-background px-5 py-8 sm:px-8 lg:px-20 lg:py-12 relative overflow-hidden">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col items-center justify-center animate-fade-in">
        <StarlightLogo className="logo-glow mb-7 h-24 w-full max-w-sm text-primary-label sm:h-28 sm:max-w-md" />
        
        <h1 className="max-w-md text-center text-2xl font-semibold leading-tight tracking-normal mb-7 sm:text-3xl">
          A sacred place for your work-in-progress music
        </h1>

        <div className="flex space-x-4 mb-6">
          <button 
            onClick={() => { setIsRegister(false); setResetMode(false); setResetToken(''); }}
            className={`text-lg font-semibold transition-colors ${!isRegister && !resetMode ? 'text-primary-label' : 'text-secondary-label'}`}>
            Login
          </button>
          <button 
            onClick={() => { setIsRegister(true); setResetMode(false); setResetToken(''); }}
            className={`text-lg font-semibold transition-colors ${isRegister && !resetMode ? 'text-primary-label' : 'text-secondary-label'}`}>
            Register
          </button>
        </div>

        <div className="grid w-full max-w-4xl gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,0.9fr)] md:items-stretch">
          <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-border bg-shading/20 p-3 sm:p-4">
            <label className="relative block">
              <Mail className="absolute left-6 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary-label" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="h-12 w-full rounded-full bg-shading border border-border pl-12 pr-6 text-center text-base font-semibold text-primary-label placeholder:text-secondary-label focus:outline-none focus:ring-2 focus:ring-primary-label/20 transition-all"
                required={!resetMode}
                disabled={resetMode}
              />
            </label>
            <label className="relative block">
              <Lock className="absolute left-6 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary-label" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={resetMode ? 'New password' : 'Password'}
                minLength={8}
                className="h-12 w-full rounded-full bg-shading border border-border pl-12 pr-14 text-center text-base font-semibold text-primary-label placeholder:text-secondary-label focus:outline-none focus:ring-2 focus:ring-primary-label/20 transition-all"
                required
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-5 top-1/2 -translate-y-1/2 text-secondary-label transition-colors hover:text-primary-label" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </label>
            {!isRegister && !resetMode && (
              <div className="flex justify-end px-2">
                <button
                  type="button"
                  onClick={requestPasswordReset}
                  className="text-xs font-semibold text-secondary-label underline-offset-4 transition-colors hover:text-primary-label hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {isRegister && !resetMode && <label className="relative block">
              <Lock className="absolute left-6 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary-label" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="h-12 w-full rounded-full bg-shading border border-border pl-12 pr-14 text-center text-base font-semibold text-primary-label placeholder:text-secondary-label focus:outline-none focus:ring-2 focus:ring-primary-label/20 transition-all"
                required
              />
              <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} className="absolute right-5 top-1/2 -translate-y-1/2 text-secondary-label transition-colors hover:text-primary-label" aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}>
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </label>}

            {error && (
              <div className="rounded-2xl border border-red-300/10 bg-red-400/10 px-4 py-3 text-center text-sm text-red-300">
                {error}
              </div>
            )}
            {notice && (
              <div className="rounded-2xl border border-primary-label/10 bg-primary-label/10 px-4 py-3 text-center text-sm text-primary-label">
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center rounded-full bg-primary-label text-base font-semibold text-primary-background transition-transform hover:scale-[1.01] disabled:opacity-70"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (resetMode ? 'Reset password' : isRegister ? 'Create Account' : 'Login')}
            </button>
          </form>

          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-secondary-label md:flex-col md:justify-center">
            <div className="h-px flex-1 bg-border md:h-full md:w-px" />
            <span>OR</span>
            <div className="h-px flex-1 bg-border md:h-full md:w-px" />
          </div>

          <div className="grid content-center gap-3 rounded-2xl border border-border bg-shading/20 p-3 sm:p-4">
            <button
              type="button"
              onClick={() => handleProviderAuth('Google')}
              disabled={Boolean(providerLoading)}
              className="flex min-h-12 w-full items-center justify-center gap-3 rounded-full border border-border bg-shading px-4 py-3 text-sm font-semibold text-primary-label transition-all hover:border-primary-label/30 hover:bg-highlight hover:scale-[1.01]"
            >
              {providerLoading === 'Google' ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon className="h-5 w-5" />}
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => handleProviderAuth('Apple')}
              disabled={Boolean(providerLoading)}
              className="flex min-h-12 w-full items-center justify-center gap-3 rounded-full border border-border bg-shading px-4 py-3 text-sm font-semibold text-primary-label transition-all hover:border-primary-label/30 hover:bg-highlight hover:scale-[1.01]"
            >
              {providerLoading === 'Apple' ? <Loader2 className="h-5 w-5 animate-spin" /> : <AppleIcon className="h-5 w-5" />}
              Continue with Apple
            </button>
            <button
              type="button"
              onClick={handlePhoneAuth}
              disabled={Boolean(providerLoading)}
              className="flex min-h-12 w-full items-center justify-center gap-3 rounded-full border border-border bg-shading px-4 py-3 text-sm font-semibold text-primary-label transition-all hover:border-primary-label/30 hover:bg-highlight hover:scale-[1.01]"
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

        <p className="mt-12 max-w-md text-center text-sm text-secondary-label">
          By continuing you confirm that this email belongs to an approved Starlight Station collaborator.
        </p>
      </div>

      {verificationModal && (
        <VerificationModal
          email={verificationModal.email}
          expiresAt={verificationModal.expiresAt || new Date().toISOString()}
          verificationUrl={verificationModal.verificationUrl}
          apiUrl={apiUrl}
          onClose={() => setVerificationModal(null)}
        />
      )}
    </div>
  );
}
