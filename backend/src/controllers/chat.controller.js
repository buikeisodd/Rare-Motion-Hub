const { Message, User, CallSignal, Call, Notification } = require('../models');
const { readDB, writeDB, ensureDBShape } = require('../utils/dbHelper');
const {
  makeId,
  publicUser,
  userExists,
  createMessage,
  notifyMessage,
  notifyCall,
  hydrateMessage,
  hydrateCall
} = require('../utils/helpers');
const { invalidateCache } = require('../config/redis');
const { cloudinary } = require('../config/cloudinary');
const { AppError } = require('../middlewares/error.middleware');

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
    const { userId } = req.body;
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
    const { userId } = req.body;
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
    const { userId, toUserId, type, payload } = req.body;
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
    const db = ensureDBShape(await readDB());
    const userId = req.userId;
    if (!userExists(db, userId)) return next(new AppError('Unauthorized user.', 401));
    const others = db.users.filter((u) => u.id !== userId).map(publicUser);
    res.json({ users: others });
  } catch (error) {
    next(error);
  }
};

const getMessages = async (req, res, next) => {
  try {
    const userId = req.query.userId;
    if (!userId) return next(new AppError('userId required.', 400));
    const { type, partnerId } = req.query;

    let msgs;
    if (type === 'group') {
      msgs = await Message.find({ conversationType: 'group' }).lean().sort({ createdAt: 1 });
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
        ? { conversationType: 'group', readBy: { $ne: userId } }
        : { conversationType: 'dm', senderId: partnerId, recipientId: userId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    ).catch(() => {});

    let participants = [];
    if (type === 'group') {
      const users = await User.find({}).lean();
      participants = users.map(u => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl || '' }));
    }

    res.json({ messages: hydrated, participants });
  } catch (error) {
    next(error);
  }
};

const sendMessageController = async (req, res, next) => {
  try {
    const { senderId, recipientId, conversationType, text, replyToMessageId } = req.body;
    if (!senderId || !text?.trim()) return next(new AppError('senderId and text required.', 400));
    if (conversationType === 'dm' && !recipientId) return next(new AppError('recipientId required for DM.', 400));

    const sender = await User.findOne({ id: senderId }).lean();
    if (!sender) return next(new AppError('Unauthorized user.', 401));

    const type = conversationType || 'dm';
    const msg = {
      id: makeId(),
      senderId,
      recipientId: type === 'group' ? null : recipientId,
      conversationType: type,
      text: text.trim(),
      attachments: [],
      replyToMessageId: replyToMessageId || null,
      pinned: false,
      deleted: false,
      readBy: [],
      createdAt: new Date().toISOString()
    };

    await Message.create(msg);

    const hydrated = {
      ...msg,
      sender: { id: sender.id, name: sender.name, avatarUrl: sender.avatarUrl || '' },
    };

    User.find({}).lean().then(users => {
      const db = ensureDBShape({ users, messages: [msg], notifications: [] });
      notifyMessage(db, msg);
      const newNotifs = db.notifications.filter(n => n.id);
      newNotifs.forEach(n => Notification.findOneAndUpdate({ id: n.id }, n, { upsert: true }).catch(() => {}));
    }).catch(() => {});

    res.json({ message: hydrated });
  } catch (error) {
    next(error);
  }
};

const sendMediaMessage = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('No media uploaded.', 400));
    const db = ensureDBShape(await readDB());
    const { senderId, recipientId, conversationType, text, replyToMessageId, mediaKind } = req.body;
    if (!senderId || !userExists(db, senderId)) {
      if (req.file.filename) {
        cloudinary.uploader.destroy(req.file.filename, { resource_type: 'auto' }).catch(console.error);
      }
      return next(new AppError('Unauthorized user.', 401));
    }
    if (conversationType === 'dm' && !recipientId) {
      if (req.file.filename) {
        cloudinary.uploader.destroy(req.file.filename, { resource_type: 'auto' }).catch(console.error);
      }
      return next(new AppError('recipientId required for DM.', 400));
    }

    const attachmentType = req.file.mimetype.startsWith('image/')
      ? 'image'
      : req.file.mimetype.startsWith('video/')
        ? 'video'
        : 'voice';
    if (attachmentType === 'voice' && mediaKind !== 'voice') {
      if (req.file.filename) {
        cloudinary.uploader.destroy(req.file.filename, { resource_type: 'auto' }).catch(console.error);
      }
      return next(new AppError('Only photos and videos can be shared from files.', 400));
    }

    const msg = createMessage(db, {
      senderId,
      recipientId,
      conversationType,
      text: text || '',
      replyToMessageId: replyToMessageId || null,
      attachments: [{
        id: makeId(),
        type: attachmentType,
        url: req.file.path, // Cloudinary URL
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
    const { userId, pinned } = req.body;
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
    const { senderId, targetType, recipientId } = req.body;
    const source = db.messages.find((item) => item.id === req.params.id);
    if (!source) return next(new AppError('Message not found.', 404));
    if (!userExists(db, senderId)) return next(new AppError('Unauthorized user.', 401));
    if (targetType === 'dm' && !recipientId) return next(new AppError('recipientId required for DM forward.', 400));

    const msg = createMessage(db, {
      senderId,
      recipientId,
      conversationType: targetType,
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

    const others = db.users.filter((u) => u.id !== userId);
    const conversations = [];

    const allMessages = await Message.find({
      $or: [
        { conversationType: 'group' },
        { conversationType: 'dm', $or: [{ senderId: userId }, { recipientId: userId }] }
      ]
    }).lean();
    db.messages = allMessages;

    const groupMsgs = db.messages.filter((m) => m.conversationType === 'group');
    const lastGroup = groupMsgs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
    const groupUnreadCount = groupMsgs.filter((m) => m.senderId !== userId && !(m.readBy || []).includes(userId)).length;
    conversations.push({
      type: 'group',
      partner: null,
      participants: db.users.map(publicUser),
      lastMessage: lastGroup ? hydrateMessage(db, lastGroup) : null,
      unreadCount: groupUnreadCount,
      updatedAt: lastGroup?.createdAt || '9999'
    });

    for (const other of others) {
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
      if (notif.userId === userId) {
        notif.read = true;
      }
    });

    await writeDB(db);
    res.json({ success: true });
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
  getMessages,
  sendMessageController,
  sendMediaMessage,
  pinMessage,
  deleteMessage,
  forwardMessage,
  getConversations,
  markNotificationsRead
};
