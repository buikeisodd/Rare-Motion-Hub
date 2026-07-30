const express = require('express');
const {
  getCallGroup,
  joinCallGroup,
  leaveCallGroup,
  getCallSignals,
  sendCallSignal,
  getUsers,
  getMessages,
  sendMessageController,
  sendMediaMessage,
  pinMessage,
  deleteMessage,
  forwardMessage,
  getConversations,
  markNotificationsRead
} = require('../controllers/chat.controller');
const { requireUserId } = require('../middlewares/auth.middleware');
const { uploadChatMedia } = require('../middlewares/upload.middleware');

const router = express.Router();

// Calls
router.get('/calls/group', requireUserId, getCallGroup);
router.post('/calls/group/join', requireUserId, joinCallGroup);
router.post('/calls/group/leave', requireUserId, leaveCallGroup);
router.get('/calls/group/signals', requireUserId, getCallSignals);
router.post('/calls/group/signals', requireUserId, sendCallSignal);

// Users (contacts)
router.get('/users', requireUserId, getUsers);

// Messages
router.get('/messages', requireUserId, getMessages);
router.post('/messages', requireUserId, sendMessageController);
router.post('/messages/media', requireUserId, uploadChatMedia.single('media'), sendMediaMessage);
router.patch('/messages/:id/pin', requireUserId, pinMessage);
router.delete('/messages/:id', requireUserId, deleteMessage);
router.post('/messages/:id/forward', requireUserId, forwardMessage);

// Conversations
router.get('/conversations', requireUserId, getConversations);

// Notifications
router.post('/notifications/read', requireUserId, markNotificationsRead);

module.exports = router;
