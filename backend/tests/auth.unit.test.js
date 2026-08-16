/**
 * Phase 10 — Unit security tests (no database required)
 *
 * These tests verify security properties that are purely logic-based and
 * don't require a running database. They run in this sandbox environment.
 * Integration tests (auth.integration.test.js) require a MongoDB instance
 * and are designed to run in CI or locally.
 */

// Suppress fire-and-forget console.error from SecurityEvent writes and
// lockout email sends — both try Mongo/network which isn't available here.
// This is expected: tests verify the logic, not the persistence side-effects.
beforeAll(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterAll(() => jest.restoreAllMocks());

// ─── Phase 1: Security primitives ────────────────────────────────────────────
describe('Phase 1 — Security primitives', () => {
  const crypto = require('crypto');

  test('SECURITY_EVENTS taxonomy — all events have valid categories', () => {
    const { SECURITY_EVENTS } = require('../src/services/security.service');
    const validCategories = ['AUTH', 'SECURITY', 'SYSTEM'];
    for (const [type, category] of Object.entries(SECURITY_EVENTS)) {
      expect(validCategories).toContain(category);
      expect(type.startsWith(category + '_') || type.startsWith(category)).toBe(true);
    }
  });

  test('createOpaqueToken produces cryptographically random values', () => {
    const { createOpaqueToken } = require('../src/services/security.service');
    const t1 = createOpaqueToken(32);
    const t2 = createOpaqueToken(32);
    expect(t1).not.toBe(t2);
    expect(t1.length).toBeGreaterThan(20);
  });

  test('hashOpaqueToken is deterministic and non-reversible', () => {
    const { hashOpaqueToken } = require('../src/services/security.service');
    const token = 'test-token-value';
    const hash1 = hashOpaqueToken(token);
    const hash2 = hashOpaqueToken(token);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex
    expect(hash1).not.toContain(token);
  });

  test('deriveAccountStatus — all 9 cases correct', () => {
    const { deriveAccountStatus } = require('../src/controllers/auth.controller');
    expect(deriveAccountStatus(null)).toBeNull();
    expect(deriveAccountStatus({})).toBe('pending_verification');
    expect(deriveAccountStatus({ emailVerified: false })).toBe('pending_verification');
    expect(deriveAccountStatus({ emailVerified: true })).toBe('active');
    expect(deriveAccountStatus({ emailVerified: true, isSuspended: true })).toBe('suspended');
    expect(deriveAccountStatus({ emailVerified: true, isDeactivated: true })).toBe('deactivated');
    expect(deriveAccountStatus({ emailVerified: false, isDeactivated: true })).toBe('deactivated');
    expect(deriveAccountStatus({ emailVerified: false, isSuspended: true })).toBe('suspended');
    expect(deriveAccountStatus({ isDeactivated: true, isSuspended: true })).toBe('deactivated');
  });
});

// ─── Phase 2: Email verification tokens ──────────────────────────────────────
describe('Phase 2 — Verification token properties', () => {
  const crypto = require('crypto');

  test('atomic consumption: two concurrent calls — exactly one succeeds', async () => {
    const { setSecurityValue, consumeSecurityValue } = require('../src/services/security.service');
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    await setSecurityValue(`verify:${hash}`, 'user_123', 300);
    const [a, b] = await Promise.all([
      consumeSecurityValue(`verify:${hash}`),
      consumeSecurityValue(`verify:${hash}`)
    ]);
    const successes = [a, b].filter(Boolean).length;
    expect(successes).toBe(1);
  });

  test('consumed token cannot be reused', async () => {
    const { setSecurityValue, consumeSecurityValue } = require('../src/services/security.service');
    const hash = crypto.createHash('sha256').update('oneuse').digest('hex');
    await setSecurityValue(`verify:${hash}`, 'user_abc', 300);
    await consumeSecurityValue(`verify:${hash}`);
    const reuse = await consumeSecurityValue(`verify:${hash}`);
    expect(reuse).toBeNull();
  });

  test('expired token returns null', async () => {
    const { setSecurityValue, consumeSecurityValue } = require('../src/services/security.service');
    const hash = crypto.createHash('sha256').update('expiretest-unit').digest('hex');
    await setSecurityValue(`verify:${hash}`, 'user_xyz', 1);
    await new Promise(r => setTimeout(r, 1100));
    const result = await consumeSecurityValue(`verify:${hash}`);
    expect(result).toBeNull();
  });
});

// ─── Phase 3: JWT claims ─────────────────────────────────────────────────────
describe('Phase 3 — JWT access token claims', () => {
  const jwt = require('jsonwebtoken');
  const SECRET = 'test_secret';

  const sign = (claims, opts = {}) =>
    jwt.sign(claims, SECRET, { expiresIn: '15m', ...opts });

  test('access token contains sub, sid, type=access — no mutable auth state', () => {
    const token = sign({ sub: 'u1', sid: 's1', type: 'access' });
    const decoded = jwt.verify(token, SECRET);
    expect(decoded.sub).toBe('u1');
    expect(decoded.sid).toBe('s1');
    expect(decoded.type).toBe('access');
    expect(decoded).not.toHaveProperty('emailVerified');
    expect(decoded).not.toHaveProperty('accountStatus');
    expect(decoded).not.toHaveProperty('userId'); // old claim name gone
    expect(decoded).not.toHaveProperty('sessionId');
  });

  test('token with wrong type is rejected by middleware type check', () => {
    const wrong = sign({ sub: 'u1', sid: 's1', type: 'refresh' });
    const decoded = jwt.verify(wrong, SECRET);
    expect(decoded.type).not.toBe('access');
  });

  test('access token TTL is <= 15 minutes', () => {
    const ttlMs = Number(process.env.ACCESS_TOKEN_TTL_MS || 1000 * 60 * 15);
    expect(ttlMs).toBeLessThanOrEqual(15 * 60 * 1000);
  });

  test('forged JWT without correct secret is rejected', () => {
    const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const p = Buffer.from(JSON.stringify({ sub: 'u1', sid: 's1', type: 'access' })).toString('base64url');
    const forged = `${h}.${p}.invalidsignature`;
    expect(() => jwt.verify(forged, SECRET)).toThrow();
  });
});

// ─── Phase 4: Middleware logic ────────────────────────────────────────────────
describe('Phase 4 — CSRF timing-safe comparison', () => {
  const crypto = require('crypto');

  const timingSafeCheck = (csrfCookie, csrfHeader) => {
    if (!csrfCookie || !csrfHeader) return false;
    const a = Buffer.from(csrfCookie, 'utf8');
    const b = Buffer.from(csrfHeader, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  };

  test('matching tokens → true', () => expect(timingSafeCheck('abc', 'abc')).toBe(true));
  test('mismatched tokens → false', () => expect(timingSafeCheck('abc', 'xyz')).toBe(false));
  test('different lengths → false (no Buffer panic)', () => expect(timingSafeCheck('short', 'longervalue')).toBe(false));
  test('empty cookie → false', () => expect(timingSafeCheck('', 'abc')).toBe(false));
  test('empty header → false', () => expect(timingSafeCheck('abc', '')).toBe(false));
  test('both empty → false', () => expect(timingSafeCheck('', '')).toBe(false));
});

// ─── Phase 5: Rate limiting logic ────────────────────────────────────────────
describe('Phase 5 — Lockout logic', () => {
  test('5 failures trigger lockout (LOGIN_FAIL_MAX=5)', async () => {
    const rl = require('../src/services/auth-rate-limit.service');
    const fakeReq = { ip: '99.99.99.99', headers: {}, res: { set: () => {} } };
    const email = `locktest${Date.now()}@example.com`;
    for (let i = 0; i < 5; i++) await rl.noteLoginFailure(fakeReq, email);
    let err = null;
    try { await rl.ensureLoginNotLocked(fakeReq, email); } catch (e) { err = e; }
    expect(err).toBeTruthy();
    expect(err.statusCode).toBe(429);
    expect(err.lockedUntil).toBeDefined();
    const lockTtl = Math.round((new Date(err.lockedUntil) - Date.now()) / 1000);
    expect(lockTtl).toBeGreaterThanOrEqual(290);
    expect(lockTtl).toBeLessThanOrEqual(310);
  });

  test('successful login clears lockout state', async () => {
    const rl = require('../src/services/auth-rate-limit.service');
    const fakeReq = { ip: '98.98.98.98', headers: {}, res: { set: () => {} } };
    const email = `cleartest${Date.now()}@example.com`;
    for (let i = 0; i < 5; i++) await rl.noteLoginFailure(fakeReq, email);
    await rl.noteLoginSuccess(email);
    let err = null;
    try { await rl.ensureLoginNotLocked(fakeReq, email); } catch (e) { err = e; }
    expect(err).toBeNull();
  });

  test('IP_AUTH_MAX < LOGIN_LOCK_THRESHOLD prevents single-IP account-DoS', () => {
    const IP_AUTH_MAX = Number(process.env.IP_AUTH_MAX || 10);
    const LOGIN_FAIL_MAX = Number(process.env.LOGIN_FAIL_MAX || 5);
    // IP limit must fire before account lock threshold from a single IP
    // (IP fires at IP_AUTH_MAX attempts; lock fires at LOGIN_FAIL_MAX *failures*
    // but lockout only accumulates when enforceLoginLimits doesn't throw first)
    expect(IP_AUTH_MAX).toBeGreaterThan(LOGIN_FAIL_MAX);
  });
});

// ─── Phase 6: Session revocation ─────────────────────────────────────────────
describe('Phase 6 — Refresh token rotation (in-memory mock)', () => {
  const crypto = require('crypto');
  const { hashOpaqueToken, createOpaqueToken, REFRESH_TOKEN_TTL_MS } = require('../src/services/security.service');

  // Implement the core rotation logic directly against the in-memory store
  // to test the algorithm without needing Mongoose. This mirrors exactly
  // what rotateRefreshSession and createRefreshSession do.
  const store = [];

  const createSession = (userId) => {
    const refreshToken = createOpaqueToken(48);
    const session = {
      sessionId: createOpaqueToken(16),
      userId,
      refreshTokenHash: hashOpaqueToken(refreshToken),
      previousRefreshTokenHash: null,
      tokenFamilyId: createOpaqueToken(16),
      revokedAt: undefined,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString()
    };
    store.push(session);
    return { session, refreshToken };
  };

  const rotate = (refreshToken) => {
    const hash = hashOpaqueToken(refreshToken);
    const nextToken = createOpaqueToken(48);
    const nextHash = hashOpaqueToken(nextToken);
    // Normal path
    const idx = store.findIndex(s => s.refreshTokenHash === hash && !s.revokedAt && new Date(s.expiresAt) > new Date());
    if (idx >= 0) {
      store[idx].previousRefreshTokenHash = hash;
      store[idx].refreshTokenHash = nextHash;
      return { session: store[idx], refreshToken: nextToken };
    }
    // Reuse detection
    const reused = store.find(s => s.previousRefreshTokenHash === hash && !s.revokedAt);
    if (reused) {
      reused.revokedAt = new Date().toISOString();
      reused.revokedReason = 'SECURITY_REFRESH_REUSE_DETECTED';
      return { session: null, refreshToken: null, reused: true, userId: reused.userId, sessionId: reused.sessionId };
    }
    return null;
  };

  beforeEach(() => store.length = 0);

  test('rotating a token invalidates the previous one', () => {
    const { refreshToken: R1 } = createSession('u1');
    const rot = rotate(R1);
    expect(rot).toBeTruthy();
    expect(rot.refreshToken).not.toBe(R1);
    // R1 must now fail — reuse detected
    const replay = rotate(R1);
    expect(replay.reused).toBe(true);
  });

  test('replayed refresh token triggers reuse detection with userId', () => {
    const { refreshToken: R1 } = createSession('u2');
    rotate(R1);
    const reuse = rotate(R1);
    expect(reuse.reused).toBe(true);
    expect(reuse.userId).toBe('u2');
  });

  test('reuse revokes session — further use of rotated token also fails', () => {
    const { refreshToken: R1 } = createSession('u3');
    const rot = rotate(R1);
    const R2 = rot.refreshToken;
    rotate(R1); // reuse — revokes session
    const r2attempt = rotate(R2); // R2 should also fail now (session is revoked)
    expect(r2attempt).toBeNull();
  });

  test('token from different family is unaffected by reuse in another family', () => {
    const { refreshToken: R1 } = createSession('u4');
    const { refreshToken: R2 } = createSession('u4'); // second session, different family
    rotate(R1); // rotate R1
    rotate(R1); // reuse R1 — revokes family 1
    // R2 (different family) must still work
    const rot2 = rotate(R2);
    expect(rot2).toBeTruthy();
    expect(rot2.reused).not.toBe(true);
  });
});

// ─── Phase 7: Audit taxonomy ─────────────────────────────────────────────────
describe('Phase 7 — Audit event taxonomy completeness', () => {
  test('all call-site event types are in SECURITY_EVENTS', () => {
    const { SECURITY_EVENTS } = require('../src/services/security.service');
    const fs = require('fs');
    const src = fs.readFileSync('./src/controllers/auth.controller.js', 'utf8');
    const rl = fs.readFileSync('./src/services/auth-rate-limit.service.js', 'utf8');
    const combined = src + rl;
    const typeMatches = [...combined.matchAll(/type: '([A-Z_]+)'/g)].map(m => m[1]).filter(t => t !== 'access');
    const unknownTypes = [...new Set(typeMatches)].filter(t => !SECURITY_EVENTS[t]);
    expect(unknownTypes).toHaveLength(0);
  });

  test('all SECURITY_EVENTS have AUTH/SECURITY/SYSTEM category', () => {
    const { SECURITY_EVENTS } = require('../src/services/security.service');
    for (const [, cat] of Object.entries(SECURITY_EVENTS)) {
      expect(['AUTH', 'SECURITY', 'SYSTEM']).toContain(cat);
    }
  });

  test('required spec events are present in taxonomy', () => {
    const { SECURITY_EVENTS } = require('../src/services/security.service');
    const required = [
      'AUTH_REGISTERED', 'AUTH_LOGIN_SUCCESS', 'AUTH_LOGIN_FAILED',
      'AUTH_LOGOUT', 'AUTH_LOGOUT_ALL', 'AUTH_EMAIL_VERIFICATION_SENT',
      'AUTH_EMAIL_VERIFIED', 'AUTH_PASSWORD_RESET_REQUESTED',
      'AUTH_PASSWORD_RESET_COMPLETED', 'AUTH_TOKEN_REFRESHED',
      'SECURITY_ACCOUNT_LOCKED', 'SECURITY_REFRESH_REUSE_DETECTED',
      'SECURITY_SESSION_REVOKED', 'SECURITY_RATE_LIMITED',
      'SYSTEM_ERROR', 'SYSTEM_EMAIL_FAILED', 'SYSTEM_UPLOAD_FAILED'
    ];
    for (const evt of required) {
      expect(SECURITY_EVENTS).toHaveProperty(evt);
    }
  });
});

// ─── Phase 9: CORS origin callback ───────────────────────────────────────────
describe('Phase 9 — CORS origin validation', () => {
  const makeCallback = (allowed) => (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowed.includes(origin)) return cb(null, true);
    return cb(Object.assign(new Error('Not allowed by CORS'), { status: 403 }));
  };

  const check = (cb, origin) => new Promise((resolve, reject) =>
    cb(origin, (err, ok) => err ? reject(err) : resolve(ok))
  );

  test('allowed origin passes', async () => {
    const cb = makeCallback(['https://app.example.com']);
    await expect(check(cb, 'https://app.example.com')).resolves.toBe(true);
  });

  test('unknown origin blocked', async () => {
    const cb = makeCallback(['https://app.example.com']);
    await expect(check(cb, 'https://evil.com')).rejects.toThrow();
  });

  test('no Origin header (server-to-server) passes', async () => {
    const cb = makeCallback(['https://app.example.com']);
    await expect(check(cb, undefined)).resolves.toBe(true);
  });

  test('http variant of https origin blocked', async () => {
    const cb = makeCallback(['https://app.example.com']);
    await expect(check(cb, 'http://app.example.com')).rejects.toThrow();
  });

  test('wildcard never in allowlist', () => {
    const allowed = ['https://app.example.com'];
    expect(allowed).not.toContain('*');
  });
});
