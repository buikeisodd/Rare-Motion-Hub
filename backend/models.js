const mongoose = require('mongoose');

const { Schema } = mongoose;

const UserSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: String,
  email: { type: String, required: true, unique: true },
  avatarUrl: String,
  avatarUpdatedAt: String,
  updatedAt: String,
  createdAt: { type: String, default: () => new Date().toISOString() },
});

const ProjectSchema = new Schema({
  id: { type: String, required: true, unique: true },
  userId: String,
  title: String,
  name: String,
  artist: String,
  coverArt: String,
  bpm: String,
  key: String,
  notes: String,
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
  uploader: { id: String, name: String },
  uploadedAt: { type: String, default: () => new Date().toISOString() },
  isStem: Boolean,
  stemOf: String,
  stemType: String,
});

const FolderSchema = new Schema({
  id: { type: String, required: true, unique: true },
  userId: String,
  title: String,
  name: String,
  artist: String,
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

const CallSchema = new Schema({
  id: { type: String, required: true, unique: true },
  fromId: String,
  toId: String,
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

module.exports = {
  User:         mongoose.model('User',         UserSchema),
  Project:      mongoose.model('Project',      ProjectSchema),
  Track:        mongoose.model('Track',        TrackSchema),
  Folder:       mongoose.model('Folder',       FolderSchema),
  CoverArt:     mongoose.model('CoverArt',     CoverArtSchema),
  Notification: mongoose.model('Notification', NotificationSchema),
  PlayEvent:    mongoose.model('PlayEvent',    PlayEventSchema),
  Message:      mongoose.model('Message',      MessageSchema),
  Call:         mongoose.model('Call',         CallSchema),
  CallSignal:   mongoose.model('CallSignal',   CallSignalSchema),
  ShareLink:    mongoose.model('ShareLink',    ShareLinkSchema),
};
