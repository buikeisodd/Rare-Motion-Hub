import { useEffect, useState } from 'react';
import { Mail, Loader2, RotateCw, CheckCircle2 } from 'lucide-react';

const formatRemaining = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

/**
 * Shown after registration and on blocked-unverified login.
 *
 * Countdown is driven by `expiresAt` from the backend.
 * Uses the tokenless verification path (verifyEmailDirect).
 */
export default function VerificationModal({ email, expiresAt, apiUrl, onVerified, onClose }) {
  const [expiry, setExpiry] = useState(expiresAt);
  const [remainingMs, setRemainingMs] = useState(() =>
    expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0
  );
  
  // idle | loading_verify | loading_resend | success | error
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Sync expiry when a new token is issued
  useEffect(() => {
    if (!expiresAt) return;
    setExpiry(expiresAt);
    setRemainingMs(new Date(expiresAt).getTime() - Date.now());
  }, [expiresAt]);

  // Countdown tick
  useEffect(() => {
    if (!expiry) return;
    const tick = setInterval(() => {
      setRemainingMs(new Date(expiry).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(tick);
  }, [expiry]);

  const expired = remainingMs <= 0;

  const handleVerifyDirect = async () => {
    setStatus('loading_verify');
    setErrorMsg('');
    try {
      const res = await fetch(`${apiUrl}/api/auth/verify-email-direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not verify email.');
      setStatus('success');
      if (onVerified) onVerified(data.user);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Could not verify email.');
    }
  };

  const handleResend = async () => {
    setStatus('loading_resend');
    setErrorMsg('');
    try {
      const res = await fetch(`${apiUrl}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not request a new window.');
      if (data.expiresAt) setExpiry(data.expiresAt);
      setStatus('idle'); // Back to unexpired state
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Could not request a new window.');
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
          Your email is pending verification:
        </p>
        <p className="mt-1 font-medium text-primary-label break-all">{email}</p>

        <div className="mt-5 rounded-2xl bg-shading px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-secondary-label">
            {expired ? 'Verification window expired' : 'Verification window closes in'}
          </p>
          <p className={`mt-1 text-3xl font-semibold tabular-nums tracking-tight ${expired ? 'text-red-300' : 'text-primary-label'}`}>
            {expired ? '0:00' : formatRemaining(remainingMs)}
          </p>
        </div>

        {status === 'error' && (
          <p className="mt-3 text-sm text-red-300">{errorMsg}</p>
        )}
        {status === 'success' && (
          <p className="mt-3 text-sm text-primary-label">Successfully verified.</p>
        )}

        {expired ? (
          <button
            type="button"
            onClick={handleResend}
            disabled={status === 'loading_resend'}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary-label text-sm font-semibold text-primary-background transition-all disabled:opacity-60"
          >
            {status === 'loading_resend' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCw className="h-4 w-4" />
            )}
            Request new verification window
          </button>
        ) : (
          <button
            type="button"
            onClick={handleVerifyDirect}
            disabled={status === 'loading_verify' || status === 'success'}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary-label text-sm font-semibold text-primary-background transition-all disabled:opacity-60"
          >
            {status === 'loading_verify' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Verify here
          </button>
        )}

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
