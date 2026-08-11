const jwt = require('jsonwebtoken');
const { AppError } = require('./error.middleware');
const { Session, User } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'fallback_secret');

const readCookie = (req, name) => {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`));
  if (!match) return '';
  return decodeURIComponent(match.slice(name.length + 1));
};

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const requireUserId = async (req, res, next) => {
  if (!JWT_SECRET) return next(new AppError('Server authentication is not configured.', 500));
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : '';
  const token = bearerToken || readCookie(req, 'accessToken');
  if (!token) {
    return next(new AppError('Unauthorized: Missing token', 401));
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.sessionId) {
      return next(new AppError('Unauthorized: Session is required', 401));
    }
    const [session, user] = await Promise.all([
      Session.findOne({
        sessionId: decoded.sessionId,
        userId: decoded.userId,
        revokedAt: { $exists: false },
        expiresAt: { $gt: new Date().toISOString() }
      }).lean(),
      User.findOne({ id: decoded.userId }).lean()
    ]);
    if (!session) return next(new AppError('Unauthorized: Session expired', 401));
    if (!user || user.isDeactivated) return next(new AppError('Unauthorized: Account unavailable', 401));
    if (user.emailVerified === false) {
      return next(new AppError('Please verify your email before continuing.', 403));
    }
    if (!bearerToken && unsafeMethods.has(req.method)) {
      const csrfCookie = readCookie(req, 'csrfToken');
      const csrfHeader = req.get('x-csrf-token');
      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        return next(new AppError('Unauthorized: Invalid CSRF token', 401));
      }
    }
    req.userId = decoded.userId;
    req.sessionId = decoded.sessionId;
    req.user = user;
    req.authTransport = bearerToken ? 'bearer' : 'cookie';
    next();
  } catch (error) {
    return next(new AppError('Unauthorized: Invalid token', 401));
  }
};

module.exports = { requireUserId };
