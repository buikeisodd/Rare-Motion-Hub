import { useEffect, useState } from 'react';
import { Mail, Loader2, RotateCw } from 'lucide-react';

const formatRemaining = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

/**
 * Shown after registration (and on a blocked unverified login) to tell the
 * user to check their email. The countdown is purely a UX affordance —
 * `expiresAt` comes from the backend (which derives it from the Redis-stored
 * token TTL). The backend is what actually rejects an expired token on
 * verification; this modal never decides validity itself.
 */
export default function VerificationModal({ email, expiresAt, verificationUrl, apiUrl, onClose }) {
  const [expiry, setExpiry] = useState(expiresAt);
  const [devUrl, setDevUrl] = useState(verificationUrl);
  const [remainingMs, setRemainingMs] = useState(() => new Date(expiresAt).getTime() - Date.now());
  const [resendState, setResendState] = useState('idle'); // idle | loading | sent | error
  const [resendError, setResendError] = useState('');

  useEffect(() => {
    setExpiry(expiresAt);
    setRemainingMs(new Date(expiresAt).getTime() - Date.now());
  }, [expiresAt]);

  useEffect(() => {
    const tick = setInterval(() => {
      setRemainingMs(new Date(expiry).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(tick);
  }, [expiry]);

  useEffect(() => {
    if (verificationUrl) setDevUrl(verificationUrl);
  }, [verificationUrl]);

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
      // expiresAt is authoritative and comes fresh from the backend on every
      // resend — the frontend never invents or extends its own expiry.
      if (data.expiresAt) setExpiry(data.expiresAt);
      setDevUrl(data.verificationUrl);
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
        <p className="mt-2 text-sm text-secondary-label">
          We sent a verification link to <span className="font-medium text-primary-label">{email}</span>.
          Verification is required before you can sign in.
        </p>

        <div className="mt-4 rounded-2xl bg-shading px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-secondary-label">
            {expired ? 'Link expired' : 'Link expires in'}
          </p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${expired ? 'text-red-300' : 'text-primary-label'}`}>
            {expired ? '0:00' : formatRemaining(remainingMs)}
          </p>
        </div>

        {devUrl && (
          <p className="mt-3 break-all rounded-2xl bg-shading px-3 py-2 text-left text-xs text-secondary-label">
            Dev link: <a href={devUrl} className="underline">{devUrl}</a>
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
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary-label text-sm font-semibold text-primary-background transition-all disabled:opacity-60"
        >
          {resendState === 'loading' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCw className="h-4 w-4" />
          )}
          Resend verification email
        </button>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full text-xs font-semibold text-secondary-label underline underline-offset-4 hover:text-primary-label"
        >
          Close
        </button>
      </div>
    </div>
  );
}
