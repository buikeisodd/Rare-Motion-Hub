const express = require('express');
const { requireUserId } = require('../middlewares/auth.middleware');
const { listLive, startLive, endLive, joinLive } = require('../controllers/live.controller');
const router = express.Router();
router.get('/', requireUserId, listLive);
router.post('/', requireUserId, startLive);
router.post('/:id/join', requireUserId, joinLive);
router.post('/:id/end', requireUserId, endLive);
module.exports = router;
