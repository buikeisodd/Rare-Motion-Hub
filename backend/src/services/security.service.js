const crypto = require('crypto');
const { SecurityEvent, Session } = require('../models');

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
  const session = await Session.findOneAndUpdate(
    {
      refreshTokenHash: tokenHash,
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date().toISOString() }
    },
    {
      $set: {
        refreshTokenHash: hashOpaqueToken(nextRefreshToken),
        lastUsedAt: new Date().toISOString(),
        ...requestContext(req)
      }
    },
    { returnDocument: 'after', lean: true }
  );
  if (!session) return null;
  return { session, refreshToken: nextRefreshToken };
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
  REFRESH_TOKEN_TTL_MS
};
