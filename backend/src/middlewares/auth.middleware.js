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

// Reads a cookie by its correct environment-specific name (__Host- in prod).
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

const requireUserId = async (req, res, next) => {
  if (!JWT_SECRET) return next(new AppError('Server authentication is not configured.', 500));

  // Cookie-only transport. Bearer header is no longer accepted for
  // authenticated requests — credentials live exclusively in HttpOnly cookies.
  // Removing the Bearer fallback eliminates the old localStorage-based flow
  // and closes the split-brain window where both mechanisms were active.
  const token = readAuthCookie(req, 'accessToken');
  if (!token) {
    return next(new AppError('Unauthorized: Missing token', 401));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'access') {
      return next(new AppError('Unauthorized: Wrong token type', 401));
    }
    const userId = decoded.sub;
    const sessionId = decoded.sid;
    if (!userId || !sessionId) {
      return next(new AppError('Unauthorized: Session is required', 401));
    }
    const [session, user] = await Promise.all([
      Session.findOne({
        sessionId,
        userId,
        revokedAt: { $exists: false },
        expiresAt: { $gt: new Date().toISOString() }
      }).lean(),
      User.findOne({ id: userId }).lean()
    ]);
    if (!session) return next(new AppError('Unauthorized: Session expired', 401));
    if (!user) return next(new AppError('Unauthorized: Account unavailable', 401));

    // Re-derive account status from the live Mongo document on every request —
    // never trust mutable state from the JWT itself (see tokenForUser).
    const status = user.accountStatus || deriveAccountStatus(user);
    if (status === 'deactivated' || status === 'suspended') {
      return next(new AppError('Unauthorized: Account unavailable', 401));
    }
    if (status === 'pending_verification') {
      return next(new AppError('Please verify your email before continuing.', 403));
    }

    // CSRF double-submit check for all state-changing methods (POST/PUT/PATCH/DELETE).
    //
    // Why this works in the cross-domain topology (SameSite=None):
    // An attacker on evil.com can trigger cross-site requests that carry the
    // HttpOnly auth cookies automatically, but they cannot READ the csrfToken
    // cookie value — the same-origin policy blocks JS on a foreign origin from
    // reading cookies set by onrender.com. So they can cause the auth cookies
    // to be sent but cannot echo the csrfToken as a header, which fails this check.
    //
    // Bearer-only requests (mobile): the CSRF header comes from SecureStore via
    // api.js and is required. The mobile flow always sets it.
    //
    // The comparison uses a timing-safe equality check to eliminate any
    // theoretical timing oracle, though the practical CSRF risk from timing is
    // negligible relative to an attacker needing to read the cookie first.
    if (unsafeMethods.has(req.method)) {
      const csrfCookie = readAuthCookie(req, 'csrfToken');
      const csrfHeader = req.get('x-csrf-token') || '';
      const cookieBuf = Buffer.from(csrfCookie || '', 'utf8');
      const headerBuf = Buffer.from(csrfHeader, 'utf8');
      const tokenValid =
        csrfCookie &&
        csrfHeader &&
        cookieBuf.length === headerBuf.length &&
        require('crypto').timingSafeEqual(cookieBuf, headerBuf);
      if (!tokenValid) {
        return next(new AppError('Unauthorized: Invalid CSRF token', 403));
      }
    }

    req.userId = userId;
    req.sessionId = sessionId;
    req.user = user;
    next();
  } catch (error) {
    return next(new AppError('Unauthorized: Invalid token', 401));
  }
};

module.exports = { requireUserId };
