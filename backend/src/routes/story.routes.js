const express = require('express');
const { requireUserId } = require('../middlewares/auth.middleware');
const { getStories, createStory, deleteStory, likeStory } = require('../controllers/story.controller');
const router = express.Router();
router.get('/stories', requireUserId, getStories);
router.post('/stories', requireUserId, createStory);
router.delete('/stories/:id', requireUserId, deleteStory);
router.post('/stories/:id/like', requireUserId, likeStory);
module.exports = router;
