const express = require('express');
const {
  getCallGroup,
  joinCallGroup,
  leaveCallGroup,
  getCallSignals,
  sendCallSignal,
  getUsers,
  getFriends,
  createGroup,
  getGroupSettings,
  updateGroupSettings,
  uploadGroupAvatar,
  inviteGroupMember,
  getMessages,
  sendMessageController,
  sendMediaMessage,
  pinMessage,
  starMessage,
  deleteMessage,
  forwardMessage,
  getConversations,
  markNotificationsRead,
  markNotificationRead,
  clearReadNotifications
} = require('../controllers/chat.controller');
const { requireUserId } = require('../middlewares/auth.middleware');
const { uploadChatMedia, uploadGroupAvatar: uploadGroupAvatarFile } = require('../middlewares/upload.middleware');

const router = express.Router();

// Calls
router.get('/calls/group', requireUserId, getCallGroup);
router.post('/calls/group/join', requireUserId, joinCallGroup);
router.post('/calls/group/leave', requireUserId, leaveCallGroup);
router.get('/calls/group/signals', requireUserId, getCallSignals);
router.post('/calls/group/signals', requireUserId, sendCallSignal);

// Users (contacts)
router.get('/users', requireUserId, getUsers);
router.get('/friends', requireUserId, getFriends);

// Groups
router.post('/groups', requireUserId, createGroup);
router.get('/groups/:id', requireUserId, getGroupSettings);
router.patch('/groups/:id', requireUserId, updateGroupSettings);
router.post('/groups/:id/avatar', requireUserId, uploadGroupAvatarFile.single('avatar'), uploadGroupAvatar);
router.post('/groups/:id/invite', requireUserId, inviteGroupMember);

// Messages
router.get('/messages', requireUserId, getMessages);
router.post('/messages', requireUserId, sendMessageController);
router.post('/messages/media', requireUserId, uploadChatMedia.single('media'), sendMediaMessage);
router.patch('/messages/:id/pin', requireUserId, pinMessage);
router.patch('/messages/:id/star', requireUserId, starMessage);
router.delete('/messages/:id', requireUserId, deleteMessage);
router.post('/messages/:id/forward', requireUserId, forwardMessage);

// Conversations
router.get('/conversations', requireUserId, getConversations);

// Notifications
router.post('/notifications/read', requireUserId, markNotificationsRead);
router.delete('/notifications/read', requireUserId, clearReadNotifications);
router.patch('/notifications/:id/read', requireUserId, markNotificationRead);

module.exports = router;
