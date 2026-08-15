const crypto = require('crypto');
const { SecurityEvent, Session } = require('../models');
const { getRedisClient } = require('../config/redis');

const createOpaqueToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
const hashOpaqueToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const safeTokenEqual = (left, right) => {
  if (!left || !right) return false;
  const a = Buffer.from(String(left), 'utf8');
  const b = Buffer.from(String(right), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Lightweight, dependency-free device summary parsed from the User-Agent
// string — enough for a session-management UI to show "Chrome on macOS" /
// "Starlight Station iOS app" without pulling in a full UA-parsing library
// for what's explicitly a "where appropriate" nice-to-have field.
const parseDeviceMetadata = (userAgent) => {
  if (!userAgent) return null;
  const ua = userAgent;
  let platform = 'unknown';
  if (/iPhone|iPad|iPod/i.test(ua)) platform = 'ios';
  else if (/Android/i.test(ua)) platform = 'android';
  else if (/Macintosh|Mac OS X/i.test(ua)) platform = 'macos';
  else if (/Windows/i.test(ua)) platform = 'windows';
  else if (/Linux/i.test(ua)) platform = 'linux';

  let browser = 'unknown';
  if (/Expo|okhttp|StarlightStation/i.test(ua)) browser = 'app';
  else if (/Edg\//i.test(ua)) browser = 'edge';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'chrome';
  else if (/Firefox\//i.test(ua)) browser = 'firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'safari';

  return { platform, browser };
};

const requestContext = (req) => {
  const userAgent = req.get?.('user-agent') || req.headers?.['user-agent'] || '';
  return {
    ipAddress: req.ip || req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || '',
    userAgent,
    device: parseDeviceMetadata(userAgent)
  };
};

// ── Security event taxonomy ───────────────────────────────────────────────────
// All event type constants with their categories. Call sites must use these
// constants — not raw strings — so typos are caught at startup/test time.
// Metadata must NEVER include: passwords, raw access tokens, raw refresh tokens,
// verification tokens, or reset tokens.
const SECURITY_EVENTS = {
  // AUTH — normal authentication lifecycle events
  AUTH_REGISTERED:                    'AUTH',
  AUTH_LOGIN_SUCCESS:                 'AUTH',
  AUTH_LOGIN_FAILED:                  'AUTH',
  AUTH_LOGOUT:                        'AUTH',
  AUTH_LOGOUT_ALL:                    'AUTH',
  AUTH_EMAIL_VERIFICATION_SENT:       'AUTH',
  AUTH_EMAIL_VERIFIED:                'AUTH',
  AUTH_EMAIL_VERIFICATION_FAILED:     'AUTH',
  AUTH_PASSWORD_RESET_REQUESTED:      'AUTH',
  AUTH_PASSWORD_RESET_COMPLETED:      'AUTH',
  AUTH_PASSWORD_RESET_FAILED:         'AUTH',
  AUTH_TOKEN_REFRESHED:               'AUTH',
  AUTH_ACCOUNT_DEACTIVATED:           'AUTH',
  AUTH_ACCOUNT_DELETED:               'AUTH',

  // SECURITY — anomalies, policy violations, elevated-risk events
  SECURITY_ACCOUNT_LOCKED:           'SECURITY',
  SECURITY_REFRESH_REUSE_DETECTED:   'SECURITY',
  SECURITY_SESSION_REVOKED:          'SECURITY',
  SECURITY_RATE_LIMITED:             'SECURITY',
  SECURITY_SUSPICIOUS_LOGIN:         'SECURITY',
  SECURITY_ACCOUNT_SUSPENDED:        'SECURITY',
  SECURITY_ACCOUNT_UNSUSPENDED:      'SECURITY',

  // SYSTEM — infrastructure/operational events
  SYSTEM_ERROR:         'SYSTEM',
  SYSTEM_EMAIL_FAILED:  'SYSTEM',
  SYSTEM_UPLOAD_FAILED: 'SYSTEM',
};

// Derive the category from the type constant — callers never specify it manually.
const categoryForType = (type) => SECURITY_EVENTS[type] || 'SYSTEM';

const recordSecurityEvent = async ({ req, userId, sessionId, type, metadata = {} }) => {
  if (!type) return;
  if (!SECURITY_EVENTS[type]) {
    console.warn(`[SecurityEvent] Unknown event type: ${type} — logging as SYSTEM_ERROR`);
  }
  try {
    const context = req ? requestContext(req) : {};
    await SecurityEvent.create({
      eventId:   `${Date.now().toString(36)}${crypto.randomBytes(8).toString('hex')}`,
      userId,
      sessionId,
      category:  categoryForType(type),
      type,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[SecurityEvent] Write failed:', error.message);
  }
};

const REFRESH_TOKEN_TTL_MS = Number(process.env.REFRESH_TOKEN_TTL_MS || 1000 * 60 * 60 * 24 * 30);
const localRateStore = new Map();

const redisKey = (key) => `security:${key}`;

const incrementWindowCounter = async (key, ttlSeconds) => {
  const client = getRedisClient();
  const namespacedKey = redisKey(key);
  if (client && client.isReady) {
    const count = await client.incr(namespacedKey);
    if (count === 1) await client.expire(namespacedKey, ttlSeconds);
    const ttl = await client.ttl(namespacedKey);
    return { count, ttl: ttl > 0 ? ttl : ttlSeconds };
  }

  const now = Date.now();
  const current = localRateStore.get(namespacedKey);
  if (!current || current.expiresAt <= now) {
    localRateStore.set(namespacedKey, { count: 1, expiresAt: now + ttlSeconds * 1000 });
    return { count: 1, ttl: ttlSeconds };
  }
  current.count += 1;
  return { count: current.count, ttl: Math.ceil((current.expiresAt - now) / 1000) };
};

const getSecurityValue = async (key) => {
  const client = getRedisClient();
  const namespacedKey = redisKey(key);
  if (client && client.isReady) return client.get(namespacedKey);
  const current = localRateStore.get(namespacedKey);
  if (!current || current.expiresAt <= Date.now()) {
    localRateStore.delete(namespacedKey);
    return null;
  }
  return current.value ?? String(current.count ?? '');
};

const setSecurityValue = async (key, value, ttlSeconds) => {
  const client = getRedisClient();
  const namespacedKey = redisKey(key);
  if (client && client.isReady) {
    await client.setEx(namespacedKey, ttlSeconds, String(value));
    return;
  }
  localRateStore.set(namespacedKey, { value: String(value), expiresAt: Date.now() + ttlSeconds * 1000 });
};

const clearSecurityValue = async (key) => {
  const client = getRedisClient();
  const namespacedKey = redisKey(key);
  if (client && client.isReady) {
    await client.del(namespacedKey);
    return;
  }
  localRateStore.delete(namespacedKey);
};

// Atomically read-and-delete a value so that concurrent callers racing on the
// same key cannot both "consume" it. Used for single-use tokens (email
// verification, password reset) where reuse after consumption must be
// impossible even under concurrent requests.
//
// Real Redis: GETDEL is a single atomic command on the server — Redis
// processes commands serially, so of two concurrent GETDEL calls for the
// same key, exactly one returns the value and the other returns null.
//
// In-memory fallback: the read + delete happen synchronously with no
// `await` between them, so no other request handler can interleave inside
// this function body (Node only yields the event loop at an await point).
const consumeSecurityValue = async (key) => {
  const client = getRedisClient();
  const namespacedKey = redisKey(key);
  if (client && client.isReady) {
    return client.getDel(namespacedKey);
  }
  const current = localRateStore.get(namespacedKey);
  localRateStore.delete(namespacedKey);
  if (!current || current.expiresAt <= Date.now()) return null;
  return current.value ?? String(current.count ?? '');
};

const revokeAllSessionsForUser = async ({ userId, reason = 'revoked' }) => {
  if (!userId) return { modifiedCount: 0 };
  return Session.updateMany(
    { userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date().toISOString(), revokedReason: reason } }
  );
};

const createRefreshSession = async ({ req, userId }) => {
  const refreshToken = createOpaqueToken(48);
  const session = {
    sessionId: createOpaqueToken(18),
    userId,
    refreshTokenHash: hashOpaqueToken(refreshToken),
    tokenFamilyId: createOpaqueToken(18),
    createdAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString(),
    ...requestContext(req)
  };
  await Session.create(session);
  return { session, refreshToken };
};

const REFRESH_REUSE_EVENT = 'SECURITY_REFRESH_REUSE_DETECTED';

const rotateRefreshSession = async ({ req, refreshToken }) => {
  const tokenHash = hashOpaqueToken(refreshToken);
  const nextRefreshToken = createOpaqueToken(48);
  const nextHash = hashOpaqueToken(nextRefreshToken);

  // Validate session + validate token hash + rotate, as one atomic
  // operation. This is deliberately a single findOneAndUpdate rather than
  // three separate steps: MongoDB serializes updates per document, so
  // there's no window between "check" and "rotate" for a second concurrent
  // request to sneak through with the same (about-to-be-retired) token —
  // Token A becomes invalid immediately and atomically at the moment Token
  // B is issued, not sometime shortly after.
  const session = await Session.findOneAndUpdate(
    {
      refreshTokenHash: tokenHash,
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date().toISOString() }
    },
    {
      $set: {
        refreshTokenHash: nextHash,
        previousRefreshTokenHash: tokenHash,
        lastUsedAt: new Date().toISOString(),
        ...requestContext(req)
      }
    },
    { returnDocument: 'after', lean: true }
  );
  if (session) return { session, refreshToken: nextRefreshToken };

  // REFRESH TOKEN REUSE DETECTED: the presented token doesn't match any
  // session's current hash, but it does match a session's *previous*
  // (already rotated-away) hash — i.e. Token A is being presented again
  // after Token B was already issued from it. This is unambiguous evidence
  // of token compromise.
  const reused = await Session.findOne({ previousRefreshTokenHash: tokenHash }).lean();
  if (reused) {
    // Revoke the entire refresh-token family (every session sharing this
    // tokenFamilyId — currently always just the one session in this data
    // model, since families don't branch, but scoped correctly for if they
    // ever do) rather than every session the user has anywhere. A
    // legitimate, untouched session on another device shouldn't be forced
    // to reauthenticate just because a different token family was
    // compromised.
    await Session.updateMany(
      { tokenFamilyId: reused.tokenFamilyId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date().toISOString(), revokedReason: REFRESH_REUSE_EVENT } }
    );
    return {
      session: null,
      refreshToken: null,
      reused: true,
      userId: reused.userId,
      sessionId: reused.sessionId,
      tokenFamilyId: reused.tokenFamilyId
    };
  }

  return null;
};

const revokeRefreshSession = async ({ refreshToken, reason = 'logout' }) => {
  if (!refreshToken) return null;
  return Session.findOneAndUpdate(
    { refreshTokenHash: hashOpaqueToken(refreshToken), revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date().toISOString(), revokedReason: reason } },
    { returnDocument: 'after', lean: true }
  );
};

module.exports = {
  SECURITY_EVENTS,
  createOpaqueToken,
  hashOpaqueToken,
  safeTokenEqual,
  requestContext,
  recordSecurityEvent,
  createRefreshSession,
  rotateRefreshSession,
  revokeRefreshSession,
  revokeAllSessionsForUser,
  incrementWindowCounter,
  getSecurityValue,
  setSecurityValue,
  clearSecurityValue,
  consumeSecurityValue,
  REFRESH_TOKEN_TTL_MS
};
