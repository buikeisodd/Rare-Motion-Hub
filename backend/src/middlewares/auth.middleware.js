const jwt = require('jsonwebtoken');
const { AppError } = require('./error.middleware');
const { Session, User } = require('../models');
const { deriveAccountStatus } = require('../controllers/auth.controller');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'fallback_secret');
const IS_PROD = process.env.NODE_ENV === 'production';
const cookieName = (name) => IS_PROD ? `__Host-${name}` : name;

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

    // CSRF double-submit check for cookie-transported requests on unsafe methods.
    // The csrfToken cookie is readable by JS (not httpOnly), so the frontend
    // can echo it as a request header — an attacker making a cross-site request
    // can trigger the cookie to be sent automatically, but cannot read the
    // cookie value to echo it as a header (same-origin restriction).
    if (unsafeMethods.has(req.method)) {
      const csrfCookie = readAuthCookie(req, 'csrfToken');
      const csrfHeader = req.get('x-csrf-token');
      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        return next(new AppError('Unauthorized: Invalid CSRF token', 401));
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
