const crypto = require('crypto');
const { SecurityEvent } = require('../models');

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

module.exports = {
  createOpaqueToken,
  hashOpaqueToken,
  safeTokenEqual,
  requestContext,
  recordSecurityEvent
};
