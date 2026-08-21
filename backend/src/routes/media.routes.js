const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/media.controller');
const { optionalAuth } = require('../middlewares/auth.middleware');

// Public endpoint for streaming the main track
router.get('/tracks/:id', optionalAuth, mediaController.streamTrack);

// Authenticated endpoints for track versions, note memos, and stems
router.get('/tracks/:id/versions/:versionId', optionalAuth, mediaController.streamVersion);
router.get('/tracks/:id/note-memos/:memoId', optionalAuth, mediaController.streamNoteMemo);
router.get('/stems/:trackId/:filename', optionalAuth, mediaController.streamStem);

module.exports = router;
