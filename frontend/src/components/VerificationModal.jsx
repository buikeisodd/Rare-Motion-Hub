import { useEffect, useRef, useState } from 'react';
import { Mail, Loader2, RotateCw } from 'lucide-react';

const formatRemaining = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

/**
 * Shown after registration and on blocked-unverified login.
 *
 * Countdown is driven by `expiresAt` from the backend (computed from the
 * Redis token TTL). The backend is the authority on whether a token is valid
 * or expired — this timer is cosmetic only.
 *
 * While open, polls GET /api/auth/me every 4 seconds so that if the user
 * clicks the email link in another tab, verification is detected and the
 * seamless transition into the app fires without a manual page refresh.
 */
export default function VerificationModal({ email, expiresAt, verificationUrl, apiUrl, onVerified, onClose }) {
  const [expiry, setExpiry] = useState(expiresAt);
  const [devUrl, setDevUrl] = useState(verificationUrl);
  const [remainingMs, setRemainingMs] = useState(() =>
    expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0
  );
  const [resendState, setResendState] = useState('idle'); // idle | loading | sent | error
  const [resendError, setResendError] = useState('');
  const pollRef = useRef(null);

  // Sync expiry when a new token is issued (e.g. after resend).
  useEffect(() => {
    if (!expiresAt) return;
    setExpiry(expiresAt);
    setRemainingMs(new Date(expiresAt).getTime() - Date.now());
  }, [expiresAt]);

  // Countdown tick.
  useEffect(() => {
    if (!expiry) return;
    const tick = setInterval(() => {
      setRemainingMs(new Date(expiry).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(tick);
  }, [expiry]);

  useEffect(() => {
    if (verificationUrl) setDevUrl(verificationUrl);
  }, [verificationUrl]);

  // Background poll: detect if the user verified in another tab/window so we
  // can transition them into the app seamlessly without a manual page refresh.
  useEffect(() => {
    if (!onVerified) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${apiUrl}/api/auth/me`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.user?.emailVerified) {
            clearInterval(pollRef.current);
            onVerified(data.user);
          }
        }
      } catch { /* non-fatal — keep polling */ }
    }, 4000);
    return () => clearInterval(pollRef.current);
  }, [apiUrl, onVerified]);

  const expired = remainingMs <= 0;

  const handleResend = async () => {
    setResendState('loading');
    setResendError('');
    try {
      const res = await fetch(`${apiUrl}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not resend verification email.');
      if (data.expiresAt) setExpiry(data.expiresAt);
      if (data.verificationUrl) setDevUrl(data.verificationUrl);
      setResendState('sent');
    } catch (err) {
      setResendState('error');
      setResendError(err.message || 'Could not resend verification email.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 animate-fade-in">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-primary-background p-6 text-center shadow-xl">

        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-label/10">
          <Mail className="h-6 w-6 text-primary-label" />
        </div>

        <h2 className="text-lg font-semibold text-primary-label">Verify your email</h2>

        <p className="mt-3 text-sm text-secondary-label">
          We sent a verification link to:
        </p>
        <p className="mt-1 font-medium text-primary-label break-all">{email}</p>

        <div className="mt-5 rounded-2xl bg-shading px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-secondary-label">
            {expired ? 'Link expired' : 'Expires in'}
          </p>
          <p className={`mt-1 text-3xl font-semibold tabular-nums tracking-tight ${expired ? 'text-red-300' : 'text-primary-label'}`}>
            {expired ? '0:00' : formatRemaining(remainingMs)}
          </p>
        </div>

        {devUrl && (
          <p className="mt-3 break-all rounded-2xl bg-shading px-3 py-2 text-left text-xs text-secondary-label">
            Dev: <a href={devUrl} className="underline">{devUrl}</a>
          </p>
        )}

        {resendState === 'error' && (
          <p className="mt-3 text-sm text-red-300">{resendError}</p>
        )}
        {resendState === 'sent' && (
          <p className="mt-3 text-sm text-primary-label">Verification email resent.</p>
        )}

        <button
          type="button"
          onClick={handleResend}
          disabled={resendState === 'loading'}
          className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary-label text-sm font-semibold text-primary-background transition-all disabled:opacity-60"
        >
          {resendState === 'loading' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCw className="h-4 w-4" />
          )}
          Resend verification email
        </button>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full text-xs font-semibold text-secondary-label underline underline-offset-4 hover:text-primary-label"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
