const mongoose = require('mongoose');

const { Schema } = mongoose;

const UserSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: String,
  username: String,
  bio: String,
  followers: [String],
  following: [String],
  isDeactivated: { type: Boolean, default: false },
  deactivatedAt: String,
  isSuspended: { type: Boolean, default: false },
  suspendedAt: String,
  // Explicit account lifecycle label. Kept in sync with the underlying
  // isDeactivated/isSuspended/emailVerified booleans at every transition
  // point (see deriveAccountStatus in auth.controller.js) rather than
  // replacing them, so existing documents/checks predating this field keep
  // working — it's a derived, always-recomputable label, not a second
  // independent source of truth.
  accountStatus: {
    type: String,
    enum: ['pending_verification', 'active', 'suspended', 'deactivated'],
    default: 'pending_verification'
  },
  email: { type: String, unique: true, sparse: true },
  emailVerified: { type: Boolean, default: false },
  authProvider: { type: String, default: 'password' },
  providerUserId: String,
  phoneNumber: String,
  passwordHash: String,
  avatarUrl: String,
  avatarUpdatedAt: String,
  updatedAt: String,
  createdAt: { type: String, default: () => new Date().toISOString() },
});

const ProjectSchema = new Schema({
  id: { type: String, required: true, unique: true },
  userId: String,
  folderId: String,
  title: String,
  name: String,
  artist: String,
  coverArt: String,
  bpm: String,
  key: String,
  notes: String,
  visibility: { type: String, enum: ['public', 'private'], default: 'private' },
  allowedUserIds: [String],
  accessRequests: [{ userId: String, status: String, createdAt: String }],
  locked: Boolean,
  exportedAt: String,
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: String,
});

const TrackSchema = new Schema({
  id: { type: String, required: true, unique: true },
  userId: String,
  projectId: String,
  title: String,
  artist: String,
  producer: String,
  filename: String,
  mimeType: String,
  size: Number,
  url: String,
  versions: [{
    id: String,
    filename: String,
    url: String,
    mimeType: String,
    size: Number,
    label: String,
    uploadedAt: String
  }],
  uploader: { id: String, name: String },
  uploadedAt: { type: String, default: () => new Date().toISOString() },
  isStem: Boolean,
  stemOf: String,
  stemType: String,
  stems: [{ name: String, url: String, filename: String }],
  isPublished: { type: Boolean, default: false },
  publishedAt: String,
  feedCaption: String,
  previewStart: { type: Number, default: 0 },
  previewEnd: Number,
  likes: [String],
  savedBy: [String],
  comments: [{ id: String, userId: String, text: String, parentId: String, createdAt: String, likes: [String] }],
});

const FolderSchema = new Schema({
  id: { type: String, required: true, unique: true },
  userId: String,
  parentFolderId: String,
  title: String,
  name: String,
  artist: String,
  visibility: { type: String, enum: ['public', 'private'], default: 'private' },
  allowedUserIds: [String],
  accessRequests: [{ userId: String, status: String, createdAt: String }],
  createdAt: { type: String, default: () => new Date().toISOString() },
});

const CoverArtSchema = new Schema({
  id: { type: String, required: true, unique: true },
  projectId: String,
  userId: String,
  url: String,
  filename: String,
  createdAt: { type: String, default: () => new Date().toISOString() },
});

const NotificationSchema = new Schema({
  id: { type: String, required: true, unique: true },
  userId: String,
  type: String,
  read: Boolean,
  message: String,
  preview: String,
  actor: { id: String, name: String, avatarUrl: String },
  track: { id: String, title: String },
  project: { id: String, name: String },
  folder: { id: String, name: String },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

const PlayEventSchema = new Schema({
  id: { type: String, required: true, unique: true },
  trackId: String,
  projectId: String,
  userId: String,
  playedAt: { type: String, default: () => new Date().toISOString() },
});

const MessageSchema = new Schema({
  id: { type: String, required: true, unique: true },
  senderId: String,
  recipientId: String,
  conversationType: String,
  messageKind: String,
  attachments: [Schema.Types.Mixed],
  replyToMessageId: String,
  forwardedFrom: Schema.Types.Mixed,
  deleted: Boolean,
  deliveredTo: [String],
  fromId: String,
  toId: String,
  groupId: String,
  text: String,
  type: String,
  fileUrl: String,
  fileName: String,
  fileType: String,
  replyTo: Schema.Types.Mixed,
  reactions: Schema.Types.Mixed,
  pinned: Boolean,
  forwarded: Boolean,
  createdAt: { type: String, default: () => new Date().toISOString() },
  readBy: [String],
});

const ChatGroupSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: String,
  createdById: String,
  participantIds: [String],
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: String,
});

const CallSchema = new Schema({
  id: { type: String, required: true, unique: true },
  fromId: String,
  toId: String,
  startedById: String,
  participantIds: [String],
  active: Boolean,
  type: String,
  status: String,
  startedAt: String,
  endedAt: String,
  createdAt: { type: String, default: () => new Date().toISOString() },
});

const CallSignalSchema = new Schema({
  id: { type: String, required: true, unique: true },
  callId: String,
  fromId: String,
  toId: String,
  fromUserId: String,
  toUserId: String,
  type: String,
  payload: Schema.Types.Mixed,
  createdAt: { type: String, default: () => new Date().toISOString() },
});

const ShareLinkSchema = new Schema({
  id: { type: String, required: true, unique: true },
  type: String,
  itemId: String,
  userId: String,
  token: String,
  createdAt: { type: String, default: () => new Date().toISOString() },
});

const SessionSchema = new Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  refreshTokenHash: { type: String, required: true },
  // Hash the current refreshTokenHash replaced on the last rotation. Used
  // purely for reuse detection: if a token matching THIS hash is ever
  // presented again, it means someone is replaying an already-rotated-away
  // (and therefore compromised) refresh token — see rotateRefreshSession.
  previousRefreshTokenHash: { type: String, index: true },
  tokenFamilyId: { type: String, required: true, index: true },
  createdAt: { type: String, default: () => new Date().toISOString() },
  lastUsedAt: { type: String, default: () => new Date().toISOString() },
  expiresAt: { type: String, required: true, index: true },
  revokedAt: String,
  revokedReason: String,
  userAgent: String,
  ipAddress: String,
  device: Schema.Types.Mixed,
});

const SecurityEventSchema = new Schema({
  eventId:   { type: String, required: true, unique: true },
  userId:    { type: String, index: true },
  sessionId: String,
  // Category is one of three high-level buckets — used for filtering/alerting.
  category: {
    type: String,
    required: true,
    enum: ['AUTH', 'SECURITY', 'SYSTEM'],
    index: true
  },
  // Type is a fully-qualified constant within the category, e.g. AUTH_LOGIN_SUCCESS.
  // The full taxonomy is defined in security.service.js — this field stores the
  // string value; enforcement happens at the service layer.
  type:      { type: String, required: true, index: true },
  ipAddress: String,
  userAgent: String,
  // metadata must never contain: passwords, raw tokens (access, refresh,
  // verification, reset), or any other secret material. Enforced at call sites
  // and documented in security.service.js.
  metadata:  Schema.Types.Mixed,
  createdAt: { type: String, default: () => new Date().toISOString(), index: true },
});

module.exports = {
  User:         mongoose.model('User',         UserSchema),
  Project:      mongoose.model('Project',      ProjectSchema),
  Track:        mongoose.model('Track',        TrackSchema),
  Folder:       mongoose.model('Folder',       FolderSchema),
  CoverArt:     mongoose.model('CoverArt',     CoverArtSchema),
  Notification: mongoose.model('Notification', NotificationSchema),
  PlayEvent:    mongoose.model('PlayEvent',    PlayEventSchema),
  Message:      mongoose.model('Message',      MessageSchema),
  ChatGroup:    mongoose.model('ChatGroup',    ChatGroupSchema),
  Call:         mongoose.model('Call',         CallSchema),
  CallSignal:   mongoose.model('CallSignal',   CallSignalSchema),
  ShareLink:    mongoose.model('ShareLink',    ShareLinkSchema),
  Session:      mongoose.model('Session',      SessionSchema),
  SecurityEvent: mongoose.model('SecurityEvent', SecurityEventSchema),
};
