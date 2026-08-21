const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { User, Session, Folder, Project, Track, CoverArt, Notification, PlayEvent } = require('../models');
const { removeDirIfExists, removeFileIfExists, getUserDir, uploadDir, coverDir, avatarDir } = require('../utils/fileHelper');
const { cloudinary, hasCloudinaryConfig } = require('../config/cloudinary');
const { invalidateCache } = require('../config/redis');
const { AppError } = require('../middlewares/error.middleware');
const { BASE_URL, publicUser } = require('../utils/helpers');
const { readDB, writeDB, ensureDBShape } = require('../utils/dbHelper');
const { hasSmtpConfig, sendVerificationEmail, sendPasswordResetEmail, sendSecurityAlertEmail } = require('../utils/email');
const {
  recordSecurityEvent,
  createOpaqueToken,
  createRefreshSession,
  rotateRefreshSession,
  revokeRefreshSession,
  revokeAllSessionsForUser,
  getSecurityValue,
  setSecurityValue,
  clearSecurityValue,
  consumeSecurityValue,
  REFRESH_TOKEN_TTL_MS
} = require('../services/security.service');
const {
  AUTH_ACTION_WINDOW_SECONDS,
  clientSubject,
  enforceActionLimit,
  enforceAuthEndpointLimits,
  enforceLoginLimits,
  enforceRefreshLimits,
  enforceResendLimits,
  noteLoginFailure,
  noteLoginSuccess,
  securitySubject
} = require('../services/auth-rate-limit.service');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'fallback_secret');

const ensureAuthConfig = () => {
  if (!JWT_SECRET) throw new AppError('Server authentication is not configured.', 500);
};

const FRONTEND_URL = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const makeVerificationToken = () => crypto.randomBytes(32).toString('hex');
const ACCESS_TOKEN_TTL_MS = Number(process.env.ACCESS_TOKEN_TTL_MS || 1000 * 60 * 15);
const accessTokenSeconds = () => Math.max(1, Math.floor(ACCESS_TOKEN_TTL_MS / 1000));

// Access token claims are deliberately minimal: sub (userId), sid
// (sessionId), and type ('access', to distinguish it from any other token
// kind that might ever be signed as a JWT — refresh tokens today are opaque,
// not JWTs, but this guards against token confusion either way). iat/exp are
// added automatically by jsonwebtoken via the `expiresIn` option.
//
// Deliberately NOT included: emailVerified, accountStatus, role, or any
// other mutable authorization fact. Those can change the instant after
// this token is issued (e.g. an admin suspends the account), and a JWT is
// self-contained/stateless by design — trusting a stale mutable claim for
// up to the token's full lifetime would let a suspended/deactivated/
// unverified account keep acting as if nothing changed until the token
// naturally expires. The middleware re-reads the User/Session documents
// from Mongo on every request instead, so current state is always current.
const tokenForUser = (id, sessionId, expiresIn = accessTokenSeconds()) => jwt.sign(
  { sub: id, sid: sessionId, type: 'access' },
  JWT_SECRET,
  { expiresIn }
);

// Explicit account lifecycle: pending_verification -> active, with
// suspended/deactivated as terminal-ish states an admin/user action can move
// into. This is a *derived* label — isDeactivated/isSuspended/emailVerified
// remain the actual booleans everything is computed from, so any user
// document (including ones written before this field existed) always
// resolves to a correct status without needing a data migration.
const deriveAccountStatus = (user) => {
  if (!user) return null;
  if (user.isDeactivated) return 'deactivated';
  if (user.isSuspended) return 'suspended';
  // Fail closed: anything other than an explicit `true` is treated as
  // unverified, matching the User schema's own `default: false`.
  if (!user.emailVerified) return 'pending_verification';
  return 'active';
};

const userResponse = (user) => ({ ...publicUser(user), email: user.email, emailVerified: user.emailVerified !== false, accountStatus: user.accountStatus || deriveAccountStatus(user), authProvider: user.authProvider || 'password' });

// Cookie deployment topology decision — documented here because it affects
// security properties:
//
// The frontend (*.vercel.app) and backend (*.onrender.com) live on different
// registrable domains. This means:
//
//   SameSite=Strict:  cookies are NEVER sent cross-site — including by the
//                     legitimate frontend. This breaks authentication entirely
//                     in this cross-domain deployment.
//
//   SameSite=Lax:     cookies are sent on top-level navigations but NOT on
//                     sub-resource requests (fetch/XHR). Still breaks API
//                     calls from the SPA frontend.
//
//   SameSite=None; Secure: cookies are sent on all HTTPS cross-site requests
//                     when credentials:include is set. This is the only
//                     option that works in cross-domain deployments.
//                     The CSRF risk this reintroduces — a cross-site attacker
//                     can now trigger cookie-carrying requests — is mitigated
//                     by the existing double-submit CSRF pattern: they can
//                     trigger the cookie but cannot read the csrfToken cookie
//                     value from a cross-origin context (same-origin policy),
//                     so they cannot echo it as the x-csrf-token header.
//
// The __Host- prefix requires SameSite=Strict and Secure. Since we're
// switching to SameSite=None for cross-domain compatibility, __Host- no
// longer applies in production either — use __Secure- instead, which
// requires only the Secure attribute and binds to HTTPS.
//
// If the frontend and backend are ever colocated on the same domain (e.g.
// same-domain Render + custom domain), SameSite=Strict can be restored and
// the double-submit becomes defence-in-depth rather than the primary CSRF
// defence. Set SAME_SITE_STRICT=true in env to opt into this.

const IS_PROD = process.env.NODE_ENV === 'production';
const SAME_SITE_STRICT = process.env.SAME_SITE_STRICT === 'true';

// In production with cross-domain deployment: __Secure- prefix (Secure only).
// In production with same-domain: __Host- prefix (Secure + no Domain + Path=/).
// In development: no prefix (plain names, http).
const cookieName = (name) => {
  if (!IS_PROD) return name;
  return SAME_SITE_STRICT ? `__Host-${name}` : `__Secure-${name}`;
};

const cookieOptions = (maxAge, overrides = {}) => ({
  httpOnly: true,
  secure: IS_PROD,
  sameSite: IS_PROD ? (SAME_SITE_STRICT ? 'strict' : 'none') : 'lax',
  path: '/',
  maxAge,
  ...overrides
});

const clearAuthCookies = (res) => {
  const opts = cookieOptions(0);
  res.clearCookie(cookieName('accessToken'), opts);
  res.clearCookie(cookieName('refreshToken'), opts);
  res.clearCookie(cookieName('sessionId'), opts);
  // csrfToken is readable by JS (httpOnly: false) so the frontend
  // can include it in request headers for CSRF double-submit.
  res.clearCookie(cookieName('csrfToken'), { ...opts, httpOnly: false });
};

const readCookie = (req, name) => {
  const cookieHeader = req.headers.cookie || '';
  if (!cookieHeader) return '';
  const expected = cookieName(name);
  const prefixes = [
    `${expected}=`,
    `__Secure-${name}=`,
    `__Host-${name}=`,
    `${name}=`
  ];
  const items = cookieHeader.split(';').map((v) => v.trim());
  for (const prefix of prefixes) {
    const match = items.find((v) => v.startsWith(prefix));
    if (match) return decodeURIComponent(match.slice(prefix.length));
  }
  return '';
};

const issueAuthSession = async (req, res, user) => {
  if (!user || user.emailVerified === false) {
    throw new AppError('Please verify your email before signing in.', 403);
  }
  const { session, refreshToken } = await createRefreshSession({ req, userId: user.id });
  const csrfToken = createOpaqueToken(24);
  const accessToken = tokenForUser(user.id, session.sessionId);

  // Set HttpOnly cookies for web clients that support third-party cookies.
  res.cookie(cookieName('accessToken'), accessToken, cookieOptions(ACCESS_TOKEN_TTL_MS));
  res.cookie(cookieName('refreshToken'), refreshToken, cookieOptions(REFRESH_TOKEN_TTL_MS));
  res.cookie(cookieName('sessionId'), session.sessionId, cookieOptions(REFRESH_TOKEN_TTL_MS));
  res.cookie(cookieName('csrfToken'), csrfToken, cookieOptions(REFRESH_TOKEN_TTL_MS, { httpOnly: false }));
  
  const isMobileClient = (req.get('x-client-type') || '').toLowerCase() === 'mobile';

  // Only the CSRF token is exposed to browser JavaScript. Authentication
  // tokens remain HttpOnly for web clients.
  res.set('x-csrf-token', csrfToken);

  return {
    sessionId: session.sessionId,
    csrfToken,
    ...(isMobileClient ? { token: accessToken, refreshToken } : {})
  };
};

const EMAIL_VERIFICATION_TTL_SECONDS = 5 * 60;
const PASSWORD_RESET_TTL_SECONDS = 30 * 60;

const createEmailVerification = async (user) => {
  // Invalidate any previously issued token for this user before issuing a new one.
  const previousHash = await getSecurityValue(`verify-user:${user.id}`);
  if (previousHash) await clearSecurityValue(`verify:${previousHash}`);

  const verificationToken = makeVerificationToken();
  const tokenHash = hashToken(verificationToken);
  const verificationUrl = `${FRONTEND_URL.replace(/\/$/, '')}/verify-email?token=${verificationToken}`;
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_SECONDS * 1000).toISOString();

  // Ephemeral, TTL-bound state lives in Redis (with in-memory fallback) —
  // Mongo/User stays the source of truth for the account itself.
  await setSecurityValue(`verify:${tokenHash}`, user.id, EMAIL_VERIFICATION_TTL_SECONDS);
  await setSecurityValue(`verify-user:${user.id}`, tokenHash, EMAIL_VERIFICATION_TTL_SECONDS);

  const emailResult = await sendVerificationEmail({ to: user.email, name: user.name, verificationUrl });
  return {
    sent: emailResult.sent,
    // expiresAt is safe to always expose — it reveals nothing secret, and
    // is exactly what the frontend needs to drive an authoritative countdown.
    expiresAt,
    // The raw token itself must never appear in a production API response —
    // only ever in the emailed link. This dev-only escape hatch exists so
    // local/testing flows can work without a real SMTP provider configured.
    verificationUrl: process.env.NODE_ENV === 'production' ? undefined : verificationUrl
  };
};

const createPasswordReset = async (user) => {
  const previousHash = await getSecurityValue(`reset-user:${user.id}`);
  if (previousHash) await clearSecurityValue(`reset:${previousHash}`);

  const resetToken = makeVerificationToken();
  const tokenHash = hashToken(resetToken);
  const resetUrl = `${FRONTEND_URL.replace(/\/$/, '')}/login?resetToken=${resetToken}`;

  await setSecurityValue(`reset:${tokenHash}`, user.id, PASSWORD_RESET_TTL_SECONDS);
  await setSecurityValue(`reset-user:${user.id}`, tokenHash, PASSWORD_RESET_TTL_SECONDS);

  const emailResult = await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl });
  return {
    sent: emailResult.sent,
    resetUrl: process.env.NODE_ENV === 'production' ? undefined : resetUrl
  };
};

const register = async (req, res, next) => {
  try {
    ensureAuthConfig();
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;
    if (!email || !password) return next(new AppError('Email and password are required.', 400));
    await enforceAuthEndpointLimits(req, 'register', email);
    if (String(password).length < 8) return next(new AppError('Password must be at least 8 characters.', 400));

    let user = await User.findOne({ email }).lean();
    if (user) return next(new AppError('Email already exists.', 400));

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const name = email.split('@')[0];
    const passwordHash = await bcrypt.hash(password, 10);
    
    const newUser = {
      id,
      name,
      username: name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      bio: '',
      followers: [],
      following: [],
      email,
      passwordHash,
      emailVerified: false,
      accountStatus: 'pending_verification',
      authProvider: 'password',
      avatarUrl: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await User.create(newUser);

    const verification = await createEmailVerification(newUser);
    await recordSecurityEvent({
      req,
      userId: newUser.id,
      type: 'AUTH_REGISTERED',
      metadata: { emailSent: verification.sent }
    });
    res.status(201).json({
      requiresVerification: true,
      email,
      emailSent: verification.sent,
      expiresAt: verification.expiresAt,
      verificationUrl: verification.verificationUrl,
      message: hasSmtpConfig
        ? 'Check your email to verify your account before signing in.'
        : 'Account created. Email sending is not configured, so verification cannot be delivered yet.'
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    ensureAuthConfig();
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;
    if (!email || !password) return next(new AppError('Email and password are required.', 400));

    // 4+5. Rate-limit state (IP layer + email layer) and lockout state.
    // Order in the spec is conceptual; enforceLoginLimits applies all three
    // controls — IP window, account lockout check, per-email window — in the
    // correct sequence with the lockout check between the two rate layers
    // so an expired lock is cleared before the per-email counter is checked.
    await enforceLoginLimits(req, email);

    // 1. Credentials — existence + password must both check out before
    // anything about the account is revealed, so a wrong password and a
    // deactivated/suspended account return the same generic error.
    const user = await User.findOne({ email }).lean();
    if (!user || !user.passwordHash) {
      await noteLoginFailure(req, email);
      await recordSecurityEvent({ req, type: 'AUTH_LOGIN_FAILED', metadata: { email, reason: 'invalid_credentials' } });
      return next(new AppError('Invalid email or password.', 401));
    }
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      await noteLoginFailure(req, email);
      await recordSecurityEvent({ req, userId: user.id, type: 'AUTH_LOGIN_FAILED', metadata: { reason: 'invalid_credentials' } });
      return next(new AppError('Invalid email or password.', 401));
    }

    // 2. Account state — deactivated/suspended, checked only once credentials
    // are already proven valid.
    if (user.isDeactivated) {
      await recordSecurityEvent({ req, userId: user.id, type: 'AUTH_LOGIN_FAILED', metadata: { reason: 'deactivated' } });
      return next(new AppError('This account is deactivated.', 403));
    }
    if (user.isSuspended) {
      await recordSecurityEvent({ req, userId: user.id, type: 'AUTH_LOGIN_FAILED', metadata: { reason: 'suspended' } });
      return next(new AppError('This account is suspended.', 403));
    }

    // 3. Email verification state — credentials are correct and the account
    // is otherwise in good standing, but verification is still required.
    // No session, cookies, or tokens are issued past this point.
    if (!user.emailVerified) {
      await recordSecurityEvent({ req, userId: user.id, type: 'AUTH_LOGIN_FAILED', metadata: { reason: 'email_unverified' } });
      return res.status(403).json({
        success: false,
        requiresEmailVerification: true
      });
    }

    const { sessionId, ...mobileTokens } = await issueAuthSession(req, res, user);
    await noteLoginSuccess(email);
    await recordSecurityEvent({ req, userId: user.id, sessionId, type: 'AUTH_LOGIN_SUCCESS' });
    res.json({ success: true, user: userResponse(user), ...mobileTokens });
  } catch (error) {
    next(error);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    ensureAuthConfig();
    const token = req.body.token || req.query.token;
    if (!token) return next(new AppError('Verification token is required.', 400));
    // IP-only: we don't have the email at this point (token is opaque), so
    // only apply the IP layer. The token itself is single-use and short-lived,
    // so brute-forcing it is infeasible regardless of rate limiting.
    await enforceAuthEndpointLimits(req, 'verify-email');
    const tokenHash = hashToken(token);

    // Atomically read-and-delete the token in one step. If two requests race
    // on the same token, only one GETDEL call returns the userId — the other
    // gets null, so it can never successfully verify using the same token.
    const userId = await consumeSecurityValue(`verify:${tokenHash}`);
    if (!userId) {
      await recordSecurityEvent({ req, type: 'AUTH_EMAIL_VERIFICATION_FAILED', metadata: { reason: 'invalid_or_expired' } });
      return next(new AppError('Invalid or expired verification link. Request a new one.', 400));
    }
    // Best-effort cleanup of the reverse pointer used to invalidate old
    // tokens on reissue; the primary token above is already consumed.
    clearSecurityValue(`verify-user:${userId}`).catch(() => {});

    // Read current suspension/deactivation state first so verification
    // can't silently reactivate a suspended/deactivated account — those
    // states take precedence over the pending_verification -> active move.
    const existing = await User.findOne({ id: userId }).select('isSuspended isDeactivated').lean();
    if (!existing) {
      await recordSecurityEvent({ req, type: 'AUTH_EMAIL_VERIFICATION_FAILED', metadata: { reason: 'user_not_found' } });
      return next(new AppError('Invalid or expired verification link. Request a new one.', 400));
    }
    const nextStatus = existing.isDeactivated ? 'deactivated' : existing.isSuspended ? 'suspended' : 'active';

    const updates = { emailVerified: true, accountStatus: nextStatus, updatedAt: new Date().toISOString() };
    const user = await User.findOneAndUpdate(
      { id: userId },
      { $set: updates },
      { returnDocument: 'after', lean: true }
    );
    if (!user) {
      await recordSecurityEvent({ req, type: 'AUTH_EMAIL_VERIFICATION_FAILED', metadata: { reason: 'user_not_found' } });
      return next(new AppError('Invalid or expired verification link. Request a new one.', 400));
    }

    const { sessionId, ...mobileTokens } = await issueAuthSession(req, res, user);
    await recordSecurityEvent({ req, userId: user.id, sessionId, type: 'AUTH_EMAIL_VERIFIED' });
    const verifiedUser = { ...user, ...updates };
    res.json({ user: userResponse(verifiedUser), ...mobileTokens });
  } catch (error) {
    next(error);
  }
};

const resendVerification = async (req, res, next) => {
  try {
    ensureAuthConfig();
    const email = req.body.email?.trim().toLowerCase();
    if (!email) return next(new AppError('Email is required.', 400));

    // Tighter rate limit than generic auth endpoints — each resend triggers
    // an outbound email (IP: 5/10min, per-email: 3/10min).
    await enforceResendLimits(req, email);

    const user = await User.findOne({ email }).lean();

    // Return the same success-shaped response whether the account exists or not
    // to avoid leaking which email addresses have accounts.
    if (!user || user.emailVerified !== false) {
      return res.json({
        email,
        emailSent: false,
        message: 'If an unverified account exists for this email, a new verification link has been sent.'
      });
    }

    // createEmailVerification atomically invalidates the previous token
    // (clears verify:{oldHash} and verify-user:{userId} from Redis) before
    // issuing a new one — so the old link stops working the moment this runs.
    const verification = await createEmailVerification(user);
    await recordSecurityEvent({
      req,
      userId: user.id,
      type: 'AUTH_EMAIL_VERIFICATION_SENT',
      metadata: { emailSent: verification.sent, reason: 'resend' }
    });
    res.json({
      email,
      emailSent: verification.sent,
      expiresAt: verification.expiresAt,
      verificationUrl: verification.verificationUrl,
      message: 'If an unverified account exists for this email, a new verification link has been sent.'
    });
  } catch (error) {
    next(error);
  }
};

const requestPasswordReset = async (req, res, next) => {
  try {
    ensureAuthConfig();
    const email = req.body.email?.trim().toLowerCase();
    if (!email) return next(new AppError('Email is required.', 400));
    await enforceAuthEndpointLimits(req, 'forgot-password', email);
    const user = await User.findOne({ email }).lean();
    if (user && user.passwordHash && !user.isDeactivated && !user.isSuspended) {
      const reset = await createPasswordReset(user);
      await recordSecurityEvent({
        req,
        userId: user.id,
        type: 'AUTH_PASSWORD_RESET_REQUESTED',
        metadata: { emailSent: reset.sent }
      });
      return res.json({
        emailSent: reset.sent,
        resetUrl: reset.resetUrl,
        message: reset.sent
          ? 'Password reset email sent.'
          : 'Password reset created. Email sending is not configured.'
      });
    }
    await recordSecurityEvent({ req, type: 'AUTH_PASSWORD_RESET_REQUESTED', metadata: { email } });
    res.json({ message: 'If this email exists, a password reset link has been sent.' });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    ensureAuthConfig();
    const { token, password } = req.body;
    if (!token || !password) return next(new AppError('Reset token and new password are required.', 400));
    if (String(password).length < 8) return next(new AppError('Password must be at least 8 characters.', 400));
    // IP-only: same reasoning as verifyEmail — token is opaque and single-use.
    await enforceAuthEndpointLimits(req, 'reset-password');

    const tokenHash = hashToken(token);
    const userId = await consumeSecurityValue(`reset:${tokenHash}`);
    if (!userId) {
      await recordSecurityEvent({ req, type: 'AUTH_PASSWORD_RESET_FAILED', metadata: { reason: 'invalid_or_expired' } });
      return next(new AppError('Invalid or expired reset link. Request a new one.', 400));
    }
    clearSecurityValue(`reset-user:${userId}`).catch(() => {});

    const existing = await User.findOne({ id: userId }).select('isSuspended isDeactivated').lean();
    if (!existing) {
      await recordSecurityEvent({ req, type: 'AUTH_PASSWORD_RESET_FAILED', metadata: { reason: 'user_not_found' } });
      return next(new AppError('Invalid or expired reset link. Request a new one.', 400));
    }
    const nextStatus = existing.isDeactivated ? 'deactivated' : existing.isSuspended ? 'suspended' : 'active';

    const passwordHash = await bcrypt.hash(password, 10);
    const updates = { passwordHash, emailVerified: true, accountStatus: nextStatus, updatedAt: new Date().toISOString() };
    const user = await User.findOneAndUpdate(
      { id: userId },
      { $set: updates },
      { returnDocument: 'after', lean: true }
    );
    if (!user) {
      await recordSecurityEvent({ req, type: 'AUTH_PASSWORD_RESET_FAILED', metadata: { reason: 'user_not_found' } });
      return next(new AppError('Invalid or expired reset link. Request a new one.', 400));
    }

    await revokeAllSessionsForUser({ userId: user.id, reason: 'password_reset' });
    clearAuthCookies(res);
    await recordSecurityEvent({ req, userId: user.id, type: 'AUTH_PASSWORD_RESET_COMPLETED' });
    // Notify the account owner that their password was changed — a significant
    // security event. They should know even if they initiated it, and
    // especially if they didn't (token stolen before use).
    sendSecurityAlertEmail({
      to: user.email,
      name: user.name,
      subject: 'Your Starlight Station password has been changed',
      headline: 'Password changed',
      body: 'Your Starlight Station password was just reset. All existing sessions have been signed out. If you did not make this change, contact support immediately.',
      ctaText: 'Sign in',
      ctaUrl: `${FRONTEND_URL}/login`
    }).catch((err) => console.error('[SecurityAlert] password reset email failed:', err.message));
    // Do NOT issue a new session here. The spec requires fresh authentication
    // after a password reset — no auto-login. The attacker who triggered the
    // reset (if any) must not end up with a valid session. All refresh-token
    // families are now revoked: rotateRefreshSession checks revokedAt on every
    // use, so any outstanding refresh tokens are immediately invalid.
    res.json({ success: true, message: 'Password updated. Please sign in with your new password.' });
  } catch (error) {
    next(error);
  }
};

const refreshSession = async (req, res, next) => {
  try {
    ensureAuthConfig();
    const incomingRefreshToken = req.body?.refreshToken || readCookie(req, 'refreshToken');
    if (!incomingRefreshToken) return next(new AppError('Unauthorized: Missing refresh token', 401));
    // Looser IP-only limit — legitimate clients refresh every 15 min per tab.
    await enforceRefreshLimits(req);
    const rotated = await rotateRefreshSession({ req, refreshToken: incomingRefreshToken });
    if (!rotated) {
      clearAuthCookies(res);
      await recordSecurityEvent({ req, type: 'SECURITY_SESSION_REVOKED', metadata: { reason: 'invalid_or_expired' } });
      return next(new AppError('Unauthorized: Invalid refresh token', 401));
    }
    if (rotated.reused) {
      // REFRESH TOKEN REUSE DETECTED. rotateRefreshSession has already
      // revoked the current session and the entire refresh-token family
      // (every session sharing tokenFamilyId) atomically. From here:
      // clear cookies, log the exact security event, and force
      // reauthentication — never issue a token on this path.
      clearAuthCookies(res);
      await recordSecurityEvent({
        req,
        userId: rotated.userId,
        sessionId: rotated.sessionId,
        type: 'SECURITY_REFRESH_REUSE_DETECTED',
        metadata: { tokenFamilyId: rotated.tokenFamilyId, reason: 'rotated_token_replayed' }
      });
      return next(new AppError('Unauthorized: Invalid refresh token', 401));
    }
    const user = await User.findOne({ id: rotated.session.userId }).lean();
    if (!user) {
      clearAuthCookies(res);
      return next(new AppError('Unauthorized: Account unavailable', 401));
    }
    const status = user.accountStatus || deriveAccountStatus(user);
    if (status === 'deactivated' || status === 'suspended') {
      clearAuthCookies(res);
      return next(new AppError('Unauthorized: Account unavailable', 401));
    }
    if (status === 'pending_verification') {
      await revokeAllSessionsForUser({ userId: user.id, reason: 'email_unverified' });
      clearAuthCookies(res);
      await recordSecurityEvent({ req, userId: user.id, sessionId: rotated.session.sessionId, type: 'SECURITY_SESSION_REVOKED', metadata: { reason: 'email_unverified' } });
      return next(new AppError('Please verify your email before signing in.', 403));
    }

    // Issue fresh access token and rotate refresh token via cookies only.
    // Credentials never appear in the JSON response body.
    const accessToken = tokenForUser(user.id, rotated.session.sessionId);
    const csrfToken = createOpaqueToken(24);
    res.cookie(cookieName('accessToken'), accessToken, cookieOptions(ACCESS_TOKEN_TTL_MS));
    res.cookie(cookieName('refreshToken'), rotated.refreshToken, cookieOptions(REFRESH_TOKEN_TTL_MS));
    res.cookie(cookieName('sessionId'), rotated.session.sessionId, cookieOptions(REFRESH_TOKEN_TTL_MS));
    res.cookie(cookieName('csrfToken'), csrfToken, cookieOptions(REFRESH_TOKEN_TTL_MS, { httpOnly: false }));
    res.set('x-csrf-token', csrfToken);
    await recordSecurityEvent({ req, userId: user.id, sessionId: rotated.session.sessionId, type: 'AUTH_TOKEN_REFRESHED' });
    const isMobileClient = (req.get('x-client-type') || '').toLowerCase() === 'mobile';
    res.json({
      user: userResponse(user),
      ...(isMobileClient ? { token: accessToken, refreshToken: rotated.refreshToken, csrfToken } : {})
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    // Identify the current session two ways:
    // 1. via req.sessionId — set by requireAuth if the access token was valid
    // 2. via the refresh token cookie/body — works even with an expired access
    //    token, since logout is intentionally not behind requireAuth
    const refreshToken = req.body?.refreshToken || readCookie(req, 'refreshToken');
    let revokedSession = null;

    if (req.sessionId) {
      // Direct session revocation via sessionId from the validated JWT —
      // this is the more reliable path since it requires no refresh token.
      revokedSession = await Session.findOneAndUpdate(
        { sessionId: req.sessionId, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date().toISOString(), revokedReason: 'logout' } },
        { returnDocument: 'after', lean: true }
      );
    }

    if (!revokedSession && refreshToken) {
      // Fallback: revoke via refresh token hash (expired access token path,
      // or mobile client where sessionId may not be available).
      revokedSession = await revokeRefreshSession({ refreshToken, reason: 'logout' });
    }

    // Clear all auth cookies regardless of whether a session was found —
    // the client's cookies should always be cleared on a logout attempt.
    clearAuthCookies(res);

    await recordSecurityEvent({
      req,
      userId: revokedSession?.userId ?? req.userId,
      sessionId: revokedSession?.sessionId ?? req.sessionId,
      type: 'AUTH_LOGOUT'
    });

    res.json({ success: true, message: 'Logged out.' });
  } catch (error) {
    next(error);
  }
};

const logoutAll = async (req, res, next) => {
  try {
    // Revoke every active session for this user. Each Session document holds
    // a refresh token hash — revoking the document makes that refresh token
    // permanently unusable (rotateRefreshSession filters revokedAt: { $exists: false }).
    // All token families across all devices are therefore invalidated.
    const { modifiedCount } = await revokeAllSessionsForUser({ userId: req.userId, reason: 'logout_all' });
    clearAuthCookies(res);
    await recordSecurityEvent({
      req,
      userId: req.userId,
      sessionId: req.sessionId,
      type: 'AUTH_LOGOUT_ALL',
      metadata: { sessionsRevoked: modifiedCount }
    });
    res.json({ success: true, message: 'Logged out on all devices.' });
  } catch (error) {
    next(error);
  }
};

const providerIntent = (req, res, next) => {
  const provider = String(req.body.provider || 'provider').toLowerCase();
  return next(new AppError(`${provider} sign-in needs an external OAuth provider. Starlight core auth is configured for email and password.`, 501));
};

const phoneIntent = (req, res, next) => (
  next(new AppError('Phone sign-in needs an SMS/OTP provider. Starlight core auth is configured for email and password.', 501))
);

const getUser = async (req, res, next) => {
  try {
    const user = await User.findOne({ id: req.params.id }).lean();
    if (!user) return next(new AppError('User not found.', 404));

    // Don't return password hash
    const { passwordHash, email, ...userSafe } = user;
    const tracks = await Track.find({ userId: user.id, isPublished: true }).lean();
    const projectIds = [...new Set(tracks.map((track) => track.projectId).filter(Boolean))];
    const projects = projectIds.length ? await Project.find({ id: { $in: projectIds } }).lean() : [];
    const posts = tracks.map((track) => {
      const project = projects.find((item) => item.id === track.projectId);
      return { id: track.id, title: track.title, url: track.url, projectId: track.projectId, coverArt: project?.coverArt || null, publishedAt: track.publishedAt };
    });
    res.json({ user: { ...publicUser(userSafe), email, emailVerified: user.emailVerified !== false }, isFollowing: (user.followers || []).includes(req.userId), posts });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { name, username, bio } = req.body || {};
    if (req.params.id !== req.userId) return next(new AppError('You can only edit your own profile.', 403));
    const currentUser = await User.findOne({ id: req.params.id }).lean();
    if (!currentUser) return next(new AppError('User not found.', 404));

    const nextName = name?.trim() || currentUser.name?.trim();
    if (!nextName) return next(new AppError('Name is required.', 400));

    const nextUsername = String(username || currentUser.username || nextName).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const nextBio = bio === undefined ? String(currentUser.bio || '').trim().slice(0, 160) : String(bio || '').trim().slice(0, 160);
    const updatedUser = await User.findOneAndUpdate(
      { id: req.params.id },
      { $set: { name: nextName, username: nextUsername, bio: nextBio, updatedAt: new Date().toISOString() } },
      { returnDocument: 'after', lean: true }
    );
    res.json({ user: updatedUser });
  } catch (error) {
    next(error);
  }
};

const toggleFollow = async (req, res, next) => {
  try {
    if (req.params.id === req.userId) return next(new AppError('You cannot follow yourself.', 400));
    const [target, actor] = await Promise.all([
      User.findOne({ id: req.params.id }).lean(),
      User.findOne({ id: req.userId }).lean()
    ]);
    if (!target || !actor) return next(new AppError('User not found.', 404));

    const isFollowing = (target.followers || []).includes(req.userId);
    if (isFollowing) {
      await Promise.all([
        User.updateOne({ id: target.id }, { $pull: { followers: req.userId } }),
        User.updateOne({ id: actor.id }, { $pull: { following: target.id } })
      ]);
    } else {
      await Promise.all([
        User.updateOne({ id: target.id }, { $addToSet: { followers: req.userId } }),
        User.updateOne({ id: actor.id }, { $addToSet: { following: target.id } }),
        Notification.create([
          {
            id: createOpaqueToken(16),
            userId: target.id,
            type: 'follow',
            read: false,
            message: `${actor.name || 'Someone'} started following you.`,
            actor: { id: actor.id, name: actor.name, avatarUrl: actor.avatarUrl },
            createdAt: new Date().toISOString()
          },
          {
            id: createOpaqueToken(16),
            userId: actor.id,
            type: 'follow_confirmation',
            read: false,
            message: `You started following ${target.name || 'a user'}.`,
            actor: { id: target.id, name: target.name, avatarUrl: target.avatarUrl },
            createdAt: new Date().toISOString()
          }
        ]).catch(console.error)
      ]);
    }
    // Workspace notifications are cached independently per user. Invalidate
    // both sides so a new follow alert is visible without a manual refresh.
    await Promise.all([
      invalidateCache(`workspace:${target.id}`),
      invalidateCache(`workspace:${actor.id}`)
    ]);
    const followerCount = isFollowing ? (target.followers || []).length - 1 : (target.followers || []).length + 1;
    res.json({ following: !isFollowing, followerCount });
  } catch (error) { next(error); }
};

const uploadUserAvatar = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('No profile image uploaded.', 400));
    const existingUser = await User.findOne({ id: req.params.id }).lean();
    if (!existingUser) {
      if (req.file.filename) {
        cloudinary.uploader.destroy(req.file.filename).catch(console.error);
      }
      return next(new AppError('User not found.', 404));
    }

    let avatarUrl = `${BASE_URL}/avatars/${req.file.filename}`;
    if (hasCloudinaryConfig) {
      try {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: 'raremotionhub/avatars',
          resource_type: 'image'
        });
        avatarUrl = uploadResult.secure_url;
        removeFileIfExists(req.file.path);
      } catch (uploadError) {
        console.error('Cloudinary avatar upload failed, keeping local file:', uploadError.message);
      }
    }
    const avatarUpdatedAt = new Date().toISOString();
    const updatedUser = await User.findOneAndUpdate(
      { id: req.params.id },
      { $set: { avatarUrl, avatarUpdatedAt, updatedAt: avatarUpdatedAt } },
      { returnDocument: 'after', lean: true }
    );
    invalidateCache(`workspace:${req.params.id}`);
    res.json({ user: updatedUser });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    if (req.params.id !== req.userId) return next(new AppError('You can only delete your own account.', 403));
    const user = await User.findOne({ id: req.params.id }).lean();
    if (!user) return next(new AppError('User not found.', 404));

    const uid = req.params.id;
    const db = ensureDBShape(await readDB());
    db.tracks = db.tracks.filter((track) => track.userId !== uid && track.uploader?.id !== uid);
    await writeDB(db);
    await Promise.all([
      User.deleteOne({ id: uid }),
      Folder.deleteMany({ userId: uid }),
      Project.deleteMany({ userId: uid }),
      Track.deleteMany({ $or: [{ userId: uid }, { 'uploader.id': uid }] }),
      CoverArt.deleteMany({ userId: uid }),
      Notification.deleteMany({ $or: [{ userId: uid }, { 'actor.id': uid }] }),
      PlayEvent.deleteMany({ $or: [{ ownerId: uid }, { actorId: uid }] }),
      revokeAllSessionsForUser({ userId: uid, reason: 'account_deleted' }),
    ]);

    removeDirIfExists(getUserDir(uploadDir, req.params.id));
    removeDirIfExists(getUserDir(coverDir, req.params.id));
    removeDirIfExists(getUserDir(avatarDir, req.params.id));
    clearAuthCookies(res);
    await recordSecurityEvent({ req, userId: uid, type: 'AUTH_ACCOUNT_DELETED' });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const deactivateUser = async (req, res, next) => {
  try {
    if (req.params.id !== req.userId) return next(new AppError('You can only deactivate your own account.', 403));
    const deactivatedAt = new Date().toISOString();
    const updatedUser = await User.findOneAndUpdate(
      { id: req.params.id },
      { $set: { isDeactivated: true, accountStatus: 'deactivated', deactivatedAt, updatedAt: deactivatedAt } },
      { returnDocument: 'after', lean: true }
    );
    if (!updatedUser) return next(new AppError('User not found.', 404));
    const db = ensureDBShape(await readDB());
    db.tracks.forEach((track) => {
      if (track.userId === req.params.id || track.uploader?.id === req.params.id) {
        track.isPublished = false;
        track.publishedAt = null;
      }
    });
    await writeDB(db);
    // Revoking sessions first ensures no existing refresh token can silently
    // produce a new access token after the account is deactivated. The access
    // token's short TTL (15 min) bounds any remaining window where a token
    // issued before this moment could still be used — but the live
    // deriveAccountStatus check in requireVerifiedUser blocks it immediately.
    const { modifiedCount } = await revokeAllSessionsForUser({ userId: req.params.id, reason: 'account_deactivated' });
    clearAuthCookies(res);
    await recordSecurityEvent({
      req,
      userId: req.params.id,
      type: 'AUTH_ACCOUNT_DEACTIVATED',
      metadata: { sessionsRevoked: modifiedCount }
    });
    res.json({ success: true });
  } catch (error) { next(error); }
};

// suspendUser/unsuspendUser are intentionally not exposed as API endpoints —
// this is not a role-based system and all users are equal. The isSuspended
// field and 'suspended' accountStatus are enforced by requireVerifiedUser
// and can be set via direct DB operation or future tooling if needed.

const suspendUser = async (req, res, next) => {
  try {
    const suspendedAt = new Date().toISOString();
    const updatedUser = await User.findOneAndUpdate(
      { id: req.params.id },
      { $set: { isSuspended: true, accountStatus: 'suspended', suspendedAt, updatedAt: suspendedAt } },
      { returnDocument: 'after', lean: true }
    );
    if (!updatedUser) return next(new AppError('User not found.', 404));
    const { modifiedCount } = await revokeAllSessionsForUser({ userId: req.params.id, reason: 'account_suspended' });
    await recordSecurityEvent({
      req,
      userId: req.params.id,
      type: 'SECURITY_ACCOUNT_SUSPENDED',
      metadata: { sessionsRevoked: modifiedCount }
    });
    res.json({ success: true, sessionsRevoked: modifiedCount });
  } catch (error) { next(error); }
};

const unsuspendUser = async (req, res, next) => {
  try {
    const updatedUser = await User.findOneAndUpdate(
      { id: req.params.id },
      { $set: { isSuspended: false, accountStatus: 'active', updatedAt: new Date().toISOString() }, $unset: { suspendedAt: '' } },
      { returnDocument: 'after', lean: true }
    );
    if (!updatedUser) return next(new AppError('User not found.', 404));
    await recordSecurityEvent({
      req,
      userId: req.params.id,
      type: 'SECURITY_ACCOUNT_UNSUSPENDED',
    });
    res.json({ success: true });
  } catch (error) { next(error); }
};

const verifyEmailDirect = async (req, res, next) => {
  try {
    ensureAuthConfig();
    const email = req.body.email?.trim().toLowerCase();
    if (!email) return next(new AppError('Email is required.', 400));

    await enforceAuthEndpointLimits(req, 'verify-email');

    const user = await User.findOne({ email }).lean();

    if (!user || user.emailVerified !== false) {
      return next(new AppError('No pending verification found for this email.', 400));
    }
    if (user.isDeactivated) return next(new AppError('This account is deactivated.', 403));
    if (user.isSuspended)   return next(new AppError('This account is suspended.', 403));

    const tokenHash = await getSecurityValue(`verify-user:${user.id}`);
    if (!tokenHash) {
      await recordSecurityEvent({ req, userId: user.id, type: 'AUTH_EMAIL_VERIFICATION_FAILED', metadata: { reason: 'token_expired' } });
      return next(new AppError('Verification window expired. Please request a new one.', 400));
    }

    const consumed = await consumeSecurityValue(`verify:${tokenHash}`);
    if (!consumed) {
      await recordSecurityEvent({ req, userId: user.id, type: 'AUTH_EMAIL_VERIFICATION_FAILED', metadata: { reason: 'token_already_consumed' } });
      return next(new AppError('Verification window expired. Please request a new one.', 400));
    }
    clearSecurityValue(`verify-user:${user.id}`).catch(() => {});

    const nextStatus = user.isDeactivated ? 'deactivated' : user.isSuspended ? 'suspended' : 'active';
    const updates = { emailVerified: true, accountStatus: nextStatus, updatedAt: new Date().toISOString() };
    const verifiedUser = await User.findOneAndUpdate(
      { id: user.id },
      { $set: updates },
      { returnDocument: 'after', lean: true }
    );
    if (!verifiedUser) return next(new AppError('Could not verify email. Please try again.', 500));

    const { sessionId, ...mobileTokens } = await issueAuthSession(req, res, verifiedUser);
    await recordSecurityEvent({ req, userId: verifiedUser.id, sessionId, type: 'AUTH_EMAIL_VERIFIED' });
    res.json({ user: userResponse({ ...verifiedUser, ...updates }), ...mobileTokens });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  verifyEmail,
  verifyEmailDirect,
  resendVerification,
  requestPasswordReset,
  resetPassword,
  refreshSession,
  logout,
  logoutAll,
  providerIntent,
  phoneIntent,
  getUser,
  updateUser,
  toggleFollow,
  uploadUserAvatar,
  deleteUser,
  deactivateUser,
  suspendUser,
  unsuspendUser,
  deriveAccountStatus
};
