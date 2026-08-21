const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { AppError } = require('./error.middleware');
const { Session, User } = require('../models');
const { deriveAccountStatus } = require('../controllers/auth.controller');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'fallback_secret');
const IS_PROD = process.env.NODE_ENV === 'production';
const SAME_SITE_STRICT = process.env.SAME_SITE_STRICT === 'true';

// Must match the cookie naming logic in auth.controller.js exactly.
const cookieName = (name) => {
  if (!IS_PROD) return name;
  return SAME_SITE_STRICT ? `__Host-${name}` : `__Secure-${name}`;
};

const readAuthCookie = (req, name) => {
  const cookieHeader = req.headers.cookie || '';
  const prefixed = cookieName(name);
  const match = cookieHeader
    .split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${prefixed}=`));
  if (!match) return '';
  return decodeURIComponent(match.slice(prefixed.length + 1));
};

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// ─── requireAuth ─────────────────────────────────────────────────────────────
// Responsibility 1: validate the access JWT.
// Responsibility 2: validate the session against MongoDB (live revocation check).
// Responsibility 3: attach req.userId, req.sessionId, req.user for downstream.
// Responsibility 4: enforce CSRF double-submit on unsafe methods.
//
// This middleware intentionally does NOT check emailVerified or accountStatus —
// those are the concern of requireVerifiedUser below. Separating them means:
//   - routes that just need "who is this user" (e.g. logout, refresh) use
//     requireAuth alone and aren't blocked by account state.
//   - routes that need a fully active, verified account stack both.
//
// Public endpoints (register, login, verify-email, forgot-password, etc.)
// use neither — they are intentionally unprotected.
const requireAuth = async (req, res, next) => {
  if (!JWT_SECRET) return next(new AppError('Server authentication is not configured.', 500));

  // Access token lives exclusively in an HttpOnly cookie. Bearer header is
  // not accepted — the old localStorage-based flow has been removed.
  // Mobile clients send the token as Bearer (from expo-secure-store) via the
  // Authorization header, since React Native doesn't have a cookie jar.
  const cookieToken = readAuthCookie(req, 'accessToken');
  const bearerToken = (req.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const token = cookieToken || bearerToken;

  if (!token) return next(new AppError('Unauthorized: Missing token', 401));

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Type guard: only access tokens are valid here. Refresh tokens (opaque,
    // not JWTs) and any future token types are explicitly rejected.
    if (decoded.type !== 'access') {
      return next(new AppError('Unauthorized: Wrong token type', 401));
    }

    const userId = decoded.sub;
    const sessionId = decoded.sid;
    if (!userId || !sessionId) {
      return next(new AppError('Unauthorized: Malformed token claims', 401));
    }

    // Live session check — this is what makes the access token short-lived
    // and revocable. Revoking the Session document (logout, reuse detection,
    // deactivation) takes effect immediately on the next request regardless
    // of the token's remaining TTL.
    const [session, user] = await Promise.all([
      Session.findOne({
        sessionId,
        userId,
        revokedAt: { $exists: false },
        expiresAt: { $gt: new Date().toISOString() }
      }).lean(),
      User.findOne({ id: userId }).lean()
    ]);

    if (!session) return next(new AppError('Unauthorized: Session expired or revoked', 401));
    if (!user) return next(new AppError('Unauthorized: Account not found', 401));

    // CSRF double-submit / custom header protection for all state-changing methods.
    // OWASP CSRF Prevention: Custom headers (like x-csrf-token) cannot be forged
    // cross-domain without passing CORS preflight. Requiring the x-csrf-token
    // header (and comparing against cookie when present) guarantees CSRF protection
    // while preventing false 403 blocks when 3rd-party cookies are restricted.
    if (unsafeMethods.has(req.method)) {
      const csrfCookie = readAuthCookie(req, 'csrfToken');
      const csrfHeader = req.get('x-csrf-token') || '';
      
      const tokenValid = (() => {
        if (!csrfHeader) return false;
        if (!csrfCookie) return true;
        if (csrfHeader === csrfCookie) return true;
        const a = Buffer.from(csrfCookie, 'utf8');
        const b = Buffer.from(csrfHeader, 'utf8');
        return a.length === b.length && crypto.timingSafeEqual(a, b);
      })();

      if (!tokenValid) {
        return next(new AppError('Forbidden: Invalid CSRF token', 403));
      }
    }

    // Attach context for downstream middleware and route handlers.
    req.userId = userId;
    req.sessionId = sessionId;
    req.user = user;
    req.isMobileClient = Boolean(bearerToken && !cookieToken);
    next();
  } catch (err) {
    return next(new AppError('Unauthorized: Invalid token', 401));
  }
};

// Attach a verified access identity when present, but allow public media to
// continue without credentials. Protected media still performs its own
// authorization check after this middleware.
const optionalAuth = async (req, res, next) => {
  if (!(req.headers.cookie || req.get('authorization'))) return next();
  return requireAuth(req, res, (error) => error ? next() : next());
};

// ─── requireVerifiedUser ──────────────────────────────────────────────────────
// Responsibility: check that the authenticated user's account is in a state
// that permits normal application access.
//
// Must run AFTER requireAuth (relies on req.user being set).
//
// Fails with:
//   403  if the account is pending email verification
//   401  if the account is deactivated or suspended
//
// Routes that should NOT stack this:
//   POST /auth/logout          (a deactivated user should still be able to log out)
//   POST /auth/logout-all      (same)
//   DELETE /auth/:id           (account deletion should still work)
//   POST /auth/:id/deactivate  (same)
//
// Everything else in the application — workspace, tracks, chat, folders,
// covers, feed — stacks both requireAuth + requireVerifiedUser.
const requireVerifiedUser = (req, res, next) => {
  if (!req.user) {
    // requireAuth must run first. This is a programming error, not a client error.
    return next(new AppError('requireVerifiedUser must come after requireAuth', 500));
  }
  const status = req.user.accountStatus || deriveAccountStatus(req.user);
  if (status === 'deactivated' || status === 'suspended') {
    return next(new AppError('Unauthorized: Account unavailable', 401));
  }
  if (status === 'pending_verification') {
    return next(new AppError('Please verify your email before continuing.', 403));
  }
  next();
};

// ─── requireUserId ─────────────────────────────────────────────────────────────
// Backwards-compatible alias: requireAuth + requireVerifiedUser in one call.
// Used on the bulk of application routes. New routes should prefer the
// explicit two-middleware form for clarity, but this alias avoids having to
// update every route file at once.
const requireUserId = [requireAuth, requireVerifiedUser];

module.exports = { requireAuth, requireVerifiedUser, requireUserId, optionalAuth, readAuthCookie };
