const express = require('express');
const { register, login, verifyEmail, resendVerification, requestPasswordReset, resetPassword, refreshSession, logout, logoutAll, providerIntent, phoneIntent, getUser, updateUser, toggleFollow, uploadUserAvatar, deleteUser, deactivateUser } = require('../controllers/auth.controller');
const { requireAuth, requireVerifiedUser, requireUserId } = require('../middlewares/auth.middleware');
const { uploadAvatar } = require('../middlewares/upload.middleware');

const router = express.Router();

// ── Fully public — no authentication required ────────────────────────────────
router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.get('/verify-email', verifyEmail);
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

// ── requireAuth + requireVerifiedUser — normal application routes ─────────────
router.get('/:id', requireAuth, requireVerifiedUser, getUser);
router.put('/:id', requireAuth, requireVerifiedUser, updateUser);
router.post('/:id/follow', requireAuth, requireVerifiedUser, toggleFollow);
router.post('/:id/avatar', requireAuth, requireVerifiedUser, uploadAvatar.single('avatar'), uploadUserAvatar);

module.exports = router;
