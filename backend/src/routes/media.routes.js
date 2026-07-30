const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/media.controller');
const { requireUserId } = require('../middlewares/auth.middleware');

// Public endpoint for streaming the main track
router.get('/tracks/:id', mediaController.streamTrack);

// Authenticated endpoints for track versions, note memos, and stems
router.get('/tracks/:id/versions/:versionId', requireUserId, mediaController.streamVersion);
router.get('/tracks/:id/note-memos/:memoId', requireUserId, mediaController.streamNoteMemo);
router.get('/stems/:trackId/:filename', requireUserId, mediaController.streamStem);

module.exports = router;
