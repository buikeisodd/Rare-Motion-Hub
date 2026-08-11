const crypto = require('crypto');
const { AppError } = require('../middlewares/error.middleware');
const {
  incrementWindowCounter,
  getSecurityValue,
  setSecurityValue,
  clearSecurityValue,
  recordSecurityEvent
} = require('./security.service');

const LOGIN_MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 5);
const LOGIN_WINDOW_SECONDS = Number(process.env.LOGIN_WINDOW_SECONDS || 15 * 60);
const LOGIN_LOCK_SECONDS = Number(process.env.LOGIN_LOCK_SECONDS || 15 * 60);
const AUTH_ACTION_MAX_ATTEMPTS = Number(process.env.AUTH_ACTION_MAX_ATTEMPTS || 5);
const AUTH_ACTION_WINDOW_SECONDS = Number(process.env.AUTH_ACTION_WINDOW_SECONDS || 10 * 60);

const securitySubject = (value) => crypto.createHash('sha256').update(String(value || '').trim().toLowerCase()).digest('hex');
const clientSubject = (req) => securitySubject(req.ip || req.headers['x-forwarded-for'] || 'unknown');

const setRetryAfter = (req, seconds) => {
  if (req.res && seconds > 0) req.res.set('Retry-After', String(seconds));
};

const enforceActionLimit = async (req, action, subject, maxAttempts = AUTH_ACTION_MAX_ATTEMPTS, windowSeconds = AUTH_ACTION_WINDOW_SECONDS) => {
  const key = `rate:${action}:${subject || clientSubject(req)}`;
  const { count, ttl } = await incrementWindowCounter(key, windowSeconds);
  if (count > maxAttempts) {
    setRetryAfter(req, ttl);
    throw new AppError(`Too many ${action.replace(/-/g, ' ')} attempts. Try again in ${Math.ceil(ttl / 60)} minute(s).`, 429);
  }
};

const ensureLoginNotLocked = async (req, email) => {
  const lockKey = `lock:login:${securitySubject(email)}`;
  const lockUntil = await getSecurityValue(lockKey);
  if (!lockUntil) return;
  const remainingSeconds = Math.ceil((Number(lockUntil) - Date.now()) / 1000);
  if (remainingSeconds > 0) {
    setRetryAfter(req, remainingSeconds);
    throw new AppError(`Too many failed login attempts. Try again in ${Math.ceil(remainingSeconds / 60)} minute(s).`, 429);
  }
  await clearSecurityValue(lockKey);
};

const noteLoginFailure = async (req, email) => {
  const subject = securitySubject(email);
  const { count } = await incrementWindowCounter(`rate:login:${subject}`, LOGIN_WINDOW_SECONDS);
  if (count >= LOGIN_MAX_ATTEMPTS) {
    const lockUntil = Date.now() + LOGIN_LOCK_SECONDS * 1000;
    await setSecurityValue(`lock:login:${subject}`, lockUntil, LOGIN_LOCK_SECONDS);
    await recordSecurityEvent({
      req,
      type: 'login_locked',
      metadata: { email, attempts: count, lockSeconds: LOGIN_LOCK_SECONDS }
    });
  }
};

const noteLoginSuccess = async (email) => {
  const subject = securitySubject(email);
  await clearSecurityValue(`rate:login:${subject}`);
  await clearSecurityValue(`lock:login:${subject}`);
};

module.exports = {
  AUTH_ACTION_WINDOW_SECONDS,
  clientSubject,
  enforceActionLimit,
  ensureLoginNotLocked,
  noteLoginFailure,
  noteLoginSuccess,
  securitySubject
};
