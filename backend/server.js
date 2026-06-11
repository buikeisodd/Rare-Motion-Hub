const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const mongoose = require('mongoose');
const {
  User, Project, Track, Folder, CoverArt,
  Notification, PlayEvent, Message, Call, CallSignal, ShareLink
} = require('./models');
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = process.env.PORT || 3001;

const conversionJobs = {};
const stemJobs = {};
const BASE_URL = process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || 'https://rare-motion-hub.onrender.com';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://chibuikeeseagwu02_db_user:4c4rkQj7HlQNlxp5@cluster0.efinpoe.mongodb.net/starlight-station?appName=Cluster0';

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range, Content-Type');
  next();
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/covers', express.static(path.join(__dirname, 'covers')));
app.use('/avatars', express.static(path.join(__dirname, 'avatars')));

const uploadDir = path.join(__dirname, 'uploads');
const coverDir = path.join(__dirname, 'covers');
const avatarDir = path.join(__dirname, 'avatars');
const chatDir = path.join(uploadDir, 'chat');
const stemsDir = path.join(__dirname, 'stems');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(coverDir)) fs.mkdirSync(coverDir);
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir);
if (!fs.existsSync(chatDir)) fs.mkdirSync(chatDir, { recursive: true });
if (!fs.existsSync(stemsDir)) fs.mkdirSync(stemsDir, { recursive: true });

// ── MongoDB DB helpers — keep same interface as JSON DB so all routes work ──

// readDB: loads all collections into a flat object (same shape as old db.json)
const readDB = async () => {
  const [users, projects, tracks, folders, coverArts, notifications, playEvents, messages, calls, callSignals, shareLinks] = await Promise.all([
    User.find().lean(),
    Project.find().lean(),
    Track.find().lean(),
    Folder.find().lean(),
    CoverArt.find().lean(),
    Notification.find().lean(),
    PlayEvent.find().lean(),
    Message.find().lean(),
    Call.find().lean(),
    CallSignal.find().lean(),
    ShareLink.find().lean(),
  ]);
  return { users, projects, tracks, folders, coverArts, notifications, playEvents, messages, calls, callSignals, shareLinks };
};

// writeDB: diffs and upserts changed documents
const writeDB = async (db) => {
  const ops = [
    ...( db.users        || [] ).map(d => User.findOneAndUpdate(        { id: d.id }, d, { upsert: true, new: true, lean: true } )),
    ...( db.projects     || [] ).map(d => Project.findOneAndUpdate(     { id: d.id }, d, { upsert: true, new: true, lean: true } )),
    ...( db.tracks       || [] ).map(d => Track.findOneAndUpdate(       { id: d.id }, d, { upsert: true, new: true, lean: true } )),
    ...( db.folders      || [] ).map(d => Folder.findOneAndUpdate(      { id: d.id }, d, { upsert: true, new: true, lean: true } )),
    ...( db.coverArts    || [] ).map(d => CoverArt.findOneAndUpdate(    { id: d.id }, d, { upsert: true, new: true, lean: true } )),
    ...( db.notifications|| [] ).map(d => Notification.findOneAndUpdate({ id: d.id }, d, { upsert: true, new: true, lean: true } )),
    ...( db.playEvents   || [] ).map(d => PlayEvent.findOneAndUpdate(   { id: d.id }, d, { upsert: true, new: true, lean: true } )),
    ...( db.messages     || [] ).map(d => Message.findOneAndUpdate(     { id: d.id }, d, { upsert: true, new: true, lean: true } )),
    ...( db.calls        || [] ).map(d => Call.findOneAndUpdate(        { id: d.id }, d, { upsert: true, new: true, lean: true } )),
    ...( db.callSignals  || [] ).map(d => CallSignal.findOneAndUpdate(  { id: d.id }, d, { upsert: true, new: true, lean: true } )),
    ...( db.shareLinks   || [] ).map(d => ShareLink.findOneAndUpdate(   { id: d.id }, d, { upsert: true, new: true, lean: true } )),
  ];
  await Promise.all(ops);
};

const ensureDBShape = (db) => {
  db.users         ||= [];
  db.folders       ||= [];
  db.projects      ||= [];
  db.tracks        ||= [];
  db.coverArts     ||= [];
  db.notifications ||= [];
  db.playEvents    ||= [];
  db.messages      ||= [];
  db.calls         ||= [];
  db.callSignals   ||= [];
  db.shareLinks    ||= [];
  return db;
};
const userExists = (db, userId) => db.users.some((user) => user.id === userId);
const getUserDir = (baseDir, userId) => path.join(baseDir, userId);
const ensureUserDir = (baseDir, userId) => {
  const dir = getUserDir(baseDir, userId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};
const moveFileToUserDir = (file, baseDir, userId) => {
  const userDir = ensureUserDir(baseDir, userId);
  const nextPath = path.join(userDir, file.filename);
  fs.renameSync(file.path, nextPath);
  return nextPath;
};
const removeFileIfExists = (filePath) => {
  if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
};
const removeDirIfExists = (dirPath) => {
  if (dirPath && fs.existsSync(dirPath)) fs.rmSync(dirPath, { recursive: true, force: true });
};
const fileToDataUrl = (file) => {
  const buffer = fs.readFileSync(file.path);
  return `data:${file.mimetype};base64,${buffer.toString('base64')}`;
};
const requireUserId = (req, res) => {
  const userId = (req.query.userId || req.body.userId || '').toString();
  if (!userId) {
    res.status(400).json({ error: 'User ID is required.' });
    return null;
  }
  return userId;
};
const makeId = () => `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
const publicUser = (user) => user ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl || null } : null;
const defaultTitleFor = (type) => type === 'folder' ? 'Untitled folder' : 'Untitled project';
const ownerNameFor = (db, userId) => db.users.find((user) => user.id === userId)?.name || 'Unknown artist';
const normalizeLibraryItem = (item, db, type) => {
  const title = item.title || item.name || defaultTitleFor(type);
  const artist = item.artist || ownerNameFor(db, item.userId);
  return { ...item, title, name: title, artist };
};
const normalizeTrack = (track) => ({
  ...track,
  notes: track.notes || '',
  noteMemos: (track.noteMemos || []).map((memo) => ({
    ...memo,
    url: memo.filename
      ? `${BASE_URL}/api/media/tracks/${track.id}/note-memos/${memo.id}`
      : memo.url
  })),
  versions: track.versions || [],
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
    // Allow project collaborators (members array)
    const members = (project.members || project.collaborators || []);
    if (members.some(m => (m.id || m.userId || m)?.toString() === normalizedUserId)) return track;
  }
  return null;
};
const findOwnedTrack = findAccessibleTrack;
const removeTrackFiles = (track) => {
  removeFileIfExists(trackMediaPath(track));
  (track.versions || []).forEach((version) => {
    removeFileIfExists(path.join(uploadDir, trackOwnerId(track), version.filename));
  });
  removeDirIfExists(noteMemoDir(track));
};
const demucsVenvDir = path.join(__dirname, '.venv', process.platform === 'win32' ? 'Scripts' : 'bin');
const demucsBinary = process.env.DEMUCS_BIN || path.join(demucsVenvDir, process.platform === 'win32' ? 'demucs.exe' : 'demucs');
const demucsPython = process.env.DEMUCS_PYTHON || path.join(demucsVenvDir, process.platform === 'win32' ? 'python.exe' : 'python');
const runDemucs = (inputPath, outputDir) => new Promise((resolve, reject) => {
  const demucsArgs = ['-n', 'htdemucs', '-o', outputDir, inputPath];
  const moduleAttempts = process.platform === 'win32'
    ? ['python', 'python3']
    : ['python3', 'python'];
  const attempts = [
    { command: demucsBinary, args: demucsArgs },
    { command: demucsPython, args: ['-m', 'demucs', ...demucsArgs] },
    ...moduleAttempts.map((command) => ({ command, args: ['-m', 'demucs', ...demucsArgs] }))
  ];

  const tryCommand = (index = 0) => {
    if (index >= attempts.length) {
      reject(new Error('Demucs is not installed. Run: npm run setup:stems in the backend folder.'));
      return;
    }

    const { command, args } = attempts[index];
    if ((command.includes('.venv') || command.endsWith('demucs.exe')) && !fs.existsSync(command)) {
      tryCommand(index + 1);
      return;
    }

    const proc = spawn(command, args, { shell: false });
    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('error', () => tryCommand(index + 1));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `Demucs failed with exit code ${code}`));
    });
  };

  tryCommand();
});
const findStemOutputDir = (root) => {
  if (!fs.existsSync(root)) return null;
  for (const name of fs.readdirSync(root)) {
    const entry = path.join(root, name);
    if (!fs.statSync(entry).isDirectory()) continue;
    const files = fs.readdirSync(entry);
    if (files.some((file) => ['drums', 'bass', 'other', 'vocals'].some((stem) => file.startsWith(stem)))) {
      return entry;
    }
    const nested = findStemOutputDir(entry);
    if (nested) return nested;
  }
  return null;
};
const convertToWav = (inputPath, outputPath) => new Promise((resolve, reject) => {
  ffmpeg(inputPath)
    .noVideo()
    .audioCodec('pcm_s16le')
    .audioFrequency(44100)
    .on('end', resolve)
    .on('error', reject)
    .save(outputPath);
});
const getProjectBundle = (db, project) => ({
  type: 'project',
  project: normalizeLibraryItem(project, db, 'project'),
  owner: publicUser(db.users.find((user) => user.id === project.userId)),
  tracks: db.tracks.filter((track) => track.projectId === project.id).map(normalizeTrack)
});
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
        ? `${sender.name} sent a message in Group Chat`
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

// Multer setups
const trackStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname))
});
const uploadTrack = multer({ storage: trackStorage });
const noteMemoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use trackId from URL param to build path without DB lookup
    const trackId = req.params.id || 'unknown';
    const dir = path.join(__dirname, 'uploads', 'memos', trackId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `memo-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname) || '.webm'}`)
});
const uploadNoteMemo = multer({
  storage: noteMemoStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) cb(null, true);
    else cb(new Error('Only audio files are allowed for voice memos.'));
  }
});

const coverStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, coverDir),
  filename: (req, file, cb) => cb(null, 'cover-' + Date.now() + path.extname(file.originalname))
});
const uploadCover = multer({ storage: coverStorage });

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => cb(null, 'avatar-' + Date.now() + path.extname(file.originalname))
});
const uploadAvatar = multer({ storage: avatarStorage });

const chatStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.body.senderId || 'unknown';
    cb(null, ensureUserDir(chatDir, userId));
  },
  filename: (req, file, cb) => cb(null, 'chat-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname))
});
const uploadChatMedia = multer({
  storage: chatStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only photos, videos, and voice recordings are allowed in chat.'));
    }
  }
});

// --- AUTH ---
app.post('/api/auth', async (req, res) => {
  const email = req.body.email?.trim();
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  // Find existing user
  let user = await User.findOne({ email: email.toLowerCase() }).lean();

  if (!user) {
    // Auto-create user on first login
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const name = email.split('@')[0];
    user = {
      id,
      name,
      email: email.toLowerCase(),
      avatarUrl: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await User.create(user);
  }

  res.json({ user });
});

// --- USERS ---
app.get('/api/users/:id', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const user = db.users.find((item) => item.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user });
});

app.put('/api/users/:id', async (req, res) => {
  const { name } = req.body;
  const db = ensureDBShape(await readDB());
  const userIndex = db.users.findIndex((user) => user.id === req.params.id);
  if (userIndex === -1) return res.status(404).json({ error: 'User not found.' });

  const nextName = name?.trim();
  if (!nextName) return res.status(400).json({ error: 'Username is required.' });

  db.users[userIndex] = { ...db.users[userIndex], name: nextName, updatedAt: new Date().toISOString() };
  await writeDB(db);
  res.json({ user: db.users[userIndex] });
});

app.post('/api/users/:id/avatar', uploadAvatar.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No profile image uploaded.' });
  const db = ensureDBShape(await readDB());
  const userIndex = db.users.findIndex((user) => user.id === req.params.id);
  if (userIndex === -1) {
    removeFileIfExists(req.file.path);
    return res.status(404).json({ error: 'User not found.' });
  }

  moveFileToUserDir(req.file, avatarDir, req.params.id);
  db.users[userIndex].avatarUrl = `${BASE_URL}/avatars/${req.params.id}/${req.file.filename}`;
  db.users[userIndex].avatarUpdatedAt = new Date().toISOString();
  db.users[userIndex].updatedAt = db.users[userIndex].avatarUpdatedAt;
  await writeDB(db);
  res.json({ user: db.users[userIndex] });
});

app.delete('/api/users/:id', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const user = db.users.find((item) => item.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const uid = req.params.id;
  await Promise.all([
    User.deleteOne({ id: uid }),
    Folder.deleteMany({ userId: uid }),
    Project.deleteMany({ userId: uid }),
    Track.deleteMany({ $or: [{ userId: uid }, { 'uploader.id': uid }] }),
    CoverArt.deleteMany({ userId: uid }),
    Notification.deleteMany({ $or: [{ userId: uid }, { 'actor.id': uid }] }),
    PlayEvent.deleteMany({ $or: [{ ownerId: uid }, { actorId: uid }] }),
  ]);

  removeDirIfExists(getUserDir(uploadDir, req.params.id));
  removeDirIfExists(getUserDir(coverDir, req.params.id));
  removeDirIfExists(getUserDir(avatarDir, req.params.id));
  res.json({ success: true });
});

// --- DATA FETCHING ---
app.get('/api/workspace', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;
  if (!userExists(db, userId)) return res.status(401).json({ error: 'Unauthorized user.' });

  // Only return root-level folders (not nested inside any folder)
  const rootFolders = db.folders.filter((folder) => folder.userId === userId && !folder.parentFolderId);
  res.json({
    folders: rootFolders.map((folder) => normalizeLibraryItem(folder, db, 'folder')),
    projects: db.projects.filter((project) => project.userId === userId).map((project) => normalizeLibraryItem(project, db, 'project')),
    tracks: db.tracks.filter((track) => track.userId === userId || track.uploader?.id === userId).map(normalizeTrack),
    coverArts: db.coverArts.filter((cover) => cover.userId === userId),
    notifications: db.notifications.filter((notification) => notification.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  });
});

// --- SHARING ---
app.post('/api/share/generate', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const { type, targetId, expiresInMs } = req.body;
  if (!['project', 'folder'].includes(type) || !targetId) {
    return res.status(400).json({ error: 'Valid type and targetId are required.' });
  }

  const token = require('crypto').randomBytes(16).toString('hex');
  const expiresAt = expiresInMs ? new Date(Date.now() + expiresInMs).toISOString() : null;

  const shareLink = {
    token,
    type,
    targetId,
    expiresAt,
    createdAt: new Date().toISOString()
  };

  db.shareLinks.push(shareLink);
  await writeDB(db);

  res.json({ token, expiresAt });
});

app.get('/api/share/link/:token', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const link = db.shareLinks.find((l) => l.token === req.params.token);
  
  if (!link) {
    return res.status(404).json({ error: 'Share link not found.' });
  }

  if (link.expiresAt && Date.now() > new Date(link.expiresAt).getTime()) {
    return res.status(410).json({ error: 'Link no longer accessible.', expired: true });
  }

  if (link.type === 'project') {
    const project = db.projects.find((item) => item.id === link.targetId);
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    return res.json(getProjectBundle(db, project));
  } else if (link.type === 'folder') {
    const folder = db.folders.find((item) => item.id === link.targetId);
    if (!folder) return res.status(404).json({ error: 'Folder not found.' });
    const subFolders = db.folders.filter((f) => f.folderId === folder.id);
    const subProjects = db.projects.filter((p) => p.folderId === folder.id);
    const tracks = db.tracks.filter((t) => subProjects.some((sp) => sp.id === t.projectId));
    return res.json({
      type: 'folder',
      folder: normalizeLibraryItem(folder, db, 'folder'),
      owner: publicUser(db.users.find((user) => user.id === folder.userId)),
      folders: subFolders.map((f) => normalizeLibraryItem(f, db, 'folder')),
      projects: subProjects.map((p) => normalizeLibraryItem(p, db, 'project')),
      tracks: tracks.map(normalizeTrack)
    });
  }

  return res.status(400).json({ error: 'Invalid link type.' });
});

app.get('/api/share/project/:id', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const project = db.projects.find((item) => item.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  res.json(getProjectBundle(db, project));
});

app.get('/api/share/folder/:id', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const folder = db.folders.find((item) => item.id === req.params.id);
  if (!folder) return res.status(404).json({ error: 'Folder not found.' });
  const projects = db.projects.filter((project) => project.folderId === folder.id && project.userId === folder.userId);
  const projectIds = projects.map((project) => project.id);
  res.json({
    type: 'folder',
    folder: normalizeLibraryItem(folder, db, 'folder'),
    owner: publicUser(db.users.find((user) => user.id === folder.userId)),
    projects: projects.map((project) => normalizeLibraryItem(project, db, 'project')),
    tracks: db.tracks.filter((track) => projectIds.includes(track.projectId)).map(normalizeTrack)
  });
});

app.post('/api/share/project/:id/save', async (req, res) => {
  const { userId } = req.body;
  const db = ensureDBShape(await readDB());
  if (!userExists(db, userId)) return res.status(401).json({ error: 'Unauthorized user.' });

  const sourceProject = db.projects.find((project) => project.id === req.params.id);
  if (!sourceProject) return res.status(404).json({ error: 'Project not found.' });
  if (sourceProject.userId === userId) return res.json({ project: sourceProject, alreadyOwner: true });

  const existing = db.projects.find((project) => project.userId === userId && project.sourceProjectId === sourceProject.id);
  if (existing) return res.json({ project: existing, alreadySaved: true });

  const nextProject = {
    ...sourceProject,
    id: makeId(),
    userId,
    folderId: null,
    sourceProjectId: sourceProject.sourceProjectId || sourceProject.id,
    sourceUserId: sourceProject.sourceUserId || sourceProject.userId,
    savedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  db.projects.push(nextProject);

  const sourceTracks = db.tracks.filter((track) => track.projectId === sourceProject.id);
  const copiedTracks = sourceTracks.map((track) => ({
    ...track,
    id: makeId(),
    userId,
    projectId: nextProject.id,
    sourceTrackId: track.sourceTrackId || track.id,
    sourceProjectId: sourceProject.sourceProjectId || sourceProject.id,
    sourceUserId: track.sourceUserId || sourceProject.sourceUserId || sourceProject.userId,
    uploadedAt: new Date().toISOString()
  }));
  db.tracks.push(...copiedTracks);
  await writeDB(db);
  res.json({ project: nextProject, tracks: copiedTracks });
});

app.post('/api/share/folder/:id/save', async (req, res) => {
  const { userId } = req.body;
  const db = ensureDBShape(await readDB());
  if (!userExists(db, userId)) return res.status(401).json({ error: 'Unauthorized user.' });

  const sourceFolder = db.folders.find((folder) => folder.id === req.params.id);
  if (!sourceFolder) return res.status(404).json({ error: 'Folder not found.' });
  if (sourceFolder.userId === userId) return res.json({ folder: sourceFolder, alreadyOwner: true });

  const nextFolder = {
    ...sourceFolder,
    id: makeId(),
    userId,
    sourceFolderId: sourceFolder.sourceFolderId || sourceFolder.id,
    sourceUserId: sourceFolder.sourceUserId || sourceFolder.userId,
    savedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  db.folders.push(nextFolder);

  const sourceProjects = db.projects.filter((project) => project.folderId === sourceFolder.id && project.userId === sourceFolder.userId);
  const projectIdMap = new Map();
  const copiedProjects = sourceProjects.map((project) => {
    const id = makeId();
    projectIdMap.set(project.id, id);
    return {
      ...project,
      id,
      userId,
      folderId: nextFolder.id,
      sourceProjectId: project.sourceProjectId || project.id,
      sourceFolderId: sourceFolder.sourceFolderId || sourceFolder.id,
      sourceUserId: project.sourceUserId || project.userId,
      savedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
  });
  db.projects.push(...copiedProjects);

  const copiedTracks = db.tracks
    .filter((track) => projectIdMap.has(track.projectId))
    .map((track) => ({
      ...track,
      id: makeId(),
      userId,
      projectId: projectIdMap.get(track.projectId),
      sourceTrackId: track.sourceTrackId || track.id,
      sourceProjectId: track.sourceProjectId || track.projectId,
      sourceFolderId: sourceFolder.sourceFolderId || sourceFolder.id,
      sourceUserId: track.sourceUserId || sourceFolder.sourceUserId || sourceFolder.userId,
      uploadedAt: new Date().toISOString()
    }));
  db.tracks.push(...copiedTracks);
  await writeDB(db);
  res.json({ folder: nextFolder, projects: copiedProjects, tracks: copiedTracks });
});

app.post('/api/listen', async (req, res) => {
  const { userId, projectId, folderId, trackId } = req.body;
  const db = ensureDBShape(await readDB());
  if (userId && !userExists(db, userId)) return res.status(401).json({ error: 'Unauthorized user.' });

  const project = db.projects.find((item) => item.id === projectId);
  const folder = folderId ? db.folders.find((item) => item.id === folderId) : null;
  const track = db.tracks.find((item) => item.id === trackId);
  const ownerId = track?.sourceUserId || project?.sourceUserId || folder?.sourceUserId || project?.userId || folder?.userId;
  if (ownerId && track) {
    db.playEvents.push({
      id: makeId(),
      ownerId,
      actorId: userId,
      projectId: project?.id || null,
      sourceProjectId: track.sourceProjectId || project?.sourceProjectId || project?.id || null,
      folderId: folder?.id || null,
      sourceFolderId: track.sourceFolderId || folder?.sourceFolderId || folder?.id || null,
      trackId: track.id,
      sourceTrackId: track.sourceTrackId || track.id,
      createdAt: new Date().toISOString()
    });
  }
  notifyListen(db, { ownerId, actorId: userId, project, folder, track });
  await writeDB(db);
  res.json({ success: true });
});

// --- FOLDERS ---
app.get('/api/folders/:id', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;
  const folder = db.folders.find((f) => f.id === req.params.id && f.userId === userId);
  if (!folder) return res.status(404).json({ error: 'Folder not found' });

  // Get all child projects and child folders (one level deep from this folder)
  const childProjects = db.projects.filter((p) => p.folderId === folder.id && p.userId === userId);
  const childFolders = db.folders.filter((f) => f.parentFolderId === folder.id && f.userId === userId);

  // Build breadcrumb trail (walk up parentFolderId chain)
  const breadcrumbs = [];
  let current = folder;
  while (current.parentFolderId) {
    const parent = db.folders.find((f) => f.id === current.parentFolderId);
    if (!parent) break;
    breadcrumbs.unshift({ id: parent.id, title: parent.title || parent.name });
    current = parent;
  }

  res.json({
    folder: normalizeLibraryItem(folder, db, 'folder'),
    folders: childFolders.map((f) => normalizeLibraryItem(f, db, 'folder')),
    projects: childProjects.map((p) => normalizeLibraryItem(p, db, 'project')),
    tracks: db.tracks.filter((t) => t.userId === userId || t.uploader?.id === userId).map(normalizeTrack),
    breadcrumbs
  });
});

app.post('/api/folders', async (req, res) => {
  const { name, title, artist, userId, parentFolderId } = req.body;
  const db = ensureDBShape(await readDB());
  const ownerName = ownerNameFor(db, userId);
  if (!userExists(db, userId)) return res.status(401).json({ error: 'Unauthorized user.' });
  if (parentFolderId && !db.folders.some((f) => f.id === parentFolderId && f.userId === userId)) {
    return res.status(404).json({ error: 'Parent folder not found' });
  }
  const nextTitle = (title || name || '').trim() || defaultTitleFor('folder');
  const newFolder = {
    id: makeId(),
    name: nextTitle,
    title: nextTitle,
    artist: artist?.trim() || ownerName,
    userId,
    parentFolderId: parentFolderId || null,
    createdAt: new Date().toISOString()
  };
  db.folders.push(newFolder);
  await writeDB(db);
  res.json(newFolder);
});

app.put('/api/folders/:id/move', async (req, res) => {
  const { userId, parentFolderId } = req.body;
  const db = ensureDBShape(await readDB());
  const folderIndex = db.folders.findIndex((f) => f.id === req.params.id && f.userId === userId);
  if (folderIndex === -1) return res.status(404).json({ error: 'Folder not found' });

  if (parentFolderId) {
    if (parentFolderId === req.params.id) return res.status(400).json({ error: 'Cannot move a folder into itself' });
    if (!db.folders.some((f) => f.id === parentFolderId && f.userId === userId)) {
      return res.status(404).json({ error: 'Target folder not found' });
    }
    // Prevent cycles: check if target is a descendant of the folder being moved
    const isDescendant = (folderId, ancestorId) => {
      const f = db.folders.find((x) => x.id === folderId);
      if (!f || !f.parentFolderId) return false;
      if (f.parentFolderId === ancestorId) return true;
      return isDescendant(f.parentFolderId, ancestorId);
    };
    if (isDescendant(parentFolderId, req.params.id)) {
      return res.status(400).json({ error: 'Cannot move a folder into one of its own sub-folders' });
    }
  }

  db.folders[folderIndex].parentFolderId = parentFolderId || null;
  await writeDB(db);
  res.json(db.folders[folderIndex]);
});

app.put('/api/folders/:id', async (req, res) => {
  const { userId, title, name, artist } = req.body;
  const db = ensureDBShape(await readDB());
  const folderIndex = db.folders.findIndex((folder) => folder.id === req.params.id && folder.userId === userId);
  if (folderIndex === -1) return res.status(404).json({ error: 'Folder not found' });

  const nextTitle = (title ?? name ?? db.folders[folderIndex].title ?? db.folders[folderIndex].name ?? '').trim() || defaultTitleFor('folder');
  const nextArtist = (artist ?? db.folders[folderIndex].artist ?? '').trim() || ownerNameFor(db, userId);
  db.folders[folderIndex] = {
    ...db.folders[folderIndex],
    name: nextTitle,
    title: nextTitle,
    artist: nextArtist,
    updatedAt: new Date().toISOString()
  };
  await writeDB(db);
  res.json(normalizeLibraryItem(db.folders[folderIndex], db, 'folder'));
});

app.delete('/api/folders/:id', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;

  const folderIndex = db.folders.findIndex((f) => f.id === req.params.id && f.userId === userId);
  if (folderIndex === -1) return res.status(404).json({ error: 'Folder not found' });

  // Orphan children to root
  db.folders.forEach(f => {
    if (f.parentFolderId === req.params.id) f.parentFolderId = null;
  });
  db.projects.forEach(p => {
    if (p.folderId === req.params.id) p.folderId = null;
  });

  db.folders.splice(folderIndex, 1);
  await writeDB(db);
  res.json({ success: true });
});

// --- PROJECTS ---
app.post('/api/projects', async (req, res) => {
  const { name, title, artist, userId, folderId } = req.body;
  const db = ensureDBShape(await readDB());
  const ownerName = ownerNameFor(db, userId);
  if (!userExists(db, userId)) return res.status(401).json({ error: 'Unauthorized user.' });
  if (folderId && !db.folders.some((folder) => folder.id === folderId && folder.userId === userId)) {
    return res.status(404).json({ error: 'Folder not found' });
  }
  const nextTitle = (title || name || '').trim() || defaultTitleFor('project');
  const newProject = { 
    id: makeId(),
    name: nextTitle,
    title: nextTitle,
    artist: artist?.trim() || ownerName,
    userId, 
    folderId: folderId || null,
    coverArt: null,
    createdAt: new Date().toISOString() 
  };
  db.projects.push(newProject);
  await writeDB(db);
  res.json(newProject);
});

app.put('/api/projects/:id', async (req, res) => {
  const { userId, title, name, artist } = req.body;
  const db = ensureDBShape(await readDB());
  const projectIndex = db.projects.findIndex((project) => project.id === req.params.id && project.userId === userId);
  if (projectIndex === -1) return res.status(404).json({ error: 'Project not found' });

  const nextTitle = (title ?? name ?? db.projects[projectIndex].title ?? db.projects[projectIndex].name ?? '').trim() || defaultTitleFor('project');
  const nextArtist = (artist ?? db.projects[projectIndex].artist ?? '').trim() || ownerNameFor(db, userId);
  db.projects[projectIndex] = {
    ...db.projects[projectIndex],
    name: nextTitle,
    title: nextTitle,
    artist: nextArtist,
    updatedAt: new Date().toISOString()
  };
  await writeDB(db);
  res.json(normalizeLibraryItem(db.projects[projectIndex], db, 'project'));
});

app.put('/api/projects/:id/move', async (req, res) => {
  const { folderId, userId } = req.body;
  const db = ensureDBShape(await readDB());
  const projIndex = db.projects.findIndex(p => p.id === req.params.id && p.userId === userId);
  if (projIndex === -1) return res.status(404).json({ error: 'Project not found' });
  if (folderId && !db.folders.some((folder) => folder.id === folderId && folder.userId === userId)) {
    return res.status(404).json({ error: 'Folder not found' });
  }
  
  db.projects[projIndex].folderId = folderId; // Can be null to move to root
  await writeDB(db);
  res.json(db.projects[projIndex]);
});

app.delete('/api/projects/:id', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;
  const project = db.projects.find((p) => p.id === req.params.id && p.userId === userId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  db.projects = db.projects.filter(p => p.id !== req.params.id);
  db.tracks = db.tracks.filter(t => !(t.projectId === req.params.id && (t.userId === userId || t.uploader?.id === userId)));
  await writeDB(db);
  res.json({ success: true });
});

app.get('/api/covers', async (req, res) => {
  const { projectId, userId } = req.query;
  if (!projectId || !userId) return res.status(400).json({ error: 'projectId and userId required.' });
  const covers = await CoverArt.find({ projectId, userId }).lean();
  res.json({ covers: covers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

app.put('/api/projects/:id/cover', async (req, res) => {
  const { coverUrl, userId } = req.body;
  const db = ensureDBShape(await readDB());
  const projIndex = db.projects.findIndex(p => p.id === req.params.id && p.userId === userId);
  if (projIndex === -1) return res.status(404).json({ error: 'Project not found' });
  if (coverUrl && !db.coverArts.some((cover) => cover.url === coverUrl && cover.userId === userId)) {
    return res.status(404).json({ error: 'Cover art not found' });
  }
  
  db.projects[projIndex].coverArt = coverUrl;
  await writeDB(db);
  res.json(db.projects[projIndex]);
});

app.get('/api/projects/:id', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;
  const project = db.projects.find((item) => item.id === req.params.id && item.userId === userId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const tracks = db.tracks.filter((track) => track.projectId === project.id).map(normalizeTrack);
  res.json({ project: normalizeLibraryItem(project, db, 'project'), tracks });
});

app.get('/api/projects/:id/insights', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;

  const project = db.projects.find((item) => item.id === req.params.id && item.userId === userId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const projectTracks = db.tracks.filter((track) => track.projectId === project.id);
  const sourceProjectId = project.sourceProjectId || project.id;
  const trackSourceIds = new Set(projectTracks.map((track) => track.sourceTrackId || track.id));
  const playEvents = db.playEvents.filter((event) => (
    event.ownerId === userId &&
    (event.sourceProjectId === sourceProjectId || event.projectId === project.id || trackSourceIds.has(event.sourceTrackId || event.trackId))
  ));

  const byTrack = projectTracks.map((track) => {
    const sourceTrackId = track.sourceTrackId || track.id;
    const plays = playEvents.filter((event) => event.sourceTrackId === sourceTrackId || event.trackId === track.id).length;
    return {
      id: track.id,
      title: track.title,
      coverArt: project.coverArt,
      plays
    };
  });

  const listenerMap = new Map();
  playEvents.forEach((event) => {
    const user = db.users.find((item) => item.id === event.actorId);
    const key = event.actorId || 'unknown';
    const current = listenerMap.get(key) || {
      id: key,
      name: user?.name || 'Unknown listener',
      avatarUrl: user?.avatarUrl || null,
      plays: 0,
      lastListenedAt: event.createdAt
    };
    current.plays += 1;
    if (new Date(event.createdAt) > new Date(current.lastListenedAt)) current.lastListenedAt = event.createdAt;
    listenerMap.set(key, current);
  });

  res.json({
    project: {
      id: project.id,
      name: project.name,
      coverArt: project.coverArt,
      ownerName: db.users.find((user) => user.id === project.userId)?.name || '',
      trackCount: projectTracks.length
    },
    totalPlays: playEvents.length,
    byTrack,
    byListener: Array.from(listenerMap.values()).sort((a, b) => b.plays - a.plays)
  });
});

// --- COVERS ---
app.post('/api/upload-cover', uploadCover.single('cover'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file uploaded' });
  const { userId } = req.body;
  const db = ensureDBShape(await readDB());
  if (!userExists(db, userId)) {
    removeFileIfExists(req.file.path);
    return res.status(401).json({ error: 'Unauthorized user.' });
  }

  const url = fileToDataUrl(req.file);
  removeFileIfExists(req.file.path);
  const newCover = { id: Date.now().toString(), userId, url, mimeType: req.file.mimetype, uploadedAt: new Date().toISOString() };
  db.coverArts.push(newCover);
  await writeDB(db);
  res.json(newCover);
});

app.delete('/api/covers/:id', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;
  const cover = db.coverArts.find((c) => c.id === req.params.id && c.userId === userId);
  if (!cover) return res.status(404).json({ error: 'Cover art not found' });

  db.coverArts = db.coverArts.filter(c => c.id !== req.params.id);
  await writeDB(db);
  res.json({ success: true });
});

// --- TRACKS ---
app.post('/api/upload', uploadTrack.single('track'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });
  const { title, userId, projectId, artist, producer } = req.body;
  const db = ensureDBShape(await readDB());
  const uploader = db.users.find(u => u.id === userId);
  if (!uploader) {
    removeFileIfExists(req.file.path);
    return res.status(401).json({ error: 'Unauthorized user.' });
  }
  if (projectId && !db.projects.some((project) => project.id === projectId && project.userId === userId)) {
    removeFileIfExists(req.file.path);
    return res.status(404).json({ error: 'Project not found' });
  }
  
  moveFileToUserDir(req.file, uploadDir, userId);
  
  const trackId = Date.now().toString();
  const newTrack = {
    id: trackId,
    userId,
    projectId: projectId || null,
    title: title || req.file.originalname,
    artist: artist || '',
    producer: producer || '',
    filename: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
    url: `${BASE_URL}/api/media/tracks/${trackId}`,
    uploader: { id: uploader.id, name: uploader.name },
    uploadedAt: new Date().toISOString()
  };
  
  db.tracks.push(newTrack);
  await writeDB(db);
  res.json({ track: newTrack });
});

app.delete('/api/tracks/:id', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;
  const track = findOwnedTrack(db, req.params.id, userId);
  if (!track) return res.status(404).json({ error: 'Track not found' });

  removeTrackFiles(track);
  removeDirIfExists(path.join(stemsDir, userId, track.id));
  db.tracks = db.tracks.filter(t => t.id !== req.params.id);
  await writeDB(db);
  res.json({ success: true });
});

app.patch('/api/tracks/:id', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;
  const trackIndex = db.tracks.findIndex((item) => item.id?.toString() === req.params.id?.toString());
  if (trackIndex === -1 || !findAccessibleTrack(db, req.params.id, userId)) {
    return res.status(404).json({ error: 'Track not found' });
  }

  const { title, notes } = req.body;
  if (title !== undefined) {
    const nextTitle = title.toString().trim();
    if (!nextTitle) return res.status(400).json({ error: 'Track title is required.' });
    db.tracks[trackIndex].title = nextTitle;
  }
  if (notes !== undefined) db.tracks[trackIndex].notes = notes.toString();

  await writeDB(db);
  res.json({ track: normalizeTrack(db.tracks[trackIndex]) });
});

app.get('/api/tracks/:id/insights', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;

  const track = findOwnedTrack(db, req.params.id, userId);
  if (!track) return res.status(404).json({ error: 'Track not found' });

  const sourceTrackId = track.sourceTrackId || track.id;
  const playEvents = db.playEvents.filter((event) => (
    event.ownerId === userId &&
    (event.sourceTrackId === sourceTrackId || event.trackId === track.id)
  ));

  const listenerMap = new Map();
  playEvents.forEach((event) => {
    const listener = db.users.find((item) => item.id === event.actorId);
    const key = event.actorId || 'unknown';
    const current = listenerMap.get(key) || {
      id: key,
      name: listener?.name || 'Unknown listener',
      avatarUrl: listener?.avatarUrl || null,
      plays: 0,
      lastListenedAt: event.createdAt
    };
    current.plays += 1;
    if (new Date(event.createdAt) > new Date(current.lastListenedAt)) current.lastListenedAt = event.createdAt;
    listenerMap.set(key, current);
  });

  res.json({
    track: { id: track.id, title: track.title },
    totalPlays: playEvents.length,
    byListener: Array.from(listenerMap.values()).sort((a, b) => b.plays - a.plays)
  });
});

app.post('/api/tracks/:id/replace-audio', uploadTrack.single('track'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;

  const trackIndex = db.tracks.findIndex((item) => item.id === req.params.id && (item.userId === userId || item.uploader?.id === userId));
  if (trackIndex === -1) {
    removeFileIfExists(req.file.path);
    return res.status(404).json({ error: 'Track not found' });
  }

  const track = db.tracks[trackIndex];
  moveFileToUserDir(req.file, uploadDir, userId);
  track.versions ||= [];

  if (track.filename) {
    track.versions.push({
      id: makeId(),
      filename: track.filename,
      mimeType: track.mimeType,
      size: track.size,
      label: `Version ${track.versions.length + 1}`,
      uploadedAt: track.uploadedAt || new Date().toISOString()
    });
  }

  track.filename = req.file.filename;
  track.mimeType = req.file.mimetype;
  track.size = req.file.size;
  track.uploadedAt = new Date().toISOString();
  db.tracks[trackIndex] = track;
  await writeDB(db);
  res.json({ track: normalizeTrack(track) });
});

app.patch('/api/tracks/:id/switch-version', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;
  const { versionId } = req.body;
  if (!versionId) return res.status(400).json({ error: 'Version ID is required.' });

  const trackIndex = db.tracks.findIndex((item) => item.id === req.params.id && (item.userId === userId || item.uploader?.id === userId));
  if (trackIndex === -1) return res.status(404).json({ error: 'Track not found' });

  const track = db.tracks[trackIndex];
  track.versions ||= [];
  const versionIndex = track.versions.findIndex((version) => version.id === versionId);
  if (versionIndex === -1) return res.status(404).json({ error: 'Version not found' });

  const selectedVersion = track.versions[versionIndex];
  const currentVersion = {
    id: makeId(),
    filename: track.filename,
    mimeType: track.mimeType,
    size: track.size,
    label: selectedVersion.label || `Version ${versionIndex + 1}`,
    uploadedAt: track.uploadedAt || new Date().toISOString()
  };

  track.versions.splice(versionIndex, 1, currentVersion);
  track.filename = selectedVersion.filename;
  track.mimeType = selectedVersion.mimeType;
  track.size = selectedVersion.size;
  track.uploadedAt = selectedVersion.uploadedAt || track.uploadedAt;
  db.tracks[trackIndex] = track;
  await writeDB(db);
  res.json({ track: normalizeTrack(track) });
});

app.delete('/api/tracks/:id/versions/:versionId', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;

  const trackIndex = db.tracks.findIndex((item) => item.id === req.params.id && (item.userId === userId || item.uploader?.id === userId));
  if (trackIndex === -1) return res.status(404).json({ error: 'Track not found' });

  const track = db.tracks[trackIndex];
  track.versions ||= [];
  const versionIndex = track.versions.findIndex((version) => version.id === req.params.versionId);
  if (versionIndex === -1) return res.status(404).json({ error: 'Version not found' });

  const [removed] = track.versions.splice(versionIndex, 1);
  removeFileIfExists(path.join(uploadDir, trackOwnerId(track), removed.filename));
  db.tracks[trackIndex] = track;
  await writeDB(db);
  res.json({ track: normalizeTrack(track) });
});

app.patch('/api/tracks/:id/versions/:versionId', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;
  const { label } = req.body;
  if (!label?.toString().trim()) return res.status(400).json({ error: 'Version label is required.' });

  const trackIndex = db.tracks.findIndex((item) => item.id === req.params.id && (item.userId === userId || item.uploader?.id === userId));
  if (trackIndex === -1) return res.status(404).json({ error: 'Track not found' });

  const track = db.tracks[trackIndex];
  track.versions ||= [];
  const version = track.versions.find((item) => item.id === req.params.versionId);
  if (!version) return res.status(404).json({ error: 'Version not found' });

  version.label = label.toString().trim();
  await writeDB(db);
  res.json({ track: normalizeTrack(track) });
});

app.get('/api/media/tracks/:id/versions/:versionId', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;

  const track = findOwnedTrack(db, req.params.id, userId);
  if (!track) return res.status(404).json({ error: 'Track not found' });

  const version = (track.versions || []).find((item) => item.id === req.params.versionId);
  if (!version) return res.status(404).json({ error: 'Version not found' });

  const filePath = path.join(uploadDir, trackOwnerId(track), version.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Version media file not found' });

  const stat = fs.statSync(filePath);
  const contentType = version.mimeType || 'audio/mpeg';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Accept-Ranges', 'bytes');
  fs.createReadStream(filePath).pipe(res);
});

app.post('/api/tracks/:id/note-memos', uploadNoteMemo.single('memo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No voice memo uploaded' });
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;

  const trackIndex = db.tracks.findIndex((item) => item.id?.toString() === req.params.id?.toString());
  const track = trackIndex === -1 ? null : findAccessibleTrack(db, req.params.id, userId);
  if (!track) {
    removeFileIfExists(req.file.path);
    return res.status(404).json({ error: 'Track not found' });
  }

  track.noteMemos ||= [];
  const memo = {
    id: makeId(),
    filename: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
    uploadedAt: new Date().toISOString()
  };
  track.noteMemos.push(memo);
  db.tracks[trackIndex] = track;
  await writeDB(db);
  res.json({ track: normalizeTrack(track), memo: { ...memo, url: `${BASE_URL}/api/media/tracks/${track.id}/note-memos/${memo.id}` } });
});

app.delete('/api/tracks/:id/note-memos/:memoId', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;

  const trackIndex = db.tracks.findIndex((item) => item.id?.toString() === req.params.id?.toString());
  const track = trackIndex === -1 ? null : findAccessibleTrack(db, req.params.id, userId);
  if (!track) return res.status(404).json({ error: 'Track not found' });

  track.noteMemos ||= [];
  const memo = track.noteMemos.find((item) => item.id === req.params.memoId);
  if (!memo) return res.status(404).json({ error: 'Voice memo not found' });

  removeFileIfExists(path.join(noteMemoDir(track), memo.filename));
  track.noteMemos = track.noteMemos.filter((item) => item.id !== req.params.memoId);
  db.tracks[trackIndex] = track;
  await writeDB(db);
  res.json({ track: normalizeTrack(track) });
});

app.get('/api/media/tracks/:id/note-memos/:memoId', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;

  const track = findAccessibleTrack(db, req.params.id, userId);
  if (!track) return res.status(404).json({ error: 'Track not found' });

  const memo = (track.noteMemos || []).find((item) => item.id === req.params.memoId);
  if (!memo) return res.status(404).json({ error: 'Voice memo not found' });

  const filePath = path.join(noteMemoDir(track), memo.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Voice memo file not found' });

  res.setHeader('Content-Type', memo.mimeType || 'audio/webm');
  res.setHeader('Accept-Ranges', 'bytes');
  fs.createReadStream(filePath).pipe(res);
});

app.post('/api/tracks/:id/split-stems', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;

  const track = findAccessibleTrack(db, req.params.id, userId);
  if (!track) {
    const rawTrack = db.tracks.find(t => t.id?.toString() === req.params.id?.toString());
    console.error('[stem-split] Track not found. trackId:', req.params.id, 'userId:', userId,
      'rawTrack:', rawTrack ? JSON.stringify({ id: rawTrack.id, userId: rawTrack.userId, uploader: rawTrack.uploader, projectId: rawTrack.projectId }) : 'not in db');
    return res.status(404).json({ error: 'Track not found' });
  }

  const sourcePath = trackMediaPath(track);
  if (!fs.existsSync(sourcePath)) {
    console.error('[stem-split] File missing at:', sourcePath);
    return res.status(404).json({ error: 'Track audio file is missing on the server. Try re-uploading this track.' });
  }

  const jobId = makeId();
  const outputRoot = path.join(stemsDir, userId, track.id, jobId);
  fs.mkdirSync(outputRoot, { recursive: true });
  stemJobs[jobId] = { progress: 5, done: false, error: null, stems: null };

  res.json({ jobId });

  (async () => {
    // Simulate incremental progress while Demucs runs (25 → 88)
    let simulatedProgress = 25;
    const progressTimer = setInterval(() => {
      if (stemJobs[jobId] && !stemJobs[jobId].done && !stemJobs[jobId].error) {
        const remaining = 88 - simulatedProgress;
        const step = Math.max(1, Math.floor(remaining * 0.12));
        simulatedProgress = Math.min(88, simulatedProgress + step);
        stemJobs[jobId].progress = simulatedProgress;
      } else {
        clearInterval(progressTimer);
      }
    }, 2000);

    try {
      stemJobs[jobId].progress = 10;
      let inputPath = sourcePath;
      const ext = path.extname(sourcePath).toLowerCase();
      if (ext !== '.wav') {
        const tempWav = path.join(outputRoot, 'input.wav');
        await convertToWav(sourcePath, tempWav);
        inputPath = tempWav;
      }

      stemJobs[jobId].progress = 25;
      await runDemucs(inputPath, outputRoot);
      clearInterval(progressTimer);
      stemJobs[jobId].progress = 90;

      const demucsOutputDir = findStemOutputDir(outputRoot);
      if (!demucsOutputDir) throw new Error('Stem output not found after Demucs processing.');

      const trackStemDir = path.join(stemsDir, userId, track.id);
      fs.mkdirSync(trackStemDir, { recursive: true });

      const stems = ['drums', 'bass', 'other', 'vocals'].map((stem) => {
        const sourceFile = fs.readdirSync(demucsOutputDir).find((file) => file.startsWith(stem));
        if (!sourceFile) return null;
        const targetName = `${stem}.wav`;
        const targetPath = path.join(trackStemDir, targetName);
        fs.copyFileSync(path.join(demucsOutputDir, sourceFile), targetPath);
        return {
          name: stem,
          filename: targetName,
          url: `${BASE_URL}/api/media/stems/${track.id}/${targetName}?userId=${encodeURIComponent(userId)}`
        };
      }).filter(Boolean);

      stemJobs[jobId].stems = stems;
      stemJobs[jobId].done = true;
      stemJobs[jobId].progress = 100;
      removeDirIfExists(outputRoot);
      setTimeout(() => delete stemJobs[jobId], 120000);
    } catch (err) {
      clearInterval(progressTimer);
      console.error('Stem split failed:', err);
      stemJobs[jobId].error = err.message || 'Stem split failed';
      removeDirIfExists(outputRoot);
      setTimeout(() => delete stemJobs[jobId], 120000);
    }
  })();
});

app.get('/api/tracks/:id/split-stems/status/:jobId', async (req, res) => {
  const { jobId } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // prevent nginx buffering

  const sendEvent = (data) => {
    try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch {}
  };

  // Send immediate ping so client knows connection is alive
  sendEvent({ progress: 5 });

  const job = stemJobs[jobId];
  if (!job) {
    sendEvent({ error: 'Job not found or already expired.' });
    return res.end();
  }

  // Keepalive comment every 15s to prevent proxy/server timeouts
  const keepalive = setInterval(() => {
    try { res.write(': keepalive\n\n'); } catch {}
  }, 15000);

  const interval = setInterval(() => {
    const currentJob = stemJobs[jobId];
    if (!currentJob) {
      sendEvent({ error: 'Job expired.' });
      clearInterval(interval); clearInterval(keepalive);
      return res.end();
    }
    if (currentJob.error) {
      sendEvent({ error: currentJob.error });
      clearInterval(interval); clearInterval(keepalive);
      res.end();
    } else if (currentJob.done) {
      sendEvent({ done: true, progress: 100, stems: currentJob.stems });
      clearInterval(interval); clearInterval(keepalive);
      res.end();
    } else {
      sendEvent({ progress: currentJob.progress });
    }
  }, 800);

  req.on('close', () => { clearInterval(interval); clearInterval(keepalive); });
});

app.get('/api/media/stems/:trackId/:filename', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;

  const track = findOwnedTrack(db, req.params.trackId, userId);
  if (!track) return res.status(404).json({ error: 'Track not found' });

  const filePath = path.join(stemsDir, userId, track.id, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Stem file not found' });

  res.setHeader('Content-Type', 'audio/wav');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
  fs.createReadStream(filePath).pipe(res);
});

app.get('/api/media/tracks/:id', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const track = db.tracks.find((item) => item.id === req.params.id);
  if (!track) return res.status(404).json({ error: 'Track not found' });

  const mediaOwnerId = track.sourceUserId || track.uploader?.id || track.userId;
  const filePath = path.join(uploadDir, mediaOwnerId, track.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Track media file not found' });

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const contentType = track.mimeType || 'audio/mpeg';
  const range = req.headers.range;

  res.setHeader('Content-Type', contentType);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

  if (!range) {
    res.setHeader('Content-Length', fileSize);
    return fs.createReadStream(filePath).pipe(res);
  }

  const parts = range.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
  if (Number.isNaN(start) || Number.isNaN(end) || start >= fileSize || end >= fileSize) {
    res.setHeader('Content-Range', `bytes */${fileSize}`);
    return res.status(416).end();
  }

  res.status(206);
  res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
  res.setHeader('Content-Length', end - start + 1);
  fs.createReadStream(filePath, { start, end }).pipe(res);
});

app.post('/api/convert', uploadTrack.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No video file uploaded' });
  const { userId } = req.body;
  const db = ensureDBShape(await readDB());
  const uploader = db.users.find(u => u.id === userId);
  if (!uploader) {
    removeFileIfExists(req.file.path);
    return res.status(401).json({ error: 'Unauthorized user.' });
  }

  const originalNameNoExt = path.basename(req.file.originalname, path.extname(req.file.originalname));
  const newFilename = Date.now() + '-' + Math.round(Math.random() * 1e9) + '.wav';
  const userDir = ensureUserDir(uploadDir, userId);
  const outputPath = path.join(userDir, newFilename);
  const jobId = makeId();
  conversionJobs[jobId] = { progress: 0, done: false, error: null };
  res.json({ jobId });

  ffmpeg(req.file.path)
    .noVideo()
    .audioCodec('pcm_s16le')
    .audioFrequency(44100)
    .on('progress', (progress) => {
      if (progress.percent) {
        conversionJobs[jobId].progress = Math.round(progress.percent);
      }
    })
    .on('end', () => {
      removeFileIfExists(req.file.path);
      const currentDb = readDB();
      const projectId = makeId();
      const newProject = {
        id: projectId,
        name: originalNameNoExt,
        title: originalNameNoExt,
        artist: uploader.name,
        userId,
        folderId: null,
        coverArt: null,
        createdAt: new Date().toISOString()
      };
      currentDb.projects.push(newProject);

      const trackId = makeId();
      const newTrack = {
        id: trackId,
        userId,
        projectId: projectId,
        title: originalNameNoExt,
        artist: uploader.name,
        producer: '',
        filename: newFilename,
        mimeType: 'audio/wav',
        size: fs.statSync(outputPath).size,
        url: `${BASE_URL}/api/media/tracks/${trackId}`,
        uploader: { id: uploader.id, name: uploader.name },
        uploadedAt: new Date().toISOString()
      };
      currentDb.tracks.push(newTrack);
      
      writeDB(currentDb);
      conversionJobs[jobId].done = true;
      conversionJobs[jobId].project = newProject;
      conversionJobs[jobId].track = newTrack;
      setTimeout(() => delete conversionJobs[jobId], 60000); // cleanup
    })
    .on('error', (err) => {
      console.error('ffmpeg error:', err);
      removeFileIfExists(req.file.path);
      conversionJobs[jobId].error = 'Conversion failed';
      setTimeout(() => delete conversionJobs[jobId], 60000); // cleanup
    })
    .save(outputPath);
});

app.get('/api/convert/status/:jobId', async (req, res) => {
  const { jobId } = req.params;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const job = conversionJobs[jobId];
  if (!job) {
    sendEvent({ error: 'Job not found' });
    return res.end();
  }

  const interval = setInterval(() => {
    const currentJob = conversionJobs[jobId];
    if (!currentJob) {
      clearInterval(interval);
      return res.end();
    }
    
    if (currentJob.error) {
      sendEvent({ error: currentJob.error });
      clearInterval(interval);
      res.end();
    } else if (currentJob.done) {
      sendEvent({ done: true, progress: 100, project: currentJob.project, track: currentJob.track });
      clearInterval(interval);
      res.end();
    } else {
      sendEvent({ progress: currentJob.progress });
    }
  }, 500);

  req.on('close', () => clearInterval(interval));
});

// --- CHAT ---
const groupParticipantIds = (db) => db.users.map((user) => user.id);
const chatRecipientIds = (db, message) => {
  if (message.conversationType === 'group') {
    return groupParticipantIds(db).filter((id) => id !== message.senderId);
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
  participants: (call.participantIds || [])
    .map((id) => publicUser(db.users.find((user) => user.id === id)))
    .filter(Boolean)
} : null;
const markConversationRead = (db, { userId, type, partnerId }) => {
  db.messages.forEach((message) => {
    const isVisible = type === 'group'
      ? message.conversationType === 'group'
      : message.conversationType === 'dm' &&
        ((message.senderId === userId && message.recipientId === partnerId) ||
          (message.senderId === partnerId && message.recipientId === userId));

    if (isVisible && message.senderId !== userId) {
      message.readBy ||= [];
      if (!message.readBy.includes(userId)) message.readBy.push(userId);
    }
  });
  db.notifications.forEach((notification) => {
    const isChatNotification = notification.type === 'message' && notification.userId === userId &&
      (type === 'group'
        ? notification.chat?.type === 'group'
        : notification.chat?.type === 'dm' && notification.actor?.id === partnerId);
    if (isChatNotification) notification.read = true;
  });
};
const createMessage = (db, { senderId, recipientId, conversationType, text = '', attachments = [], replyToMessageId = null, forwardedFrom = null }) => {
  const type = conversationType || 'dm';
  const recipients = type === 'group' ? groupParticipantIds(db).filter((id) => id !== senderId) : [recipientId].filter(Boolean);
  return {
    id: makeId(),
    senderId,
    recipientId: type === 'group' ? null : recipientId,
    conversationType: type,
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

app.get('/api/calls/group', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;
  if (!userExists(db, userId)) return res.status(401).json({ error: 'Unauthorized user.' });
  const call = db.calls.find((item) => item.type === 'group' && item.active);
  res.json({ call: hydrateCall(db, call) });
});

app.post('/api/calls/group/join', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const { userId } = req.body;
  const caller = db.users.find((user) => user.id === userId);
  if (!caller) return res.status(401).json({ error: 'Unauthorized user.' });

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
});

app.post('/api/calls/group/leave', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const { userId } = req.body;
  if (!userExists(db, userId)) return res.status(401).json({ error: 'Unauthorized user.' });
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
});

app.get('/api/calls/group/signals', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;
  if (!userExists(db, userId)) return res.status(401).json({ error: 'Unauthorized user.' });
  const call = db.calls.find((item) => item.type === 'group' && item.active);
  if (!call) return res.json({ signals: [] });

  const signals = db.callSignals
    .filter((signal) => signal.callId === call.id && signal.toUserId === userId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  res.json({ signals });
});

app.post('/api/calls/group/signals', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const { userId, toUserId, type, payload } = req.body;
  if (!userExists(db, userId) || !userExists(db, toUserId)) return res.status(401).json({ error: 'Unauthorized user.' });
  const call = db.calls.find((item) => item.type === 'group' && item.active);
  if (!call) return res.status(404).json({ error: 'No active call.' });
  if (!call.participantIds.includes(userId) || !call.participantIds.includes(toUserId)) {
    return res.status(403).json({ error: 'Both users must be in the call.' });
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
});

// Get all users (for chat contacts)
app.get('/api/users', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;
  if (!userExists(db, userId)) return res.status(401).json({ error: 'Unauthorized user.' });
  const others = db.users.filter((u) => u.id !== userId).map(publicUser);
  res.json({ users: others });
});

// Get messages between two users (DM) or group
// conversationType: 'dm' | 'group'
// For dm: partnerId required
// For group: returns all group messages
app.get('/api/messages', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;
  if (!userExists(db, userId)) return res.status(401).json({ error: 'Unauthorized user.' });

  const { type, partnerId } = req.query;

  let msgs;
  if (type === 'group') {
    msgs = await Message.find({ conversationType: 'group' }).lean().sort({ createdAt: 1 });
  } else {
    if (!partnerId) return res.status(400).json({ error: 'partnerId required for DM.' });
    msgs = await Message.find({
      conversationType: 'dm',
      $or: [
        { senderId: userId, recipientId: partnerId },
        { senderId: partnerId, recipientId: userId }
      ]
    }).lean().sort({ createdAt: 1 });
  }

  // Mark as read directly in MongoDB
  await Message.updateMany(
    type === 'group'
      ? { conversationType: 'group', readBy: { $ne: userId } }
      : { conversationType: 'dm', senderId: partnerId, recipientId: userId, readBy: { $ne: userId } },
    { $addToSet: { readBy: userId } }
  );

  res.json({
    messages: msgs.map((m) => hydrateMessage(db, m)),
    participants: type === 'group' ? db.users.map(publicUser) : []
  });
});

// Send a message
app.post('/api/messages', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const { senderId, recipientId, conversationType, text, replyToMessageId } = req.body;
  if (!senderId || !text?.trim()) return res.status(400).json({ error: 'senderId and text required.' });
  if (!userExists(db, senderId)) return res.status(401).json({ error: 'Unauthorized user.' });
  if (conversationType === 'dm' && !recipientId) return res.status(400).json({ error: 'recipientId required for DM.' });

  const msg = createMessage(db, { senderId, recipientId, conversationType, text, replyToMessageId });

  // Write directly to MongoDB for reliability
  await Message.create(msg);

  // Notify (uses in-memory db for user lookup)
  db.messages.push(msg);
  notifyMessage(db, msg);

  // Write notifications only
  const newNotifs = db.notifications.filter(n => !n._saved);
  for (const n of newNotifs) {
    await Notification.findOneAndUpdate({ id: n.id }, n, { upsert: true });
    n._saved = true;
  }

  res.json({ message: hydrateMessage(db, msg) });
});

app.post('/api/messages/media', uploadChatMedia.single('media'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No media uploaded.' });
  const db = ensureDBShape(await readDB());
  const { senderId, recipientId, conversationType, text, replyToMessageId, mediaKind } = req.body;
  if (!senderId || !userExists(db, senderId)) {
    removeFileIfExists(req.file.path);
    return res.status(401).json({ error: 'Unauthorized user.' });
  }
  if (conversationType === 'dm' && !recipientId) return res.status(400).json({ error: 'recipientId required for DM.' });

  const attachmentType = req.file.mimetype.startsWith('image/')
    ? 'image'
    : req.file.mimetype.startsWith('video/')
      ? 'video'
      : 'voice';
  if (attachmentType === 'voice' && mediaKind !== 'voice') {
    removeFileIfExists(req.file.path);
    return res.status(400).json({ error: 'Only photos and videos can be shared from files.' });
  }

  const relativePath = `chat/${senderId}/${req.file.filename}`.replace(/\\/g, '/');
  const msg = createMessage(db, {
    senderId,
    recipientId,
    conversationType,
    text: text || '',
    replyToMessageId: replyToMessageId || null,
    attachments: [{
      id: makeId(),
      type: attachmentType,
      url: `${BASE_URL}/uploads/${relativePath}`,
      name: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size
    }]
  });

  db.messages.push(msg);
  notifyMessage(db, msg);
  await writeDB(db);
  res.json({ message: hydrateMessage(db, msg) });
});

app.patch('/api/messages/:id/pin', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const { userId, pinned } = req.body;
  const message = db.messages.find((item) => item.id === req.params.id);
  if (!message) return res.status(404).json({ error: 'Message not found.' });
  if (!userExists(db, userId)) return res.status(401).json({ error: 'Unauthorized user.' });
  message.pinned = Boolean(pinned);
  message.pinnedBy = pinned ? userId : null;
  message.pinnedAt = pinned ? new Date().toISOString() : null;
  await writeDB(db);
  res.json({ message: hydrateMessage(db, message) });
});

app.delete('/api/messages/:id', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;
  const message = db.messages.find((item) => item.id === req.params.id);
  if (!message) return res.status(404).json({ error: 'Message not found.' });
  if (message.senderId !== userId) return res.status(403).json({ error: 'Only the sender can delete this message.' });
  message.deleted = true;
  message.text = '';
  message.attachments = [];
  message.deletedAt = new Date().toISOString();
  await writeDB(db);
  res.json({ message: hydrateMessage(db, message) });
});

app.post('/api/messages/:id/forward', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const { senderId, targetType, recipientId } = req.body;
  const source = db.messages.find((item) => item.id === req.params.id);
  if (!source) return res.status(404).json({ error: 'Message not found.' });
  if (!userExists(db, senderId)) return res.status(401).json({ error: 'Unauthorized user.' });
  if (targetType === 'dm' && !recipientId) return res.status(400).json({ error: 'recipientId required for DM forward.' });

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
});

// Get conversation previews (last message per convo) for a user
app.get('/api/conversations', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;
  if (!userExists(db, userId)) return res.status(401).json({ error: 'Unauthorized user.' });

  const others = db.users.filter((u) => u.id !== userId);
  const conversations = [];

  // Read messages directly from MongoDB for accuracy
  const allMessages = await Message.find({
    $or: [
      { conversationType: 'group' },
      { conversationType: 'dm', $or: [{ senderId: userId }, { recipientId: userId }] }
    ]
  }).lean();
  db.messages = allMessages;

  // Group always first (Rare Motion HQ)
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

  // DMs — always include ALL other users even if no messages yet
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

  // Sort DMs by last message (group stays first due to '9999' updatedAt)
  conversations.sort((a, b) => {
    if (!a.updatedAt && !b.updatedAt) return 0;
    if (!a.updatedAt) return 1;
    if (!b.updatedAt) return -1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  res.json({ conversations });
});

app.post('/api/notifications/read', async (req, res) => {
  const db = ensureDBShape(await readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;

  db.notifications.forEach((notif) => {
    if (notif.userId === userId) {
      notif.read = true;
    }
  });

  await writeDB(db);
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`Backend server running on http://localhost:${PORT}`));
// End of server file