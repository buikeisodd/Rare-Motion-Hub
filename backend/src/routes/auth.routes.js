const express = require('express');
const { register, login, getUser, updateUser, uploadUserAvatar, deleteUser } = require('../controllers/auth.controller');
const { requireUserId } = require('../middlewares/auth.middleware');
const { uploadAvatar } = require('../middlewares/upload.middleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

router.get('/:id', requireUserId, getUser);
router.put('/:id', requireUserId, updateUser);
router.post('/:id/avatar', requireUserId, uploadAvatar.single('avatar'), uploadUserAvatar);
router.delete('/:id', requireUserId, deleteUser);

module.exports = router;
