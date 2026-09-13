const express = require('express');
const { requireUserId } = require('../middlewares/auth.middleware');
const { uploadMarketplace } = require('../middlewares/upload.middleware');
const { createBeat, listBeats } = require('../controllers/marketplace.controller');
const router = express.Router();
router.get('/beats', requireUserId, listBeats);
router.post('/beats', requireUserId, uploadMarketplace.fields([{ name: 'beat', maxCount: 1 }, { name: 'agreement', maxCount: 1 }]), createBeat);
module.exports = router;
