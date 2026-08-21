const path = require('path');
const fs = require('fs');
const { uploadDir } = require('./fileHelper');

const BASE_URL = process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 4000}`;

const makeId = () => `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

const publicUser = (user) => user ? { id: user.id, name: user.name, username: user.username || user.name, bio: user.bio || '', avatarUrl: user.avatarUrl || null, followerCount: (user.followers || []).length, followingCount: (user.following || []).length } : null;

const userExists = (db, userId) => db.users.some((user) => user.id === userId);

const defaultTitleFor = (type) => type === 'folder' ? 'Untitled folder' : 'Untitled project';

const ownerNameFor = (db, userId) => db.users.find((user) => user.id === userId)?.name || 'Unknown artist';

const normalizeLibraryItem = (item, db, type) => {
  const title = item.title || item.name || defaultTitleFor(type);
  const artist = item.artist || ownerNameFor(db, item.userId);
  return { ...item, title, name: title, artist };
};

const normalizeMediaAsset = (asset, trackId, versionId = null) => ({
  id: versionId || asset.id || trackId,
  playbackUrl: asset.filename
    ? `${BASE_URL}/api/media/tracks/${trackId}${versionId ? `/versions/${versionId}` : ''}`
    : asset.url || asset.secureUrl || null,
  secureUrl: asset.url || asset.secureUrl || null,
  publicId: asset.publicId || null,
  resourceType: asset.resourceType || 'video',
  format: asset.format || null,
  mimeType: asset.mimeType || null,
  duration: Number(asset.duration) || 0,
  bytes: Number(asset.size || asset.bytes) || 0,
  storageProvider: asset.storageProvider || (asset.publicId || asset.url ? 'cloudinary' : 'local'),
  playbackStatus: asset.playbackStatus || (asset.filename || asset.url ? 'ready' : 'failed')
});

const normalizeTrack = (track) => ({
  ...track,
  notes: track.notes || '',
  noteMemos: (track.noteMemos || []).map((memo) => ({
    ...memo,
    url: memo.filename
      ? `${BASE_URL}/api/media/tracks/${track.id}/note-memos/${memo.id}`
      : memo.url
  })),
  versions: Array.from(new Map((track.versions || []).map((version) => [
    version.publicId || version.url || version.filename || version.id,
    version
  ])).values()).map((version) => ({
    ...version,
    ...normalizeMediaAsset(version, track.id, version.id)
  })),
  activeVersionId: track.activeVersionId || null,
  playbackUrl: track.filename ? `${BASE_URL}/api/media/tracks/${track.id}` : track.url,
  url: track.filename ? `${BASE_URL}/api/media/tracks/${track.id}` : track.url
});

const trackOwnerId = (track) => track.sourceUserId || track.uploader?.id || track.userId;

const trackMediaPath = (track) => path.join(uploadDir, trackOwnerId(track), track.filename);

const noteMemoDir = (track) => path.join(uploadDir, trackOwnerId(track), 'note-memos', track.id);

const findAccessibleTrack = (db, trackId, userId) => {
  const normalizedUserId = userId?.toString();
  const track = db.tracks.find((item) => item.id?.toString() === trackId?.toString());
  if (!track) return null;
  const ownerIds = [track.userId, track.uploader?.id, track.sourceUserId].filter(Boolean).map(String);
  if (ownerIds.includes(normalizedUserId)) return track;
  const project = db.projects.find((item) => item.id === track.projectId);
  if (project) {
    if (project.userId?.toString() === normalizedUserId) return track;
    const members = (project.members || project.collaborators || []);
    if (members.some(m => (m.id || m.userId || m)?.toString() === normalizedUserId)) return track;
  }
  return null;
};

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    require('https').get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
};

const fileToDataUrl = (file) => {
  const buffer = fs.readFileSync(file.path);
  return `data:${file.mimetype};base64,${buffer.toString('base64')}`;
};

const getProjectBundle = (db, project) => {
  const tracks = db.tracks.filter((t) => t.projectId === project.id).map(normalizeTrack);
  return {
    type: 'project',
    project: normalizeLibraryItem(project, db, 'project'),
    owner: publicUser(db.users.find((user) => user.id === project.userId)),
    tracks
  };
};

const notifyListen = (db, { ownerId, actorId, project, folder, track }) => {
  if (!ownerId || ownerId === actorId) return;
  const actor = actorId ? db.users.find((user) => user.id === actorId) : { name: 'Anonymous Listener', id: 'anonymous' };
  if (!actor) return;

  db.notifications.push({
    id: makeId(),
    userId: ownerId,
    type: 'listen',
    actor: publicUser(actor),
    project: project ? { id: project.id, name: project.name } : null,
    folder: folder ? { id: folder.id, name: folder.name } : null,
    track: track ? { id: track.id, title: track.title } : null,
    message: `${actor.name} listened to ${track?.title || project?.name || folder?.name || 'your shared item'}`,
    read: false,
    createdAt: new Date().toISOString()
  });
};

const groupParticipantIds = (db, groupId) => {
  const group = db.groups?.find((item) => item.id === groupId);
  return group ? (group.participantIds || []) : [];
};

const chatRecipientIds = (db, message) => {
  if (message.conversationType === 'group') {
    return groupParticipantIds(db, message.groupId).filter((id) => id !== message.senderId);
  }
  return message.recipientId ? [message.recipientId] : [];
};

const hydrateMessage = (db, message) => {
  const recipients = chatRecipientIds(db, message);
  const readBy = message.readBy || [];
  return {
    ...message,
    sender: publicUser(db.users.find((user) => user.id === message.senderId)),
    replyTo: message.replyToMessageId
      ? db.messages.find((item) => item.id === message.replyToMessageId) || null
      : null,
    delivery: {
      delivered: true,
      read: recipients.length > 0 && recipients.every((id) => readBy.includes(id)),
      readCount: recipients.filter((id) => readBy.includes(id)).length,
      recipientCount: recipients.length
    }
  };
};

const hydrateCall = (db, call) => call ? {
  ...call,
  startedBy: publicUser(db.users.find((user) => user.id === call.startedById)),
  participants: (call.participantIds || []).map((id) => publicUser(db.users.find((user) => user.id === id)))
} : null;

const createMessage = (db, { senderId, recipientId, groupId = null, conversationType, messageKind = 'message', text = '', attachments = [], replyToMessageId = null, forwardedFrom = null }) => {
  const type = conversationType || 'dm';
  const recipients = type === 'group' ? groupParticipantIds(db, groupId).filter((id) => id !== senderId) : [recipientId].filter(Boolean);
  return {
    id: makeId(),
    senderId,
    recipientId: type === 'group' ? null : recipientId,
    groupId: type === 'group' ? groupId : null,
    conversationType: type,
    messageKind,
    text: text.trim(),
    attachments,
    replyToMessageId,
    forwardedFrom,
    pinned: false,
    deleted: false,
    deliveredTo: recipients,
    readBy: [],
    createdAt: new Date().toISOString()
  };
};

const notifyMessage = (db, message) => {
  const sender = db.users.find((user) => user.id === message.senderId);
  if (!sender) return;

  chatRecipientIds(db, message).forEach((recipientId) => {
    db.notifications.push({
      id: makeId(),
      userId: recipientId,
      type: 'message',
      actor: publicUser(sender),
      chat: {
        type: message.conversationType,
        partnerId: message.conversationType === 'dm' ? message.senderId : null
      },
      message: message.conversationType === 'group'
        ? `${sender.name} sent a message in ${db.groups?.find((group) => group.id === message.groupId)?.name || 'a group'}`
        : `${sender.name} sent you a message`,
      preview: message.text || (message.attachments?.length ? 'Media message' : ''),
      read: false,
      createdAt: new Date().toISOString()
    });
  });
};

const notifyCall = (db, call, caller) => {
  db.users
    .filter((user) => user.id !== caller.id)
    .forEach((user) => {
      db.notifications.push({
        id: makeId(),
        userId: user.id,
        type: 'call',
        actor: publicUser(caller),
        call: { id: call.id, type: call.type },
        message: `${caller.name} started a group call`,
        read: false,
        createdAt: new Date().toISOString()
      });
    });
};

module.exports = {
  BASE_URL,
  makeId,
  publicUser,
  userExists,
  defaultTitleFor,
  ownerNameFor,
  normalizeLibraryItem,
  normalizeTrack,
  normalizeMediaAsset,
  trackOwnerId,
  trackMediaPath,
  noteMemoDir,
  findAccessibleTrack,
  downloadFile,
  fileToDataUrl,
  getProjectBundle,
  notifyListen,
  groupParticipantIds,
  chatRecipientIds,
  hydrateMessage,
  hydrateCall,
  createMessage,
  notifyMessage,
  notifyCall,
};
