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

const areFriends = (a, b) => (
  (a.following || []).includes(b.id) &&
  (b.following || []).includes(a.id)
);

const getFriends = async (req, res, next) => {
  try {
    const actor = await User.findOne({ id: req.userId }).lean();
    if (!actor) return next(new AppError('Unauthorized user.', 401));
    const following = new Set(actor.following || []);
    const users = await User.find({
      id: { $in: [...following], $ne: req.userId },
      isDeactivated: { $ne: true },
      isSuspended: { $ne: true }
    }).lean();
    const friends = users.filter((user) => (user.following || []).includes(req.userId));
    res.json({ friends: friends.map(publicUser) });
  } catch (error) {
    next(error);
  }
};

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
    const blocked = participants.find((participant) => !areFriends(actor, participant));
    if (blocked) return next(new AppError('You can only add mutual friends to a group.', 403));
    if (participants.length === 0) return next(new AppError('Add at least one follower to create a group.', 400));

    const group = {
      id: makeId(),
      name,
      createdById: userId,
      adminId: userId,
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

const getGroupSettings = async (req, res, next) => {
  try {
    const group = await ChatGroup.findOne({ id: req.params.id }).lean();
    if (!group || !(group.participantIds || []).includes(req.userId)) return next(new AppError('Group not found.', 404));
    const members = await User.find({ id: { $in: group.participantIds || [] } }).lean();
    res.json({ group: { ...group, participants: members.map(publicUser) } });
  } catch (error) { next(error); }
};

const updateGroupSettings = async (req, res, next) => {
  try {
    const group = await ChatGroup.findOne({ id: req.params.id });
    if (!group || !(group.participantIds || []).includes(req.userId)) return next(new AppError('Group not found.', 404));
    const isAdmin = (group.adminId || group.createdById) === req.userId;
    const body = req.body || {};
    if (body.name !== undefined && (isAdmin || group.membersCanEdit)) group.name = String(body.name).trim().slice(0, 60) || group.name;
    if (body.avatarUrl !== undefined && (isAdmin || group.membersCanEdit)) group.avatarUrl = String(body.avatarUrl).slice(0, 1000);
    if (!isAdmin && (body.messagingOpen !== undefined || body.membersCanEdit !== undefined || body.membersCanInvite !== undefined)) return next(new AppError('Only the group admin can change group permissions.', 403));
    if (isAdmin) {
      if (body.messagingOpen !== undefined) group.messagingOpen = Boolean(body.messagingOpen);
      if (body.membersCanEdit !== undefined) group.membersCanEdit = Boolean(body.membersCanEdit);
      if (body.membersCanInvite !== undefined) group.membersCanInvite = Boolean(body.membersCanInvite);
    }
    group.updatedAt = new Date().toISOString();
    await group.save();
    res.json({ group: group.toObject() });
  } catch (error) { next(error); }
};

const inviteGroupMember = async (req, res, next) => {
  try {
    const group = await ChatGroup.findOne({ id: req.params.id });
    if (!group || !(group.participantIds || []).includes(req.userId)) return next(new AppError('Group not found.', 404));
    const isAdmin = (group.adminId || group.createdById) === req.userId;
    if (!isAdmin && !group.membersCanInvite) return next(new AppError('Only the admin can invite members.', 403));
    const actor = await User.findOne({ id: req.userId }).lean();
    const invitee = await User.findOne({ id: req.body?.userId }).lean();
    if (!invitee || !areFriends(actor, invitee)) return next(new AppError('You can only invite mutual friends.', 403));
    if (!(group.participantIds || []).includes(invitee.id)) {
      group.groupRequests = (group.groupRequests || []).filter((request) => request.userId !== invitee.id || request.status !== 'pending');
      group.groupRequests.push({ userId: invitee.id, status: 'pending', createdAt: new Date().toISOString() });
    }
    await group.save();
    res.json({ group: group.toObject() });
  } catch (error) { next(error); }
};

const getGroupRequests = async (req, res, next) => {
  try {
    const groups = await ChatGroup.find({ 'groupRequests': { $elemMatch: { userId: req.userId, status: 'pending' } } }).lean();
    const requests = groups.map((group) => ({ groupId: group.id, groupName: group.name, avatarUrl: group.avatarUrl || '', fromId: group.createdById, createdAt: group.groupRequests.find((request) => request.userId === req.userId && request.status === 'pending')?.createdAt }));
    res.json({ requests });
  } catch (error) { next(error); }
};

const respondToGroupRequest = async (req, res, next) => {
  try {
    const group = await ChatGroup.findOne({ id: req.params.id });
    const request = group?.groupRequests?.find((item) => item.userId === req.userId && item.status === 'pending');
    if (!group || !request) return next(new AppError('Group request not found.', 404));
    request.status = req.body?.action === 'accept' ? 'accepted' : 'declined';
    if (request.status === 'accepted' && !group.participantIds.includes(req.userId)) group.participantIds.push(req.userId);
    await group.save();
    res.json({ success: true, group: group.toObject() });
  } catch (error) { next(error); }
};

const leaveGroup = async (req, res, next) => {
  try {
    const group = await ChatGroup.findOne({ id: req.params.id });
    if (!group || !(group.participantIds || []).includes(req.userId)) return next(new AppError('Group not found.', 404));
    if ((group.adminId || group.createdById) === req.userId) return next(new AppError('The admin must delete the group or transfer admin access before leaving.', 400));
    group.participantIds = group.participantIds.filter((id) => id !== req.userId);
    await group.save();
    res.json({ success: true, groupId: group.id });
  } catch (error) { next(error); }
};

const uploadGroupAvatar = async (req, res, next) => {
  let uploadedPublicId = '';
  try {
    if (!req.file) return next(new AppError('No group image uploaded.', 400));
    const group = await ChatGroup.findOne({ id: req.params.id });
    if (!group || !(group.participantIds || []).includes(req.userId)) return next(new AppError('Group not found.', 404));
    const isAdmin = (group.adminId || group.createdById) === req.userId;
    if (!isAdmin && !group.membersCanEdit) return next(new AppError('Only permitted group members can change the group image.', 403));

    let avatarUrl = `${BASE_URL}/avatars/${req.file.filename}`;
    if (hasCloudinaryConfig) {
      const assetId = `group-${group.id}-${makeId()}`;
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: 'raremotionhub/group-avatars',
        public_id: assetId,
        resource_type: 'image'
      });
      uploadedPublicId = uploadResult.public_id;
      avatarUrl = uploadResult.secure_url;
      removeFileIfExists(req.file.path);
    }

    const previousPublicId = group.avatarPublicId;
    group.avatarUrl = avatarUrl;
    group.avatarPublicId = uploadedPublicId;
    group.updatedAt = new Date().toISOString();
    try {
      await group.save();
    } catch (saveError) {
      if (uploadedPublicId && hasCloudinaryConfig) await cloudinary.uploader.destroy(uploadedPublicId, { resource_type: 'image' }).catch(() => {});
      throw saveError;
    }
    if (previousPublicId && previousPublicId !== uploadedPublicId && hasCloudinaryConfig) {
      await cloudinary.uploader.destroy(previousPublicId, { resource_type: 'image' }).catch(() => {});
    }
    res.json({ group: group.toObject() });
  } catch (error) {
    if (req.file?.path && !uploadedPublicId) removeFileIfExists(req.file.path);
    next(error);
  }
};

const removeGroupMember = async (req, res, next) => {
  try {
    const group = await ChatGroup.findOne({ id: req.params.id });
    if (!group || (group.adminId || group.createdById) !== req.userId) return next(new AppError('Only the group admin can remove members.', 403));
    if (req.params.userId === req.userId) return next(new AppError('The admin cannot remove themselves.', 400));
    group.participantIds = (group.participantIds || []).filter((id) => id !== req.params.userId);
    group.updatedAt = new Date().toISOString();
    await group.save();
    res.json({ group: group.toObject() });
  } catch (error) { next(error); }
};

const deleteGroup = async (req, res, next) => {
  try {
    const group = await ChatGroup.findOne({ id: req.params.id }).lean();
    if (!group) return next(new AppError('Group not found.', 404));
    if ((group.adminId || group.createdById) !== req.userId) return next(new AppError('Only the group admin can delete the group.', 403));
    await Promise.all([
      ChatGroup.deleteOne({ id: group.id }),
      Message.deleteMany({ conversationType: 'group', groupId: group.id })
    ]);
    res.json({ success: true, groupId: group.id });
  } catch (error) { next(error); }
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

    const readQuery = type === 'group'
      ? { conversationType: 'group', groupId: req.query.groupId, readBy: { $ne: userId } }
      : { conversationType: 'dm', senderId: partnerId, recipientId: userId, readBy: { $ne: userId } };
    await Message.updateMany(readQuery, { $addToSet: { readBy: userId } });
    const groupParticipantCount = type === 'group'
      ? ((await ChatGroup.findOne({ id: req.query.groupId }).lean())?.participantIds || []).length
      : 0;

    const hydrated = msgs.map(m => ({
      ...m,
      ...(Array.isArray(m.deletedFor) && m.deletedFor.includes(userId) ? { deleted: true, deletedBy: userId, text: '' } : {}),
      sender: senderMap[m.senderId] ? {
        id: senderMap[m.senderId].id,
        name: senderMap[m.senderId].name,
        avatarUrl: senderMap[m.senderId].avatarUrl || '',
      } : { id: m.senderId, name: 'Unknown', avatarUrl: '' },
      replyTo: m.replyToMessageId
        ? (() => {
          const reply = msgs.find((item) => item.id === m.replyToMessageId);
          return reply ? { id: reply.id, senderId: reply.senderId, text: reply.deleted ? '' : reply.text, deleted: Boolean(reply.deleted) } : null;
        })()
        : null,
      delivery: {
        delivered: true,
        read: m.senderId === userId && (type === 'group'
          ? (m.readBy || []).length >= Math.max(1, groupParticipantCount - 1)
          : (m.readBy || []).includes(partnerId))
      }
    }));

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
    const { recipientId, groupId, conversationType, text, replyToMessageId, storyId } = body;
    const senderId = req.userId;
    if (!text?.trim()) return next(new AppError('text required.', 400));
    const type = conversationType || 'dm';
    if (type === 'dm' && !recipientId) return next(new AppError('recipientId required for DM.', 400));
    if (type === 'group' && !groupId) return next(new AppError('groupId required for group message.', 400));

    const db = ensureDBShape(await readDB());
    const sender = db.users.find((user) => user.id === senderId);
    if (!sender) return next(new AppError('Unauthorized user.', 401));
    let storyReply = null;
    if (storyId) {
      storyReply = db.stories.find((story) => story.id === storyId);
      if (!storyReply) return next(new AppError('Story not found.', 404));
      if (storyReply.userId === senderId) return next(new AppError('You cannot reply to your own story.', 400));
      if (storyReply.userId !== recipientId) return next(new AppError('Story reply recipient mismatch.', 400));
    }

    let access = { kind: 'message' };
    if (type === 'dm') access = await getDirectMessageAccess(senderId, recipientId);
    if (type === 'group') {
      const group = db.groups.find((item) => item.id === groupId);
      if (!group || !(group.participantIds || []).includes(senderId)) return next(new AppError('Group not found.', 404));
      if (group.messagingOpen === false) return next(new AppError('Messaging is closed for this group.', 403));
    }
    if (access.error) return next(new AppError(access.error, access.status));

    const storyTrack = storyReply?.trackId ? db.tracks.find((track) => track.id === storyReply.trackId) : null;
    const storyProject = storyTrack?.projectId ? db.projects.find((project) => project.id === storyTrack.projectId) : null;
    const storyPreview = storyReply ? { id: storyReply.id, contentType: storyReply.contentType, text: storyReply.text || '', coverArt: storyProject?.coverArt || '', title: storyTrack?.title || storyTrack?.filename || 'Story preview', ownerId: storyReply.userId } : null;
    const msg = createMessage(db, {
      senderId,
      conversationType: type,
      recipientId,
      groupId: type === 'group' ? groupId : null,
      messageKind: storyReply ? 'story_reply' : access.kind,
      text,
      replyToMessageId: replyToMessageId || null,
      storyId: storyId || null,
      storyPreview,
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
    const participantIds = message.conversationType === 'group'
      ? (db.groups.find((group) => group.id === message.groupId)?.participantIds || [])
      : [message.senderId, message.recipientId].filter(Boolean);
    if (!participantIds.includes(userId)) return next(new AppError('You are not part of this conversation.', 403));
    
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
    const scope = req.body?.scope === 'me' ? 'me' : 'everyone';
    const message = db.messages.find((item) => item.id === req.params.id);
    if (!message) return next(new AppError('Message not found.', 404));
    const participantIds = message.conversationType === 'group'
      ? (db.groups.find((group) => group.id === message.groupId)?.participantIds || [])
      : [message.senderId, message.recipientId].filter(Boolean);
    if (!participantIds.includes(userId)) return next(new AppError('You are not part of this conversation.', 403));
    if (scope === 'me') {
      message.deletedFor = [...new Set([...(message.deletedFor || []), userId])];
      await writeDB(db);
      return res.json({ message: { ...hydrateMessage(db, message), deleted: true, deletedBy: userId, text: '' } });
    }
    if (message.deleted) return res.json({ message: hydrateMessage(db, message) });
    
    message.deleted = true;
    message.text = '';
    message.attachments = [];
    message.deletedBy = userId;
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

    const storedGroups = await ChatGroup.find({ participantIds: userId }).lean();

    const userGroupIds = storedGroups
      .filter((group) => (group.participantIds || []).includes(userId))
      .map((group) => group.id);
    const allMessages = await Message.find({
      $or: [
        { conversationType: 'group', groupId: { $in: userGroupIds } },
        { conversationType: 'dm', $or: [{ senderId: userId }, { recipientId: userId }] }
      ]
    }).lean();
    db.messages = allMessages;

    for (const group of storedGroups) {
      const groupMsgs = db.messages.filter((m) => m.conversationType === 'group' && m.groupId === group.id);
      const lastGroup = groupMsgs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
      const groupUnreadCount = groupMsgs.filter((m) => m.senderId !== userId && !(m.readBy || []).includes(userId)).length;
      conversations.push({
        type: 'group',
        group: {
          id: group.id,
          name: group.name,
          avatarUrl: group.avatarUrl || '',
          avatarPublicId: group.avatarPublicId || '',
          adminId: group.adminId || group.createdById,
          createdById: group.createdById,
          participantIds: group.participantIds || [],
          messagingOpen: group.messagingOpen !== false,
          membersCanEdit: Boolean(group.membersCanEdit),
          membersCanInvite: Boolean(group.membersCanInvite)
        },
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

const starMessage = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const userId = req.userId;
    const message = db.messages.find((item) => item.id === req.params.id);
    if (!message) return next(new AppError('Message not found.', 404));
    const participantIds = message.conversationType === 'group'
      ? (db.groups.find((group) => group.id === message.groupId)?.participantIds || [])
      : [message.senderId, message.recipientId].filter(Boolean);
    if (!participantIds.includes(userId)) return next(new AppError('You are not part of this conversation.', 403));
    const starredBy = Array.isArray(message.starredBy) ? message.starredBy : [];
    const starred = !starredBy.includes(userId);
    message.starredBy = starred ? [...starredBy, userId] : starredBy.filter((id) => id !== userId);
    await writeDB(db);
    res.json({ message: hydrateMessage(db, message), starred });
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

const clearReadNotifications = async (req, res, next) => {
  try {
    const userId = String(req.userId);
    const db = ensureDBShape(await readDB());

    const result = await Notification.deleteMany({ userId, read: true });
    db.notifications = db.notifications.filter((item) => (
      !(String(item.userId) === userId && item.read)
    ));
    await writeDB(db);
    await invalidateCache(`workspace:${userId}`);

    res.json({ success: true, deletedCount: result.deletedCount || 0 });
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
  getFriends,
  createGroup,
  getGroupSettings,
  updateGroupSettings,
  uploadGroupAvatar,
  removeGroupMember,
  deleteGroup,
  inviteGroupMember,
  getGroupRequests,
  respondToGroupRequest,
  leaveGroup,
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
};
