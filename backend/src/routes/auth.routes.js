const express = require('express');
const { register, login, verifyEmail, resendVerification, requestPasswordReset, resetPassword, providerIntent, phoneIntent, getUser, updateUser, toggleFollow, uploadUserAvatar, deleteUser, deactivateUser } = require('../controllers/auth.controller');
const { requireUserId } = require('../middlewares/auth.middleware');
const { uploadAvatar } = require('../middlewares/upload.middleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.post('/provider-intent', providerIntent);
router.post('/phone-intent', phoneIntent);

router.get('/:id', requireUserId, getUser);
router.put('/:id', requireUserId, updateUser);
router.post('/:id/follow', requireUserId, toggleFollow);
router.post('/:id/avatar', requireUserId, uploadAvatar.single('avatar'), uploadUserAvatar);
router.delete('/:id', requireUserId, deleteUser);
router.post('/:id/deactivate', requireUserId, deactivateUser);

module.exports = router;
