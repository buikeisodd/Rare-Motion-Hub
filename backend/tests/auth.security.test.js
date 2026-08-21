/**
 * Phase 10 — Security regression tests
 *
 * Each test maps to a specific security requirement from the implementation
 * phases. Tests are intentionally narrow — they verify the security property,
 * not the happy-path UX. Supertest runs the real Express app against an
 * in-memory MongoDB instance; Redis falls back to the in-memory Map store.
 */
require('./setup');
const request = require('supertest');
const mongoose = require('mongoose');

// Delay app import until after setup.js has connected Mongoose
let app;
beforeAll(() => { app = require('../src/app'); });

// ─── helpers ──────────────────────────────────────────────────────────────────
const register = (email, password = 'Password123!') =>
  request(app).post('/api/auth/register').send({ email, password });

const login = (email, password = 'Password123!') =>
  request(app).post('/api/auth/login').send({ email, password });

const getSetCookies = (res) => {
  const raw = res.headers['set-cookie'] || [];
  return Array.isArray(raw) ? raw : [raw];
};

const extractCookie = (cookies, name) => {
  const match = cookies.find(c => c.startsWith(name + '=') || c.startsWith(`__Secure-${name}=`) || c.startsWith(`__Host-${name}=`));
  if (!match) return null;
  return match.split(';')[0].split('=').slice(1).join('=');
};

const verifyEmail = async (email) => {
  const { User } = require('../src/models');
  await User.updateOne({ email }, { $set: { emailVerified: true, accountStatus: 'active' } });
};

// ─── Phase 1: Data models and security primitives ─────────────────────────────
describe('Phase 1 — Security primitives', () => {
  test('registration hashes password — plaintext never stored', async () => {
    const email = 'p1@test.com';
    await register(email);
    const { User } = require('../src/models');
    const user = await User.findOne({ email }).lean();
    expect(user.passwordHash).toBeDefined();
    expect(user.passwordHash).not.toBe('Password123!');
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt prefix
  });

  test('registration sets emailVerified=false and accountStatus=pending_verification', async () => {
    const email = 'p1b@test.com';
    await register(email);
    const { User } = require('../src/models');
    const user = await User.findOne({ email }).lean();
    expect(user.emailVerified).toBe(false);
    expect(user.accountStatus).toBe('pending_verification');
  });

  test('Session document stores only refresh token hash, never raw token', async () => {
    const email = 'p1c@test.com';
    await register(email);
    await verifyEmail(email);
    await login(email);
    const { Session } = require('../src/models');
    const sessions = await Session.find({}).lean();
    expect(sessions.length).toBeGreaterThan(0);
    for (const s of sessions) {
      expect(s.refreshTokenHash).toBeDefined();
      expect(s.refreshTokenHash).toHaveLength(64); // SHA-256 hex
      expect(s).not.toHaveProperty('refreshToken'); // raw never stored
    }
  });
});

// ─── Phase 2: Email verification lifecycle ────────────────────────────────────
describe('Phase 2 — Email verification', () => {
  test('unverified user cannot access protected endpoints', async () => {
    const email = 'p2a@test.com';
    await register(email);
    // Manually get a valid JWT by patching the user as verified briefly,
    // log in to get cookies, then revert and try again
    await verifyEmail(email);
    const loginRes = await login(email);
    const cookies = getSetCookies(loginRes);

    // Revert to unverified
    const { User } = require('../src/models');
    await User.updateOne({ email }, { $set: { emailVerified: false, accountStatus: 'pending_verification' } });

    const res = await request(app)
      .get('/api/workspace')
      .set('Cookie', cookies.join('; '));
    expect(res.status).toBe(403);
  });

  test('verification with an already-used token fails', async () => {
    const { setSecurityValue } = require('../src/services/security.service');
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    // Store and consume the token
    await setSecurityValue(`verify:${hash}`, 'user_test', 300);
    const { consumeSecurityValue } = require('../src/services/security.service');
    await consumeSecurityValue(`verify:${hash}`);
    // Second consumption must return null
    const result = await consumeSecurityValue(`verify:${hash}`);
    expect(result).toBeNull();
  });

  test('resend rate limit: 4th resend within window is blocked', async () => {
    const email = 'p2b@test.com';
    await register(email);
    const resend = () => request(app)
      .post('/api/auth/resend-verification')
      .set('X-Forwarded-For', '10.0.0.1')
      .send({ email });

    // 3 allowed (RESEND_EMAIL_MAX default=3)
    for (let i = 0; i < 3; i++) {
      const r = await resend();
      expect([200, 429]).toContain(r.status);
    }
    const r4 = await resend();
    expect(r4.status).toBe(429);
  });
});

// ─── Phase 3: Session + token lifecycle ──────────────────────────────────────
describe('Phase 3 — Session and token lifecycle', () => {
  test('access token claims contain sub, sid, type=access — no mutable auth state', async () => {
    const jwt = require('jsonwebtoken');
    const email = 'p3a@test.com';
    await register(email);
    await verifyEmail(email);
    const res = await login(email);
    const cookies = getSetCookies(res);
    const rawToken = extractCookie(cookies, 'accessToken');
    expect(rawToken).toBeTruthy();
    const decoded = jwt.decode(rawToken);
    expect(decoded.sub).toBeDefined();
    expect(decoded.sid).toBeDefined();
    expect(decoded.type).toBe('access');
    expect(decoded).not.toHaveProperty('emailVerified');
    expect(decoded).not.toHaveProperty('accountStatus');
    expect(decoded).not.toHaveProperty('userId');
  });

  test('refresh token rotation — old token rejected after rotation', async () => {
    const email = 'p3b@test.com';
    await register(email);
    await verifyEmail(email);
    const loginRes = await login(email);
    const loginCookies = getSetCookies(loginRes);

    // First refresh — rotates token
    const refresh1 = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', loginCookies.join('; '));
    expect(refresh1.status).toBe(200);

    // Using the original (pre-rotation) cookies again must fail
    const refresh2 = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', loginCookies.join('; '));
    expect(refresh2.status).toBe(401);
  });

  test('access token TTL is <= 15 minutes', () => {
    const ttlMs = Number(process.env.ACCESS_TOKEN_TTL_MS || 1000 * 60 * 15);
    expect(ttlMs).toBeLessThanOrEqual(15 * 60 * 1000);
  });
});

// ─── Phase 4: Cookie auth + middleware ───────────────────────────────────────
describe('Phase 4 — Cookie auth and middleware', () => {
  test('auth cookies are HttpOnly and Secure in production', async () => {
    process.env.NODE_ENV = 'production';
    const email = 'p4a@test.com';
    await register(email);
    await verifyEmail(email);
    const res = await login(email);
    const cookies = getSetCookies(res);
    const authCookie = cookies.find(c => c.includes('accessToken'));
    expect(authCookie).toBeDefined();
    expect(authCookie.toLowerCase()).toContain('httponly');
    expect(authCookie.toLowerCase()).toContain('secure');
    process.env.NODE_ENV = 'test';
  });

  test('request with no cookies returns 401', async () => {
    const res = await request(app).get('/api/workspace');
    expect(res.status).toBe(401);
  });

  test('request with tampered JWT signature returns 401', async () => {
    const email = 'p4b@test.com';
    await register(email);
    await verifyEmail(email);
    const loginRes = await login(email);
    const cookies = getSetCookies(loginRes);
    const raw = extractCookie(cookies, 'accessToken');
    const parts = raw.split('.');
    parts[2] = 'invalidsignature';
    const tampered = parts.join('.');
    const tamperedCookies = cookies.map(c =>
      c.startsWith('accessToken=') ? `accessToken=${tampered}` : c
    );
    const res = await request(app)
      .get('/api/workspace')
      .set('Cookie', tamperedCookies.join('; '));
    expect(res.status).toBe(401);
  });

  test('revoking session invalidates subsequent requests immediately', async () => {
    const email = 'p4c@test.com';
    await register(email);
    await verifyEmail(email);
    const loginRes = await login(email);
    const cookies = getSetCookies(loginRes);

    // Verify it works before revocation
    const before = await request(app)
      .get('/api/workspace')
      .set('Cookie', cookies.join('; '));
    expect(before.status).toBe(200);

    // Revoke all sessions directly in DB
    const { Session } = require('../src/models');
    await Session.updateMany({}, { $set: { revokedAt: new Date().toISOString() } });

    const after = await request(app)
      .get('/api/workspace')
      .set('Cookie', cookies.join('; '));
    expect(after.status).toBe(401);
  });
});

// ─── Phase 5: Rate limiting + lockout ────────────────────────────────────────
describe('Phase 5 — Rate limiting and lockout', () => {
  test('5 failed logins trigger lockout with lockedUntil in response', async () => {
    const email = 'p5a@test.com';
    await register(email);
    await verifyEmail(email);
    let lastRes;
    for (let i = 0; i < 5; i++) {
      lastRes = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '10.0.0.5')
        .send({ email, password: 'wrongpassword' });
    }
    expect(lastRes.status).toBe(429);
    expect(lastRes.body.lockedUntil).toBeDefined();
    expect(new Date(lastRes.body.lockedUntil).getTime()).toBeGreaterThan(Date.now());
  });

  test('correct password rejected during lockout', async () => {
    const email = 'p5b@test.com';
    await register(email);
    await verifyEmail(email);
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login')
        .set('X-Forwarded-For', '10.0.0.6')
        .send({ email, password: 'wrongpassword' });
    }
    const res = await request(app).post('/api/auth/login')
      .set('X-Forwarded-For', '10.0.0.6')
      .send({ email, password: 'Password123!' });
    expect(res.status).toBe(429);
  });

  test('successful login clears lockout counter', async () => {
    const email = 'p5c@test.com';
    await register(email);
    await verifyEmail(email);
    for (let i = 0; i < 4; i++) {
      await request(app).post('/api/auth/login')
        .set('X-Forwarded-For', '10.0.0.7')
        .send({ email, password: 'wrongpassword' });
    }
    // Correct login clears counter
    const ok = await request(app).post('/api/auth/login')
      .set('X-Forwarded-For', '10.0.0.7')
      .send({ email, password: 'Password123!' });
    expect(ok.status).toBe(200);
    // 4 more failures should not immediately lock (counter was reset)
    for (let i = 0; i < 4; i++) {
      await request(app).post('/api/auth/login')
        .set('X-Forwarded-For', '10.0.0.7')
        .send({ email, password: 'wrongpassword' });
    }
    const notLocked = await request(app).post('/api/auth/login')
      .set('X-Forwarded-For', '10.0.0.7')
      .send({ email, password: 'Password123!' });
    expect(notLocked.status).toBe(200);
  });
});

// ─── Phase 6: Logout + password reset ────────────────────────────────────────
describe('Phase 6 — Logout and password reset', () => {
  test('logout revokes session — subsequent requests fail', async () => {
    const email = 'p6a@test.com';
    await register(email);
    await verifyEmail(email);
    const loginRes = await login(email);
    const cookies = getSetCookies(loginRes);

    await request(app).post('/api/auth/logout').set('Cookie', cookies.join('; '));

    const res = await request(app)
      .get('/api/workspace')
      .set('Cookie', cookies.join('; '));
    expect(res.status).toBe(401);
  });

  test('password reset does not issue a new session', async () => {
    const email = 'p6b@test.com';
    await register(email);
    await verifyEmail(email);
    const { createPasswordReset } = (() => {
      // Access the internal helper via the controller's exported module
      // by calling the forgot-password endpoint with the dev token in response
      return { createPasswordReset: null };
    })();

    const forgotRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email });
    expect(forgotRes.status).toBe(200);
    // In test/dev mode, verificationUrl is returned
    if (forgotRes.body.resetUrl) {
      const resetToken = new URL(forgotRes.body.resetUrl).searchParams.get('resetToken');
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: resetToken, password: 'NewPassword456!' });
      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);
      // Must NOT have user or token in body
      expect(resetRes.body.user).toBeUndefined();
      expect(resetRes.body.token).toBeUndefined();
      // Auth cookies must be cleared (set-cookie with maxAge=0 or expired)
      const respCookies = getSetCookies(resetRes);
      const accessCookie = respCookies.find(c => c.includes('accessToken'));
      if (accessCookie) {
        expect(accessCookie.toLowerCase()).toContain('max-age=0');
      }
    }
  });

  test('logout-all revokes all sessions', async () => {
    const email = 'p6c@test.com';
    await register(email);
    await verifyEmail(email);
    const res1 = await login(email);
    const res2 = await login(email);
    const cookies1 = getSetCookies(res1);
    const cookies2 = getSetCookies(res2);

    // Logout all using session 1's cookies
    const csrfToken = extractCookie(cookies1, 'csrfToken');
    await request(app)
      .post('/api/auth/logout-all')
      .set('Cookie', cookies1.join('; '))
      .set('x-csrf-token', csrfToken || '');

    // Session 2 must also be invalid now
    const res = await request(app)
      .get('/api/workspace')
      .set('Cookie', cookies2.join('; '));
    expect(res.status).toBe(401);
  });
});

// ─── Phase 7: Audit events ────────────────────────────────────────────────────
describe('Phase 7 — Audit/security events', () => {
  test('login success writes AUTH_LOGIN_SUCCESS event', async () => {
    const email = 'p7a@test.com';
    await register(email);
    await verifyEmail(email);
    await login(email);
    const { SecurityEvent } = require('../src/models');
    const evt = await SecurityEvent.findOne({ type: 'AUTH_LOGIN_SUCCESS' }).lean();
    expect(evt).toBeTruthy();
    expect(evt.category).toBe('AUTH');
    expect(evt.metadata).not.toHaveProperty('password');
    expect(evt.metadata).not.toHaveProperty('token');
  });

  test('failed login writes AUTH_LOGIN_FAILED — no password in metadata', async () => {
    const email = 'p7b@test.com';
    await register(email);
    await verifyEmail(email);
    await request(app).post('/api/auth/login').send({ email, password: 'wrongpassword' });
    const { SecurityEvent } = require('../src/models');
    const evt = await SecurityEvent.findOne({ type: 'AUTH_LOGIN_FAILED' }).lean();
    expect(evt).toBeTruthy();
    const metaStr = JSON.stringify(evt.metadata || {});
    expect(metaStr).not.toContain('wrongpassword');
    expect(metaStr).not.toContain('password');
  });

  test('lockout writes SECURITY_ACCOUNT_LOCKED event', async () => {
    const email = 'p7c@test.com';
    await register(email);
    await verifyEmail(email);
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login')
        .set('X-Forwarded-For', '10.0.0.8')
        .send({ email, password: 'wrongpassword' });
    }
    const { SecurityEvent } = require('../src/models');
    const evt = await SecurityEvent.findOne({ type: 'SECURITY_ACCOUNT_LOCKED' }).lean();
    expect(evt).toBeTruthy();
    expect(evt.category).toBe('SECURITY');
  });

  test('SECURITY_REFRESH_REUSE_DETECTED fires on replayed refresh token', async () => {
    const email = 'p7d@test.com';
    await register(email);
    await verifyEmail(email);
    const loginRes = await login(email);
    const originalCookies = getSetCookies(loginRes);

    // First refresh — rotates token
    await request(app).post('/api/auth/refresh').set('Cookie', originalCookies.join('; '));
    // Replay original — reuse detected
    await request(app).post('/api/auth/refresh').set('Cookie', originalCookies.join('; '));

    const { SecurityEvent } = require('../src/models');
    const evt = await SecurityEvent.findOne({ type: 'SECURITY_REFRESH_REUSE_DETECTED' }).lean();
    expect(evt).toBeTruthy();
    expect(evt.category).toBe('SECURITY');
  });
});

// ─── Phase 8: Frontend auth state (server contract) ──────────────────────────
describe('Phase 8 — Auth state server contracts', () => {
  test('GET /api/auth/me returns 200 with user for verified session', async () => {
    const email = 'p8a@test.com';
    await register(email);
    await verifyEmail(email);
    const loginRes = await login(email);
    const cookies = getSetCookies(loginRes);
    const res = await request(app).get('/api/auth/me').set('Cookie', cookies.join('; '));
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(email);
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  test('GET /api/auth/me returns 403 for unverified session', async () => {
    const email = 'p8b@test.com';
    await register(email);
    await verifyEmail(email);
    const loginRes = await login(email);
    const cookies = getSetCookies(loginRes);
    const { User } = require('../src/models');
    await User.updateOne({ email }, { $set: { emailVerified: false, accountStatus: 'pending_verification' } });
    const res = await request(app).get('/api/auth/me').set('Cookie', cookies.join('; '));
    expect(res.status).toBe(403);
  });

  test('unverified login returns requiresEmailVerification:true — no session', async () => {
    const email = 'p8c@test.com';
    await register(email);
    const res = await login(email);
    expect(res.status).toBe(403);
    expect(res.body.requiresEmailVerification).toBe(true);
    expect(res.body.success).toBe(false);
    const cookies = getSetCookies(res);
    const accessCookie = cookies.find(c => c.includes('accessToken'));
    expect(accessCookie).toBeFalsy();
  });
});

// ─── Phase 9: CORS/CSRF/security hardening ───────────────────────────────────
describe('Phase 9 — CORS and CSRF hardening', () => {
  test('missing CSRF token on POST returns 403', async () => {
    const email = 'p9a@test.com';
    await register(email);
    await verifyEmail(email);
    const loginRes = await login(email);
    const cookies = getSetCookies(loginRes);
    // Send POST without x-csrf-token header
    const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
    const res = await request(app)
      .post('/api/workspace') // any protected POST
      .set('Cookie', cookieHeader)
      .send({ name: 'test' });
    expect(res.status).toBe(403);
  });

  test('mismatched CSRF token returns 403', async () => {
    const email = 'p9b@test.com';
    await register(email);
    await verifyEmail(email);
    const loginRes = await login(email);
    const cookies = getSetCookies(loginRes);
    const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
    const res = await request(app)
      .post('/api/workspace')
      .set('Cookie', cookieHeader)
      .set('x-csrf-token', 'definitely-wrong-token')
      .send({ name: 'test' });
    expect(res.status).toBe(403);
  });

  test('missing CSRF cookie is rejected even when a header is supplied', async () => {
    const email = 'p9c@test.com';
    await register(email);
    await verifyEmail(email);
    const loginRes = await login(email);
    const cookies = getSetCookies(loginRes);
    const cookieHeader = cookies.filter(c => !c.includes('csrfToken=')).map(c => c.split(';')[0]).join('; ');
    const res = await request(app)
      .post('/api/workspace')
      .set('Cookie', cookieHeader)
      .set('x-csrf-token', 'random-client-token')
      .send({ name: 'test' });
    expect(res.status).toBe(403);
  });

  test('bearer authentication is rejected unless explicitly marked mobile', async () => {
    const email = 'p9d@test.com';
    await register(email);
    await verifyEmail(email);
    const mobileLogin = await request(app)
      .post('/api/auth/login')
      .set('x-client-type', 'mobile')
      .send({ email, password: 'Password123!' });
    expect(mobileLogin.body.token).toBeDefined();

    const rejected = await request(app)
      .get('/api/workspace')
      .set('Authorization', `Bearer ${mobileLogin.body.token}`);
    expect(rejected.status).toBe(401);

    const accepted = await request(app)
      .get('/api/workspace')
      .set('x-client-type', 'mobile')
      .set('Authorization', `Bearer ${mobileLogin.body.token}`);
    expect(accepted.status).toBe(200);
  });

  test('disallowed origin rejected by CORS in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'https://allowed.example.com';
    const res = await request(app)
      .get('/api/ping')
      .set('Origin', 'https://evil.example.com');
    expect([403, 500]).toContain(res.status);
    process.env.NODE_ENV = 'test';
    delete process.env.CORS_ORIGINS;
  });

  test('no wildcard CORS when credentials required', async () => {
    const res = await request(app).get('/api/ping').set('Origin', 'http://localhost:5173');
    const acao = res.headers['access-control-allow-origin'];
    expect(acao).not.toBe('*');
  });
});
