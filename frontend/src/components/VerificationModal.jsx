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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505]/80 backdrop-blur-sm px-4 animate-fade-in">
      <div className="w-full max-w-sm rounded-2xl border border-[rgba(255,255,255,.09)] bg-[#111111] p-6 text-center shadow-2xl">

        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[rgba(215,255,101,.12)]">
          <Mail className="h-6 w-6 text-[#D7FF65]" />
        </div>

        <h2 className="text-xl font-bold text-[#F7F4EC]">Verify your email</h2>

        <p className="mt-2 text-xs text-[#A6A09A]">
          Your email is pending verification:
        </p>
        <p className="mt-1 font-semibold text-[#F7F4EC] break-all">{email}</p>

        <div className="mt-5 rounded-xl bg-[#171717] border border-[rgba(255,255,255,.09)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider font-medium text-[#A6A09A]">
            {expired ? 'Verification window expired' : 'Verification window closes in'}
          </p>
          <p className={`mt-1 text-3xl font-bold tabular-nums tracking-tight ${expired ? 'text-[#FF5C6C]' : 'text-[#F7F4EC]'}`}>
            {expired ? '0:00' : formatRemaining(remainingMs)}
          </p>
        </div>

        {status === 'error' && (
          <p className="mt-3 text-xs font-medium text-[#FF5C6C]">{errorMsg}</p>
        )}
        {status === 'success' && (
          <p className="mt-3 text-xs font-medium text-[#D7FF65]">Successfully verified. Redirecting…</p>
        )}

        {expired ? (
          <button
            type="button"
            onClick={handleResend}
            disabled={status === 'loading_resend'}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#D7FF65] text-sm font-bold text-[#050505] transition-all hover:bg-[#E3FF91] active:scale-[0.99] disabled:opacity-50 shadow-md"
          >
            {status === 'loading_resend' ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#050505]" />
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
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#D7FF65] text-sm font-bold text-[#050505] transition-all hover:bg-[#E3FF91] active:scale-[0.99] disabled:opacity-50 shadow-md"
          >
            {status === 'loading_verify' ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#050505]" />
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
            className="mt-3 w-full text-xs font-medium text-[#A6A09A] hover:text-[#F7F4EC] transition-colors"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
