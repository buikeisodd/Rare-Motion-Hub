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

const requestContext = (req) => ({
  ipAddress: req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '',
  userAgent: req.get('user-agent') || ''
});

const recordSecurityEvent = async ({ req, userId, sessionId, category = 'auth', type, metadata = {} }) => {
  if (!type) return;
  try {
    const context = req ? requestContext(req) : {};
    await SecurityEvent.create({
      eventId: `${Date.now().toString(36)}${crypto.randomBytes(8).toString('hex')}`,
      userId,
      sessionId,
      category,
      type,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Security event write failed:', error.message);
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

const rotateRefreshSession = async ({ req, refreshToken }) => {
  const tokenHash = hashOpaqueToken(refreshToken);
  const nextRefreshToken = createOpaqueToken(48);
  const nextHash = hashOpaqueToken(nextRefreshToken);

  // Normal path: the presented token matches a session's CURRENT hash.
  // Rotate it — the old hash is retained as previousRefreshTokenHash
  // purely so a later replay of it can be recognized as reuse (see below),
  // not because the raw token is stored anywhere (only its SHA-256 hash
  // ever touches Mongo/Redis).
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

  // Reuse detection: the token didn't match any session's current hash —
  // but does it match a session's *previous* (already rotated-away) hash?
  // If so, this exact token was valid once, got rotated out, and is now
  // being replayed — a strong signal it was stolen at some point before
  // the legitimate rotation happened. Treat this as compromise: revoke the
  // session immediately rather than just rejecting the one request.
  const reused = await Session.findOneAndUpdate(
    { previousRefreshTokenHash: tokenHash, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date().toISOString(), revokedReason: 'refresh_token_reuse_detected' } },
    { returnDocument: 'after', lean: true }
  );
  if (reused) {
    return { session: null, refreshToken: null, reused: true, userId: reused.userId, sessionId: reused.sessionId };
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
