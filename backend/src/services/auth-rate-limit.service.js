const crypto = require('crypto');
const { AppError } = require('../middlewares/error.middleware');
const {
  incrementWindowCounter,
  getSecurityValue,
  setSecurityValue,
  clearSecurityValue,
  recordSecurityEvent
} = require('./security.service');
const { User } = require('../models');
const { sendSecurityAlertEmail } = require('../utils/email');

// ── Configurable thresholds ──────────────────────────────────────────────────
// All limits are environment-configurable so security thresholds are never
// hardcoded in controller logic. Defaults are conservative; tighten in prod.

// Per-IP sliding window — applied to every auth endpoint regardless of email.
const IP_AUTH_MAX = Number(process.env.IP_AUTH_MAX || 10);
const IP_AUTH_WINDOW_SECONDS = Number(process.env.IP_AUTH_WINDOW_SECONDS || 15 * 60); // 15 min

// Per-email sliding window for login (separate from the lockout counter).
// Secondary defence against distributed credential stuffing.
const LOGIN_EMAIL_MAX = Number(process.env.LOGIN_EMAIL_MAX || 10);
const LOGIN_EMAIL_WINDOW_SECONDS = Number(process.env.LOGIN_EMAIL_WINDOW_SECONDS || 15 * 60);

// Failed-login lockout thresholds (spec: 5 attempts → 5-minute lockout).
// LOGIN_FAIL_MAX must stay > IP_AUTH_MAX so a single IP is blocked before
// it can trigger the account lock — prevents trivial single-IP account-DoS.
const LOGIN_FAIL_MAX = Number(process.env.LOGIN_FAIL_MAX || 5);
const LOGIN_FAIL_WINDOW_SECONDS = Number(process.env.LOGIN_FAIL_WINDOW_SECONDS || 5 * 60);
const LOGIN_LOCK_SECONDS = Number(process.env.LOGIN_LOCK_SECONDS || 5 * 60);

// Key schema (auth:login:fail / auth:login:lock — hashed identifier so raw
// email addresses are never stored as Redis keys).
const failKey = (subject) => `auth:login:fail:${subject}`;
const lockKey = (subject) => `auth:login:lock:${subject}`;

// Per-email limits for other auth actions (register, verify, resend, reset).
const AUTH_EMAIL_MAX = Number(process.env.AUTH_EMAIL_MAX || 5);
const AUTH_EMAIL_WINDOW_SECONDS = Number(process.env.AUTH_EMAIL_WINDOW_SECONDS || 10 * 60);

// Per-IP limit for token refresh (looser — legitimate SPA users refresh often).
const REFRESH_IP_MAX = Number(process.env.REFRESH_IP_MAX || 60);
const REFRESH_IP_WINDOW_SECONDS = Number(process.env.REFRESH_IP_WINDOW_SECONDS || 15 * 60);

// Re-export so controllers that need them (register, verify, resend) can
// reference the window config without duplicating it.
const AUTH_ACTION_WINDOW_SECONDS = AUTH_EMAIL_WINDOW_SECONDS;

// ── Helpers ──────────────────────────────────────────────────────────────────

// Hash the subject so raw emails/IPs are never stored as Redis keys.
const securitySubject = (value) =>
  crypto.createHash('sha256').update(String(value || '').trim().toLowerCase()).digest('hex');

const clientSubject = (req) =>
  securitySubject(req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown');

const setRetryAfter = (req, seconds) => {
  if (req.res && seconds > 0) req.res.set('Retry-After', String(Math.ceil(seconds)));
};

// Single sliding-window counter check with a generic error message.
const checkLimit = async (req, key, max, windowSeconds, label) => {
  const { count, ttl } = await incrementWindowCounter(key, windowSeconds);
  if (count > max) {
    setRetryAfter(req, ttl);
    throw new AppError(
      `Too many ${label}. Try again in ${Math.ceil(ttl / 60)} minute(s).`,
      429
    );
  }
};

// ── Layer 1: IP-based rate limit ─────────────────────────────────────────────
// Applied first on every auth endpoint. Blocks high-volume probing from a
// single IP before any account-specific logic runs.
const enforceIpLimit = async (req, action, max = IP_AUTH_MAX, windowSeconds = IP_AUTH_WINDOW_SECONDS) => {
  const key = `rate:ip:${action}:${clientSubject(req)}`;
  await checkLimit(req, key, max, windowSeconds, `${action.replace(/-/g, ' ')} attempts`);
};

// ── Layer 2: Email/account-based rate limit ───────────────────────────────────
// Applied after IP check passes. Limits how many attempts can be made
// against a specific account across all IPs — protects against distributed
// credential stuffing where each IP stays under the IP limit.
const enforceEmailLimit = async (req, action, email, max = AUTH_EMAIL_MAX, windowSeconds = AUTH_EMAIL_WINDOW_SECONDS) => {
  const key = `rate:email:${action}:${securitySubject(email)}`;
  await checkLimit(req, key, max, windowSeconds, `${action.replace(/-/g, ' ')} attempts`);
};

// Backwards-compatible alias used by older controller call sites.
const enforceActionLimit = async (req, action, subject, max = AUTH_EMAIL_MAX, windowSeconds = AUTH_EMAIL_WINDOW_SECONDS) => {
  const key = `rate:${action}:${subject || clientSubject(req)}`;
  await checkLimit(req, key, max, windowSeconds, `${action.replace(/-/g, ' ')} attempts`);
};

// ── Layer 3: Account lockout ─────────────────────────────────────────────────
// Called BEFORE password verification — a locked account and a non-existent
// account return 429 without revealing which is the case.
// On lockout, response includes lockedUntil ISO timestamp for frontend countdown.
const ensureLoginNotLocked = async (req, email) => {
  const subject = securitySubject(email);
  const rawLockUntil = await getSecurityValue(lockKey(subject));
  if (!rawLockUntil) return;
  const lockUntilMs = Number(rawLockUntil);
  const remainingSeconds = Math.ceil((lockUntilMs - Date.now()) / 1000);
  if (remainingSeconds > 0) {
    setRetryAfter(req, remainingSeconds);
    const err = new AppError('Too many failed login attempts. Try again later.', 429);
    err.lockedUntil = new Date(lockUntilMs).toISOString();
    err.retryAfterSeconds = remainingSeconds;
    throw err;
  }
  // Lock expired — clear both lock and fail counter
  await Promise.all([
    clearSecurityValue(lockKey(subject)),
    clearSecurityValue(failKey(subject))
  ]);
};

const noteLoginFailure = async (req, email) => {
  const subject = securitySubject(email);
  // Failure counter TTL matches lockout window so counter self-expires
  // even if the lock threshold is never reached.
  const { count } = await incrementWindowCounter(failKey(subject), LOGIN_FAIL_WINDOW_SECONDS);
  if (count >= LOGIN_FAIL_MAX) {
    const lockUntilMs = Date.now() + LOGIN_LOCK_SECONDS * 1000;
    await setSecurityValue(lockKey(subject), String(lockUntilMs), LOGIN_LOCK_SECONDS);
    await recordSecurityEvent({
      req,
      type: 'SECURITY_ACCOUNT_LOCKED',
      metadata: { attempts: count, lockSeconds: LOGIN_LOCK_SECONDS }
    });
    // Notify the account owner on lockout — a significant, actionable event.
    // Individual failed attempts are recorded as AUTH_LOGIN_FAILED security
    // events but do NOT trigger an email to avoid notification spam abuse.
    // The notification is fire-and-forget; failure is logged but never throws.
    User.findOne({ email: email.trim().toLowerCase() }).lean()
      .then((user) => {
        if (!user) return;
        const lockMins = Math.ceil(LOGIN_LOCK_SECONDS / 60);
        return sendSecurityAlertEmail({
          to: user.email,
          name: user.name,
          subject: 'Your Starlight Station account has been temporarily locked',
          headline: 'Account locked',
          body: `We locked your account after ${count} failed sign-in attempts. It will unlock automatically in ${lockMins} minute${lockMins === 1 ? '' : 's'}. If this wasn't you, reset your password to secure your account.`,
          ctaText: 'Reset password',
          ctaUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`
        });
      })
      .catch((err) => console.error('[SecurityAlert] lockout email failed:', err.message));
  }
};

const noteLoginSuccess = async (email) => {
  const subject = securitySubject(email);
  // Clear both counters on successful authentication.
  await Promise.all([
    clearSecurityValue(failKey(subject)),
    clearSecurityValue(lockKey(subject))
  ]);
};

// ── Composite: full auth endpoint limiting ───────────────────────────────────
// Convenience function that applies IP + email layers together. Used for
// register, verify-email, resend-verification, forgot-password, reset-password.
const enforceAuthEndpointLimits = async (req, action, email) => {
  await enforceIpLimit(req, action);
  if (email) await enforceEmailLimit(req, action, email);
};

// ── Composite: login-specific limiting ──────────────────────────────────────
// Login needs the lockout check too, in addition to both rate-limit layers.
const enforceLoginLimits = async (req, email) => {
  await enforceIpLimit(req, 'login');
  await ensureLoginNotLocked(req, email);
  await enforceEmailLimit(req, 'login', email, LOGIN_EMAIL_MAX, LOGIN_EMAIL_WINDOW_SECONDS);
};

// ── Composite: refresh token limiting ───────────────────────────────────────
// Refresh is called frequently by legitimate clients (every 15 min per tab).
// IP-only limit, much looser window.
const enforceRefreshLimits = async (req) => {
  await enforceIpLimit(req, 'refresh', REFRESH_IP_MAX, REFRESH_IP_WINDOW_SECONDS);
};

module.exports = {
  AUTH_ACTION_WINDOW_SECONDS,
  clientSubject,
  enforceActionLimit,        // backwards-compat
  enforceAuthEndpointLimits,
  enforceEmailLimit,
  enforceIpLimit,
  enforceLoginLimits,
  enforceRefreshLimits,
  ensureLoginNotLocked,
  noteLoginFailure,
  noteLoginSuccess,
  securitySubject
};
