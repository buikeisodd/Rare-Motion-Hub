const express = require('express');
const { requireUserId } = require('../middlewares/auth.middleware');
const { getStories, createStory, deleteStory } = require('../controllers/story.controller');
const router = express.Router();
router.get('/stories', requireUserId, getStories);
router.post('/stories', requireUserId, createStory);
router.delete('/stories/:id', requireUserId, deleteStory);
module.exports = router;
