const express = require('express');
const { register, login, verifyEmail, verifyEmailDirect, resendVerification, requestPasswordReset, resetPassword, refreshSession, logout, logoutAll, providerIntent, phoneIntent, getUser, updateUser, toggleFollow, uploadUserAvatar, deleteUser, deactivateUser, suspendUser, unsuspendUser } = require('../controllers/auth.controller');
const { requireAuth, requireVerifiedUser, requireUserId, readAuthCookie } = require('../middlewares/auth.middleware');
const { uploadAvatar } = require('../middlewares/upload.middleware');

const router = express.Router();

// ── Fully public — no authentication required ────────────────────────────────
router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.get('/verify-email', verifyEmail);
router.post('/verify-email-direct', verifyEmailDirect);
router.post('/resend-verification', resendVerification);
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.post('/refresh', refreshSession);
router.post('/provider-intent', providerIntent);
router.post('/phone-intent', phoneIntent);

// ── requireAuth only — must work for any authenticated user regardless of
//    account state (a deactivated/unverified user must still be able to
//    log out or delete their account) ─────────────────────────────────────────
router.post('/logout', logout);
router.post('/logout-all', requireAuth, logoutAll);
router.delete('/:id', requireAuth, deleteUser);
router.post('/:id/deactivate', requireAuth, deactivateUser);
router.post('/:id/suspend', requireAuth, suspendUser);
router.post('/:id/unsuspend', requireAuth, unsuspendUser);

// ── requireAuth + requireVerifiedUser — normal application routes ─────────────
router.get('/me', requireAuth, requireVerifiedUser, (req, res) => {
  // Returns the live, server-side user state from req.user (set by requireAuth
  // via a fresh User.findOne). Frontend uses this on startup to restore session
  // without rotating the refresh token unnecessarily.
  const { deriveAccountStatus } = require('../controllers/auth.controller');
  const status = req.user.accountStatus || deriveAccountStatus(req.user);
  const csrfCookie = readAuthCookie(req, 'csrfToken');
  if (csrfCookie) {
    res.set('x-csrf-token', csrfCookie);
  }
  res.json({ user: { ...req.user, accountStatus: status } });
});
router.get('/:id', requireAuth, requireVerifiedUser, getUser);
router.put('/:id', requireAuth, requireVerifiedUser, updateUser);
router.post('/:id/follow', requireAuth, requireVerifiedUser, toggleFollow);
router.post('/:id/avatar', requireAuth, requireVerifiedUser, uploadAvatar.single('avatar'), uploadUserAvatar);

module.exports = router;
