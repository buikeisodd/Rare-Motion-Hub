const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { User, Folder, Project, Track, CoverArt, Notification, PlayEvent } = require('../models');
const { removeDirIfExists, removeFileIfExists, getUserDir, uploadDir, coverDir, avatarDir } = require('../utils/fileHelper');
const { cloudinary, hasCloudinaryConfig } = require('../config/cloudinary');
const { invalidateCache } = require('../config/redis');
const { AppError } = require('../middlewares/error.middleware');
const { BASE_URL, publicUser } = require('../utils/helpers');
const { hasSmtpConfig, sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');
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
  ensureLoginNotLocked,
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

// Cookie names use the __Host- prefix in production which enforces:
// - Secure attribute (HTTPS only)
// - No Domain attribute (bound to the exact host, not subdomains)
// - Path must be "/"
// This prevents a compromised subdomain from setting/overwriting these cookies.
// In development (http://localhost) the __Host- prefix is not valid, so we
// fall back to plain names.
const IS_PROD = process.env.NODE_ENV === 'production';
const cookieName = (name) => IS_PROD ? `__Host-${name}` : name;

const cookieOptions = (maxAge, overrides = {}) => ({
  httpOnly: true,
  secure: IS_PROD,
  sameSite: IS_PROD ? 'strict' : 'lax',
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
  const prefixed = IS_PROD ? `__Host-${name}` : name;
  const match = cookieHeader
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${prefixed}=`));
  if (!match) return '';
  return decodeURIComponent(match.slice(prefixed.length + 1));
};

const issueAuthSession = async (req, res, user) => {
  if (!user || user.emailVerified === false) {
    throw new AppError('Please verify your email before signing in.', 403);
  }
  const { session, refreshToken } = await createRefreshSession({ req, userId: user.id });
  const csrfToken = createOpaqueToken(24);
  const accessToken = tokenForUser(user.id, session.sessionId);

  // All three authentication credentials are set as HttpOnly cookies only
  // for web browser clients. They must not appear in JSON response bodies
  // for web — the frontend reads user state from the JSON payload only.
  res.cookie(cookieName('accessToken'), accessToken, cookieOptions(ACCESS_TOKEN_TTL_MS));
  res.cookie(cookieName('refreshToken'), refreshToken, cookieOptions(REFRESH_TOKEN_TTL_MS));
  res.cookie(cookieName('sessionId'), session.sessionId, cookieOptions(REFRESH_TOKEN_TTL_MS));
  // csrfToken intentionally not HttpOnly — JS reads it and sends it as a
  // request header so the server can verify the double-submit pattern.
  res.cookie(cookieName('csrfToken'), csrfToken, cookieOptions(REFRESH_TOKEN_TTL_MS, { httpOnly: false }));

  // Mobile clients (React Native) cannot use HttpOnly cookies — the platform
  // doesn't expose a browser cookie jar to native code. Detect via the
  // X-Client-Type header (sent by the Expo app) and include the tokens in
  // the JSON response body for mobile only, where they are stored in
  // expo-secure-store (encrypted, sandboxed, not accessible to other apps).
  const isMobileClient = (req.get('x-client-type') || '').toLowerCase() === 'mobile';

  return {
    sessionId: session.sessionId,
    ...(isMobileClient ? { token: accessToken, refreshToken, csrfToken } : {})
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
    await enforceActionLimit(req, 'register', `${clientSubject(req)}:${securitySubject(email)}`, 3, AUTH_ACTION_WINDOW_SECONDS);
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
      type: 'register_requires_email_verification',
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

    // 5. Rate-limit state — generic sliding-window throttle on login attempts,
    // distinct from the account-lockout mechanism below.
    await enforceActionLimit(req, 'login', securitySubject(email));
    // 4. Lockout state — this account specifically locked after repeated failures.
    await ensureLoginNotLocked(req, email);

    // 1. Credentials — existence + password must both check out before
    // anything about the account is revealed, so a wrong password and a
    // deactivated/suspended account return the same generic error.
    const user = await User.findOne({ email }).lean();
    if (!user || !user.passwordHash) {
      await noteLoginFailure(req, email);
      await recordSecurityEvent({ req, type: 'login_failed', metadata: { email, reason: 'invalid_credentials' } });
      return next(new AppError('Invalid email or password.', 401));
    }
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      await noteLoginFailure(req, email);
      await recordSecurityEvent({ req, userId: user.id, type: 'login_failed', metadata: { reason: 'invalid_credentials' } });
      return next(new AppError('Invalid email or password.', 401));
    }

    // 2. Account state — deactivated/suspended, checked only once credentials
    // are already proven valid.
    if (user.isDeactivated) {
      await recordSecurityEvent({ req, userId: user.id, type: 'login_blocked', metadata: { reason: 'deactivated' } });
      return next(new AppError('This account is deactivated.', 403));
    }
    if (user.isSuspended) {
      await recordSecurityEvent({ req, userId: user.id, type: 'login_blocked', metadata: { reason: 'suspended' } });
      return next(new AppError('This account is suspended.', 403));
    }

    // 3. Email verification state — credentials are correct and the account
    // is otherwise in good standing, but verification is still required.
    // No session, cookies, or tokens are issued past this point.
    if (!user.emailVerified) {
      await recordSecurityEvent({ req, userId: user.id, type: 'login_blocked', metadata: { reason: 'email_unverified' } });
      return res.status(403).json({
        success: false,
        requiresEmailVerification: true
      });
    }

    const { sessionId, ...mobileTokens } = await issueAuthSession(req, res, user);
    await noteLoginSuccess(email);
    await recordSecurityEvent({ req, userId: user.id, sessionId, type: 'login_success' });
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
    const tokenHash = hashToken(token);

    // Atomically read-and-delete the token in one step. If two requests race
    // on the same token, only one GETDEL call returns the userId — the other
    // gets null, so it can never successfully verify using the same token.
    const userId = await consumeSecurityValue(`verify:${tokenHash}`);
    if (!userId) {
      await recordSecurityEvent({ req, type: 'email_verification_failed', metadata: { reason: 'invalid_or_expired' } });
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
      await recordSecurityEvent({ req, type: 'email_verification_failed', metadata: { reason: 'user_not_found' } });
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
      await recordSecurityEvent({ req, type: 'email_verification_failed', metadata: { reason: 'user_not_found' } });
      return next(new AppError('Invalid or expired verification link. Request a new one.', 400));
    }

    const { sessionId, ...mobileTokens } = await issueAuthSession(req, res, user);
    await recordSecurityEvent({ req, userId: user.id, sessionId, type: 'email_verified' });
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
    await enforceActionLimit(req, 'resend-verification', securitySubject(email));
    const user = await User.findOne({ email }).lean();
    if (!user) return next(new AppError('Account not found.', 404));
    if (user.emailVerified !== false) return res.json({ message: 'Email is already verified.' });
    const verification = await createEmailVerification(user);
    await recordSecurityEvent({
      req,
      userId: user.id,
      type: 'email_verification_resent',
      metadata: { emailSent: verification.sent }
    });
    res.json({
      email,
      emailSent: verification.sent,
      expiresAt: verification.expiresAt,
      verificationUrl: verification.verificationUrl,
      message: verification.sent ? 'Verification email sent.' : 'Email sending is not configured.'
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
    await enforceActionLimit(req, 'password-reset-request', securitySubject(email));
    const user = await User.findOne({ email }).lean();
    if (user && user.passwordHash && !user.isDeactivated && !user.isSuspended) {
      const reset = await createPasswordReset(user);
      await recordSecurityEvent({
        req,
        userId: user.id,
        type: 'password_reset_requested',
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
    await recordSecurityEvent({ req, type: 'password_reset_requested_unknown', metadata: { email } });
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

    const tokenHash = hashToken(token);
    const userId = await consumeSecurityValue(`reset:${tokenHash}`);
    if (!userId) {
      await recordSecurityEvent({ req, type: 'password_reset_failed', metadata: { reason: 'invalid_or_expired' } });
      return next(new AppError('Invalid or expired reset link. Request a new one.', 400));
    }
    clearSecurityValue(`reset-user:${userId}`).catch(() => {});

    const existing = await User.findOne({ id: userId }).select('isSuspended isDeactivated').lean();
    if (!existing) {
      await recordSecurityEvent({ req, type: 'password_reset_failed', metadata: { reason: 'user_not_found' } });
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
      await recordSecurityEvent({ req, type: 'password_reset_failed', metadata: { reason: 'user_not_found' } });
      return next(new AppError('Invalid or expired reset link. Request a new one.', 400));
    }

    await revokeAllSessionsForUser({ userId: user.id, reason: 'password_reset' });
    const { sessionId, ...mobileTokens } = await issueAuthSession(req, res, user);
    await recordSecurityEvent({ req, userId: user.id, sessionId, type: 'password_reset_completed' });
    const nextUser = { ...user, ...updates };
    res.json({ user: userResponse(nextUser), ...mobileTokens });
  } catch (error) {
    next(error);
  }
};

const refreshSession = async (req, res, next) => {
  try {
    ensureAuthConfig();
    const incomingRefreshToken = req.body?.refreshToken || readCookie(req, 'refreshToken');
    if (!incomingRefreshToken) return next(new AppError('Unauthorized: Missing refresh token', 401));
    const rotated = await rotateRefreshSession({ req, refreshToken: incomingRefreshToken });
    if (!rotated) {
      clearAuthCookies(res);
      await recordSecurityEvent({ req, type: 'refresh_failed', metadata: { reason: 'invalid_or_expired' } });
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
      await recordSecurityEvent({ req, userId: user.id, sessionId: rotated.session.sessionId, type: 'refresh_blocked', metadata: { reason: 'email_unverified' } });
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
    await recordSecurityEvent({ req, userId: user.id, sessionId: rotated.session.sessionId, type: 'session_refreshed' });
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
    const refreshToken = req.body?.refreshToken || readCookie(req, 'refreshToken');
    const session = await revokeRefreshSession({ refreshToken, reason: 'logout' });
    clearAuthCookies(res);
    await recordSecurityEvent({ req, userId: session?.userId, sessionId: session?.sessionId, type: 'logout' });
    res.json({ message: 'Logged out.' });
  } catch (error) {
    next(error);
  }
};

const logoutAll = async (req, res, next) => {
  try {
    await revokeAllSessionsForUser({ userId: req.userId, reason: 'logout_all' });
    clearAuthCookies(res);
    await recordSecurityEvent({ req, userId: req.userId, sessionId: req.sessionId, type: 'logout_all' });
    res.json({ message: 'Logged out on all devices.' });
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
        User.updateOne({ id: actor.id }, { $addToSet: { following: target.id } })
      ]);
    }
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
    await recordSecurityEvent({ req, userId: uid, type: 'account_deleted' });
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
    await revokeAllSessionsForUser({ userId: req.params.id, reason: 'account_deactivated' });
    clearAuthCookies(res);
    await recordSecurityEvent({ req, userId: req.params.id, type: 'account_deactivated' });
    res.json({ success: true });
  } catch (error) { next(error); }
};

module.exports = {
  register,
  login,
  verifyEmail,
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
  deriveAccountStatus
};
