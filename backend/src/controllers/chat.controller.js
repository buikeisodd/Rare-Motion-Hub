const { Message, User, ChatGroup, CallSignal, Call, Notification } = require('../models');
const { readDB, writeDB, ensureDBShape } = require('../utils/dbHelper');
const {
  makeId,
  publicUser,
  userExists,
  createMessage,
  notifyMessage,
  notifyCall,
  hydrateMessage,
  hydrateCall,
  BASE_URL
} = require('../utils/helpers');
const { invalidateCache } = require('../config/redis');
const { cloudinary, hasCloudinaryConfig } = require('../config/cloudinary');
const { AppError } = require('../middlewares/error.middleware');
const { ensureUserDir, removeFileIfExists, chatDir } = require('../utils/fileHelper');
const fs = require('fs');
const path = require('path');

const getDirectMessageAccess = async (senderId, recipientId) => {
  const [sender, recipient, previous] = await Promise.all([
    User.findOne({ id: senderId }).lean(),
    User.findOne({ id: recipientId }).lean(),
    Message.find({
      conversationType: 'dm',
      $or: [
        { senderId, recipientId },
        { senderId: recipientId, recipientId: senderId }
      ]
    }).lean()
  ]);
  if (!sender || !recipient) return { error: 'User not found.', status: 404 };
  const connected = (sender.following || []).includes(recipientId) || (recipient.following || []).includes(senderId);
  if (connected) return { kind: 'message' };
  const hasIncomingRequest = previous.some((message) => message.senderId === recipientId && message.recipientId === senderId && message.messageKind === 'request');
  if (hasIncomingRequest) return { kind: 'message' };
  if (previous.some((message) => message.senderId === senderId && message.recipientId === recipientId)) {
    return { error: 'You have already sent a message request to this user.', status: 403 };
  }
  return { kind: 'request' };
};

const storeChatMedia = async (file, userId) => {
  if (hasCloudinaryConfig) {
    try {
      const uploadResult = await cloudinary.uploader.upload_large(file.path, {
        resource_type: 'auto',
        folder: 'raremotionhub/chat'
      });
      removeFileIfExists(file.path);
      return uploadResult.secure_url;
    } catch (error) {
      console.error('Cloudinary chat upload failed, keeping local file:', error.message);
    }
  }
  const userDir = ensureUserDir(chatDir, userId);
  const filename = path.basename(file.filename || `${Date.now()}-${file.originalname || 'media'}`).replace(/\s+/g, '_');
  const destination = path.join(userDir, filename);
  fs.renameSync(file.path, destination);
  return `${BASE_URL}/uploads/chat/${userId}/${filename}`;
};

const getCallGroup = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const userId = req.userId;
    if (!userExists(db, userId)) return next(new AppError('Unauthorized user.', 401));
    const call = db.calls.find((item) => item.type === 'group' && item.active);
    res.json({ call: hydrateCall(db, call) });
  } catch (error) {
    next(error);
  }
};

const joinCallGroup = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const userId = req.userId;
    const caller = db.users.find((user) => user.id === userId);
    if (!caller) return next(new AppError('Unauthorized user.', 401));

    let call = db.calls.find((item) => item.type === 'group' && item.active);
    const isNewCall = !call;
    if (!call) {
      call = {
        id: makeId(),
        type: 'group',
        active: true,
        startedById: userId,
        participantIds: [],
        startedAt: new Date().toISOString()
      };
      db.calls.push(call);
    }

    if (!call.participantIds.includes(userId)) call.participantIds.push(userId);
    call.updatedAt = new Date().toISOString();
    if (isNewCall) notifyCall(db, call, caller);
    await writeDB(db);
    res.json({ call: hydrateCall(db, call) });
  } catch (error) {
    next(error);
  }
};

const leaveCallGroup = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const userId = req.userId;
    if (!userExists(db, userId)) return next(new AppError('Unauthorized user.', 401));
    const call = db.calls.find((item) => item.type === 'group' && item.active);
    if (!call) return res.json({ call: null });

    call.participantIds = (call.participantIds || []).filter((id) => id !== userId);
    call.updatedAt = new Date().toISOString();
    if (call.participantIds.length === 0) {
      call.active = false;
      call.endedAt = new Date().toISOString();
    }
    db.callSignals = db.callSignals.filter((signal) => signal.callId !== call.id || (signal.fromUserId !== userId && signal.toUserId !== userId));
    await writeDB(db);
    res.json({ call: hydrateCall(db, call.active ? call : null) });
  } catch (error) {
    next(error);
  }
};

const getCallSignals = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const userId = req.userId;
    if (!userExists(db, userId)) return next(new AppError('Unauthorized user.', 401));
    const call = db.calls.find((item) => item.type === 'group' && item.active);
    if (!call) return res.json({ signals: [] });

    const signals = db.callSignals
      .filter((signal) => signal.callId === call.id && signal.toUserId === userId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    res.json({ signals });
  } catch (error) {
    next(error);
  }
};

const sendCallSignal = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const { toUserId, type, payload } = req.body;
    const userId = req.userId;
    if (!userExists(db, userId) || !userExists(db, toUserId)) return next(new AppError('Unauthorized user.', 401));
    const call = db.calls.find((item) => item.type === 'group' && item.active);
    if (!call) return next(new AppError('No active call.', 404));
    if (!call.participantIds.includes(userId) || !call.participantIds.includes(toUserId)) {
      return next(new AppError('Both users must be in the call.', 403));
    }

    const signal = {
      id: makeId(),
      callId: call.id,
      fromUserId: userId,
      toUserId,
      type,
      payload,
      createdAt: new Date().toISOString()
    };
    db.callSignals.push(signal);
    await writeDB(db);
    res.json({ signal });
  } catch (error) {
    next(error);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const userId = req.userId;
    const [allUsers, actor] = await Promise.all([
      User.find({
        id: { $ne: userId },
        isDeactivated: { $ne: true },
        isSuspended: { $ne: true }
      }).lean(),
      User.findOne({ id: userId }).lean()
    ]);
    
    const followingSet = new Set(actor?.following || []);
    const followersSet = new Set(actor?.followers || []);

    const others = allUsers.map((user) => {
      const isFollowing = followingSet.has(user.id) || (user.followers || []).includes(userId);
      const followsYou = followersSet.has(user.id) || (user.following || []).includes(userId);
      return {
        ...publicUser(user),
        isFollowing: Boolean(isFollowing),
        followsYou: Boolean(followsYou)
      };
    });
    res.json({ users: others });
  } catch (error) {
    next(error);
  }
};

const areConnected = (a, b) => (
  (a.following || []).includes(b.id) ||
  (a.followers || []).includes(b.id) ||
  (b.following || []).includes(a.id) ||
  (b.followers || []).includes(a.id)
);

const createGroup = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const userId = req.userId;
    const actor = db.users.find((user) => user.id === userId);
    if (!actor) return next(new AppError('Unauthorized user.', 401));

    const name = String(req.body.name || 'New group').trim().slice(0, 60);
    const requestedIds = [...new Set(req.body.participantIds || [])].filter((id) => id && id !== userId);
    const participants = requestedIds
      .map((id) => db.users.find((user) => user.id === id))
      .filter(Boolean);
    const blocked = participants.find((participant) => !areConnected(actor, participant));
    if (blocked) return next(new AppError('You can only add followers to a group.', 403));
    if (participants.length === 0) return next(new AppError('Add at least one follower to create a group.', 400));

    const group = {
      id: makeId(),
      name,
      createdById: userId,
      participantIds: [userId, ...participants.map((participant) => participant.id)],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await ChatGroup.create(group);
    res.status(201).json({ group: { ...group, participants: group.participantIds.map((id) => publicUser(db.users.find((user) => user.id === id))) } });
  } catch (error) {
    next(error);
  }
};

const getMessages = async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) return next(new AppError('userId required.', 400));
    const { type, partnerId } = req.query;

    let msgs;
    if (type === 'group') {
      const groupId = req.query.groupId;
      if (!groupId) return next(new AppError('groupId required for group messages.', 400));
      const group = await ChatGroup.findOne({ id: groupId }).lean();
      if (!group || !(group.participantIds || []).includes(userId)) return next(new AppError('Group not found.', 404));
      msgs = await Message.find({ conversationType: 'group', groupId }).lean().sort({ createdAt: 1 });
    } else {
      if (!partnerId) return next(new AppError('partnerId required for DM.', 400));
      msgs = await Message.find({
        conversationType: 'dm',
        $or: [
          { senderId: userId, recipientId: partnerId },
          { senderId: partnerId, recipientId: userId }
        ]
      }).lean().sort({ createdAt: 1 });
    }

    const senderIds = [...new Set(msgs.map(m => m.senderId).filter(Boolean))];
    const senders = await User.find({ id: { $in: senderIds } }).lean();
    const senderMap = Object.fromEntries(senders.map(u => [u.id, u]));

    const hydrated = msgs.map(m => ({
      ...m,
      sender: senderMap[m.senderId] ? {
        id: senderMap[m.senderId].id,
        name: senderMap[m.senderId].name,
        avatarUrl: senderMap[m.senderId].avatarUrl || '',
      } : { id: m.senderId, name: 'Unknown', avatarUrl: '' },
      replyTo: null
    }));

    Message.updateMany(
      type === 'group'
        ? { conversationType: 'group', groupId: req.query.groupId, readBy: { $ne: userId } }
        : { conversationType: 'dm', senderId: partnerId, recipientId: userId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    ).catch(() => {});

    let participants = [];
    if (type === 'group') {
      const group = await ChatGroup.findOne({ id: req.query.groupId }).lean();
      const users = await User.find({ id: { $in: group?.participantIds || [] } }).lean();
      participants = users.map(u => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl || '' }));
    }

    res.json({ messages: hydrated, participants });
  } catch (error) {
    next(error);
  }
};

const sendMessageController = async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { recipientId, groupId, conversationType, text, replyToMessageId } = body;
    const senderId = req.userId;
    if (!text?.trim()) return next(new AppError('text required.', 400));
    const type = conversationType || 'dm';
    if (type === 'dm' && !recipientId) return next(new AppError('recipientId required for DM.', 400));
    if (type === 'group' && !groupId) return next(new AppError('groupId required for group message.', 400));

    const db = ensureDBShape(await readDB());
    const sender = db.users.find((user) => user.id === senderId);
    if (!sender) return next(new AppError('Unauthorized user.', 401));

    let access = { kind: 'message' };
    if (type === 'dm') access = await getDirectMessageAccess(senderId, recipientId);
    if (type === 'group') {
      const group = db.groups.find((item) => item.id === groupId);
      if (!group || !(group.participantIds || []).includes(senderId)) return next(new AppError('Group not found.', 404));
    }
    if (access.error) return next(new AppError(access.error, access.status));

    const msg = createMessage(db, {
      senderId,
      conversationType: type,
      recipientId,
      groupId: type === 'group' ? groupId : null,
      messageKind: access.kind,
      text,
      replyToMessageId: replyToMessageId || null
    });

    db.messages.push(msg);
    notifyMessage(db, msg);
    await writeDB(db);
    const notificationRecipients = type === 'group'
      ? (db.groups.find((group) => group.id === groupId)?.participantIds || []).filter((id) => id !== senderId)
      : [recipientId];
    await Promise.all(notificationRecipients.map((recipientId) => invalidateCache(`workspace:${recipientId}`)));
    res.json({ message: hydrateMessage(db, msg) });
  } catch (error) {
    next(error);
  }
};

const sendMediaMessage = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('No media uploaded.', 400));
    const db = ensureDBShape(await readDB());
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { recipientId, groupId, conversationType, text, replyToMessageId, mediaKind } = body;
    const senderId = req.userId;
    const type = conversationType || 'dm';
    if (!userExists(db, senderId)) {
      if (req.file) removeFileIfExists(req.file.path);
      return next(new AppError('Unauthorized user.', 401));
    }
    if (type === 'dm' && !recipientId) {
      if (req.file) removeFileIfExists(req.file.path);
      return next(new AppError('recipientId required for DM.', 400));
    }

    let access = type === 'dm' ? await getDirectMessageAccess(senderId, recipientId) : { kind: 'message' };
    if (type === 'group') {
      const group = db.groups.find((item) => item.id === groupId);
      if (!group || !(group.participantIds || []).includes(senderId)) {
        removeFileIfExists(req.file.path);
        return next(new AppError('Group not found.', 404));
      }
    }
    if (access.error) { removeFileIfExists(req.file.path); return next(new AppError(access.error, access.status)); }

    const attachmentType = req.file.mimetype.startsWith('image/')
      ? 'image'
      : req.file.mimetype.startsWith('video/')
        ? 'video'
        : 'voice';
    if (attachmentType === 'voice' && mediaKind !== 'voice') {
      if (req.file) removeFileIfExists(req.file.path);
      return next(new AppError('Only photos and videos can be shared from files.', 400));
    }

    const mediaUrl = await storeChatMedia(req.file, senderId);

    const msg = createMessage(db, {
      senderId,
      recipientId,
      groupId,
      conversationType: type,
      messageKind: access.kind,
      text: text || '',
      replyToMessageId: replyToMessageId || null,
      attachments: [{
        id: makeId(),
        type: attachmentType,
        url: mediaUrl,
        name: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
      }]
    });

    db.messages.push(msg);
    notifyMessage(db, msg);
    await writeDB(db);
    res.json({ message: hydrateMessage(db, msg) });
  } catch (error) {
    next(error);
  }
};

const pinMessage = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const { pinned } = req.body;
    const userId = req.userId;
    const message = db.messages.find((item) => item.id === req.params.id);
    if (!message) return next(new AppError('Message not found.', 404));
    if (!userExists(db, userId)) return next(new AppError('Unauthorized user.', 401));
    
    message.pinned = Boolean(pinned);
    message.pinnedBy = pinned ? userId : null;
    message.pinnedAt = pinned ? new Date().toISOString() : null;
    await writeDB(db);
    res.json({ message: hydrateMessage(db, message) });
  } catch (error) {
    next(error);
  }
};

const deleteMessage = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const userId = req.userId;
    const message = db.messages.find((item) => item.id === req.params.id);
    if (!message) return next(new AppError('Message not found.', 404));
    if (message.senderId !== userId) return next(new AppError('Only the sender can delete this message.', 403));
    
    message.deleted = true;
    message.text = '';
    message.attachments = [];
    message.deletedAt = new Date().toISOString();
    await writeDB(db);
    res.json({ message: hydrateMessage(db, message) });
  } catch (error) {
    next(error);
  }
};

const forwardMessage = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const { targetType, recipientId, groupId } = req.body;
    const senderId = req.userId;
    const source = db.messages.find((item) => item.id === req.params.id);
    if (!source) return next(new AppError('Message not found.', 404));
    if (!userExists(db, senderId)) return next(new AppError('Unauthorized user.', 401));
    if (targetType === 'dm' && !recipientId) return next(new AppError('recipientId required for DM forward.', 400));
    if (targetType === 'group') {
      const group = db.groups.find((item) => item.id === groupId);
      if (!group || !(group.participantIds || []).includes(senderId)) return next(new AppError('Group not found.', 404));
    }

    const msg = createMessage(db, {
      senderId,
      recipientId,
      conversationType: targetType,
      groupId: targetType === 'group' ? groupId : null,
      text: source.text || '',
      attachments: source.attachments || [],
      forwardedFrom: { id: source.id, senderId: source.senderId }
    });
    db.messages.push(msg);
    notifyMessage(db, msg);
    await writeDB(db);
    res.json({ message: hydrateMessage(db, msg) });
  } catch (error) {
    next(error);
  }
};

const getConversations = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const userId = req.userId;
    if (!userExists(db, userId)) return next(new AppError('Unauthorized user.', 401));

    const conversations = [];

    const userGroupIds = db.groups
      .filter((group) => (group.participantIds || []).includes(userId))
      .map((group) => group.id);
    const allMessages = await Message.find({
      $or: [
        { conversationType: 'group', groupId: { $in: userGroupIds } },
        { conversationType: 'dm', $or: [{ senderId: userId }, { recipientId: userId }] }
      ]
    }).lean();
    db.messages = allMessages;

    for (const group of db.groups.filter((item) => (item.participantIds || []).includes(userId))) {
      const groupMsgs = db.messages.filter((m) => m.conversationType === 'group' && m.groupId === group.id);
      const lastGroup = groupMsgs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
      const groupUnreadCount = groupMsgs.filter((m) => m.senderId !== userId && !(m.readBy || []).includes(userId)).length;
      conversations.push({
        type: 'group',
        group: { id: group.id, name: group.name },
        partner: null,
        participants: (group.participantIds || []).map((id) => publicUser(db.users.find((user) => user.id === id))).filter(Boolean),
        lastMessage: lastGroup ? hydrateMessage(db, lastGroup) : null,
        unreadCount: groupUnreadCount,
        updatedAt: lastGroup?.createdAt || group.updatedAt || group.createdAt
      });
    }

    const partnerIds = [...new Set(db.messages.flatMap((m) => m.conversationType === 'dm' ? [m.senderId, m.recipientId] : []).filter((id) => id && id !== userId))];
    for (const partnerId of partnerIds) {
      const other = db.users.find((user) => user.id === partnerId);
      if (!other) continue;
      const msgs = db.messages.filter(
        (m) => m.conversationType === 'dm' &&
          ((m.senderId === userId && m.recipientId === other.id) ||
            (m.senderId === other.id && m.recipientId === userId))
      );
      const last = msgs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
      const unreadCount = msgs.filter((m) => m.senderId === other.id && !(m.readBy || []).includes(userId)).length;
      conversations.push({
        type: 'dm',
        partner: publicUser(other),
        lastMessage: last ? hydrateMessage(db, last) : null,
        isRequest: Boolean(last?.messageKind === 'request' && last.senderId === other.id),
        unreadCount,
        updatedAt: last?.createdAt || null
      });
    }

    conversations.sort((a, b) => {
      if (!a.updatedAt && !b.updatedAt) return 0;
      if (!a.updatedAt) return 1;
      if (!b.updatedAt) return -1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    res.json({ conversations });
  } catch (error) {
    next(error);
  }
};

const markNotificationsRead = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const userId = req.userId;

    db.notifications.forEach((notif) => {
      if (String(notif.userId) === String(userId)) notif.read = true;
    });

    await writeDB(db);
    await Notification.updateMany({ userId }, { $set: { read: true } });
    invalidateCache(`workspace:${userId}`);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const userId = String(req.userId);
    const notificationId = String(req.params.id);
    const notification = db.notifications.find((item) => (
      String(item.id) === notificationId && String(item.userId) === userId
    ));

    if (!notification) return next(new AppError('Notification not found.', 404));

    notification.read = true;
    await writeDB(db);
    await Notification.updateOne(
      { id: notificationId, userId },
      { $set: { read: true } }
    );
    invalidateCache(`workspace:${userId}`);
    res.json({ success: true, notification });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCallGroup,
  joinCallGroup,
  leaveCallGroup,
  getCallSignals,
  sendCallSignal,
  getUsers,
  createGroup,
  getMessages,
  sendMessageController,
  sendMediaMessage,
  pinMessage,
  deleteMessage,
  forwardMessage,
  getConversations,
  markNotificationsRead,
  markNotificationRead
};
