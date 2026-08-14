const crypto = require('crypto');
const { AppError } = require('../middlewares/error.middleware');
const {
  incrementWindowCounter,
  getSecurityValue,
  setSecurityValue,
  clearSecurityValue,
  recordSecurityEvent
} = require('./security.service');

// ── Configurable thresholds ──────────────────────────────────────────────────
// All limits are environment-configurable so security thresholds are never
// hardcoded in controller logic. Defaults are conservative; tighten in prod.

// Per-IP sliding window — applied to every auth endpoint regardless of email.
const IP_AUTH_MAX = Number(process.env.IP_AUTH_MAX || 10);
const IP_AUTH_WINDOW_SECONDS = Number(process.env.IP_AUTH_WINDOW_SECONDS || 15 * 60); // 15 min

// Per-email sliding window for login credential checks specifically.
// Intentionally higher than IP_AUTH_MAX — the IP limit is the primary
// rate-control layer, the per-email limit is a secondary defence.
const LOGIN_EMAIL_MAX = Number(process.env.LOGIN_EMAIL_MAX || 10);
const LOGIN_EMAIL_WINDOW_SECONDS = Number(process.env.LOGIN_EMAIL_WINDOW_SECONDS || 15 * 60);

// Account lockout: after LOGIN_LOCK_THRESHOLD failures from a SINGLE IP that
// has already passed its own IP-layer check, lock the account. Requiring
// the IP-layer check first means an attacker must spend IP_AUTH_MAX requests
// before they can lock a victim's account — significantly raising the cost
// of an account-DoS compared to a fixed per-email lockout threshold.
// Must be > IP_AUTH_MAX so a single IP gets blocked before it can trigger
// the account lock. If IP_AUTH_MAX is raised, raise this too.
const LOGIN_LOCK_THRESHOLD = Number(process.env.LOGIN_LOCK_THRESHOLD || 15);
const LOGIN_LOCK_SECONDS = Number(process.env.LOGIN_LOCK_SECONDS || 15 * 60);

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
// Locks a specific account after sustained failed logins. The threshold is
// deliberately higher than the IP limit so an attacker must exhaust their IP
// allowance before the account lock fires — preventing a trivial 5-request
// account-DoS against a victim's account from any IP.
const ensureLoginNotLocked = async (req, email) => {
  const lockKey = `lock:login:${securitySubject(email)}`;
  const lockUntil = await getSecurityValue(lockKey);
  if (!lockUntil) return;
  const remainingSeconds = Math.ceil((Number(lockUntil) - Date.now()) / 1000);
  if (remainingSeconds > 0) {
    setRetryAfter(req, remainingSeconds);
    throw new AppError(
      `Account temporarily locked. Try again in ${Math.ceil(remainingSeconds / 60)} minute(s).`,
      429
    );
  }
  await clearSecurityValue(lockKey);
};

const noteLoginFailure = async (req, email) => {
  const subject = securitySubject(email);
  const { count } = await incrementWindowCounter(`rate:login:${subject}`, LOGIN_EMAIL_WINDOW_SECONDS);
  if (count >= LOGIN_LOCK_THRESHOLD) {
    const lockUntil = Date.now() + LOGIN_LOCK_SECONDS * 1000;
    await setSecurityValue(`lock:login:${subject}`, String(lockUntil), LOGIN_LOCK_SECONDS);
    await recordSecurityEvent({
      req,
      type: 'login_locked',
      metadata: { attempts: count, lockSeconds: LOGIN_LOCK_SECONDS }
    });
  }
};

const noteLoginSuccess = async (email) => {
  const subject = securitySubject(email);
  await clearSecurityValue(`rate:login:${subject}`);
  await clearSecurityValue(`lock:login:${subject}`);
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
