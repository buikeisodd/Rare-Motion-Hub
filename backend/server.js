const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = process.env.PORT || 3001;

const conversionJobs = {};
const BASE_URL = process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || 'https://rare-motion-hub.onrender.com';

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

const dbPath = path.join(__dirname, 'db.json');
const uploadDir = path.join(__dirname, 'uploads');
const coverDir = path.join(__dirname, 'covers');
const avatarDir = path.join(__dirname, 'avatars');
const chatDir = path.join(uploadDir, 'chat');
const JSONBIN_BASE_URL = 'https://api.jsonbin.io/v3';
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_MASTER_KEY = process.env.JSONBIN_MASTER_KEY || process.env.JSONBIN_API_KEY;
const JSONBIN_ACCESS_KEY = process.env.JSONBIN_ACCESS_KEY;

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(coverDir)) fs.mkdirSync(coverDir);
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir);
if (!fs.existsSync(chatDir)) fs.mkdirSync(chatDir, { recursive: true });

// Helpers
const readDB = () => JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const jsonBinHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  if (JSONBIN_MASTER_KEY) headers['X-Master-Key'] = JSONBIN_MASTER_KEY;
  if (JSONBIN_ACCESS_KEY) headers['X-Access-Key'] = JSONBIN_ACCESS_KEY;
  return headers;
};
const isJsonBinConfigured = () => Boolean(JSONBIN_BIN_ID && (JSONBIN_MASTER_KEY || JSONBIN_ACCESS_KEY));
const syncFromJSONBin = async () => {
  if (!isJsonBinConfigured()) return;
  try {
    const res = await fetch(`${JSONBIN_BASE_URL}/b/${JSONBIN_BIN_ID}/latest`, {
      headers: { ...jsonBinHeaders(), 'X-Bin-Meta': 'false' }
    });
    if (!res.ok) throw new Error(`JSONBin read failed: ${res.status}`);
    const remoteDB = ensureDBShape(await res.json());
    fs.writeFileSync(dbPath, JSON.stringify(remoteDB, null, 2), 'utf8');
    console.log('Database loaded from JSONBin.io');
  } catch (err) {
    console.warn(`JSONBin.io read skipped: ${err.message}`);
  }
};
const syncToJSONBin = async (data) => {
  if (!isJsonBinConfigured()) return;
  try {
    const res = await fetch(`${JSONBIN_BASE_URL}/b/${JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: jsonBinHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`JSONBin update failed: ${res.status}`);
  } catch (err) {
    console.warn(`JSONBin.io write skipped: ${err.message}`);
  }
};
const writeDB = (data) => {
  const shaped = ensureDBShape(data);
  fs.writeFileSync(dbPath, JSON.stringify(shaped, null, 2), 'utf8');
  syncToJSONBin(shaped);
};
const ensureDBShape = (db) => {
  db.folders ||= [];
  db.projects ||= [];
  db.tracks ||= [];
  db.coverArts ||= [];
  db.notifications ||= [];
  db.playEvents ||= [];
  db.messages ||= [];
  db.calls ||= [];
  db.callSignals ||= [];
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
  url: track.filename ? `${BASE_URL}/api/media/tracks/${track.id}` : track.url
});
const getProjectBundle = (db, project) => ({
  type: 'project',
  project: normalizeLibraryItem(project, db, 'project'),
  owner: publicUser(db.users.find((user) => user.id === project.userId)),
  tracks: db.tracks.filter((track) => track.projectId === project.id).map(normalizeTrack)
});
const notifyListen = (db, { ownerId, actorId, project, folder, track }) => {
  if (!ownerId || !actorId || ownerId === actorId) return;
  const actor = db.users.find((user) => user.id === actorId);
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
app.post('/api/auth', (req, res) => {
  const email = req.body.email?.trim();
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  const db = readDB();
  const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (user) res.json({ user });
  else res.status(401).json({ error: 'Unauthorized email. Only specific users are allowed.' });
});

// --- USERS ---
app.get('/api/users/:id', (req, res) => {
  const db = ensureDBShape(readDB());
  const user = db.users.find((item) => item.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user });
});

app.put('/api/users/:id', (req, res) => {
  const { name } = req.body;
  const db = ensureDBShape(readDB());
  const userIndex = db.users.findIndex((user) => user.id === req.params.id);
  if (userIndex === -1) return res.status(404).json({ error: 'User not found.' });

  const nextName = name?.trim();
  if (!nextName) return res.status(400).json({ error: 'Username is required.' });

  db.users[userIndex] = { ...db.users[userIndex], name: nextName, updatedAt: new Date().toISOString() };
  writeDB(db);
  res.json({ user: db.users[userIndex] });
});

app.post('/api/users/:id/avatar', uploadAvatar.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No profile image uploaded.' });
  const db = ensureDBShape(readDB());
  const userIndex = db.users.findIndex((user) => user.id === req.params.id);
  if (userIndex === -1) {
    removeFileIfExists(req.file.path);
    return res.status(404).json({ error: 'User not found.' });
  }

  moveFileToUserDir(req.file, avatarDir, req.params.id);
  db.users[userIndex].avatarUrl = `${BASE_URL}/avatars/${req.params.id}/${req.file.filename}`;
  db.users[userIndex].avatarUpdatedAt = new Date().toISOString();
  db.users[userIndex].updatedAt = db.users[userIndex].avatarUpdatedAt;
  writeDB(db);
  res.json({ user: db.users[userIndex] });
});

app.delete('/api/users/:id', (req, res) => {
  const db = ensureDBShape(readDB());
  const user = db.users.find((item) => item.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  db.users = db.users.filter((item) => item.id !== req.params.id);
  db.folders = db.folders.filter((folder) => folder.userId !== req.params.id);
  db.projects = db.projects.filter((project) => project.userId !== req.params.id);
  db.tracks = db.tracks.filter((track) => track.userId !== req.params.id && track.uploader?.id !== req.params.id);
  db.coverArts = db.coverArts.filter((cover) => cover.userId !== req.params.id);
  db.notifications = db.notifications.filter((notification) => notification.userId !== req.params.id && notification.actor?.id !== req.params.id);
  db.playEvents = db.playEvents.filter((event) => event.ownerId !== req.params.id && event.actorId !== req.params.id);
  writeDB(db);

  removeDirIfExists(getUserDir(uploadDir, req.params.id));
  removeDirIfExists(getUserDir(coverDir, req.params.id));
  removeDirIfExists(getUserDir(avatarDir, req.params.id));
  res.json({ success: true });
});

// --- DATA FETCHING ---
app.get('/api/workspace', (req, res) => {
  const db = ensureDBShape(readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;
  if (!userExists(db, userId)) return res.status(401).json({ error: 'Unauthorized user.' });

  // Only return root-level items (not nested inside any folder)
  const rootFolders = db.folders.filter((folder) => folder.userId === userId && !folder.parentFolderId);
  const rootProjects = db.projects.filter((project) => project.userId === userId && !project.folderId);
  res.json({
    folders: rootFolders.map((folder) => normalizeLibraryItem(folder, db, 'folder')),
    projects: rootProjects.map((project) => normalizeLibraryItem(project, db, 'project')),
    tracks: db.tracks.filter((track) => track.userId === userId || track.uploader?.id === userId).map(normalizeTrack),
    coverArts: db.coverArts.filter((cover) => cover.userId === userId),
    notifications: db.notifications.filter((notification) => notification.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  });
});

// --- SHARING ---
app.get('/api/share/project/:id', (req, res) => {
  const db = ensureDBShape(readDB());
  const project = db.projects.find((item) => item.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  res.json(getProjectBundle(db, project));
});

app.get('/api/share/folder/:id', (req, res) => {
  const db = ensureDBShape(readDB());
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

app.post('/api/share/project/:id/save', (req, res) => {
  const { userId } = req.body;
  const db = ensureDBShape(readDB());
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
  writeDB(db);
  res.json({ project: nextProject, tracks: copiedTracks });
});

app.post('/api/share/folder/:id/save', (req, res) => {
  const { userId } = req.body;
  const db = ensureDBShape(readDB());
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
  writeDB(db);
  res.json({ folder: nextFolder, projects: copiedProjects, tracks: copiedTracks });
});

app.post('/api/listen', (req, res) => {
  const { userId, projectId, folderId, trackId } = req.body;
  const db = ensureDBShape(readDB());
  if (!userExists(db, userId)) return res.status(401).json({ error: 'Unauthorized user.' });

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
  writeDB(db);
  res.json({ success: true });
});

// --- FOLDERS ---
app.get('/api/folders/:id', (req, res) => {
  const db = ensureDBShape(readDB());
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

app.post('/api/folders', (req, res) => {
  const { name, title, artist, userId, parentFolderId } = req.body;
  const db = ensureDBShape(readDB());
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
  writeDB(db);
  res.json(newFolder);
});

app.put('/api/folders/:id/move', (req, res) => {
  const { userId, parentFolderId } = req.body;
  const db = readDB();
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
  writeDB(db);
  res.json(db.folders[folderIndex]);
});

app.put('/api/folders/:id', (req, res) => {
  const { userId, title, name, artist } = req.body;
  const db = ensureDBShape(readDB());
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
  writeDB(db);
  res.json(normalizeLibraryItem(db.folders[folderIndex], db, 'folder'));
});

// --- PROJECTS ---
app.post('/api/projects', (req, res) => {
  const { name, title, artist, userId, folderId } = req.body;
  const db = ensureDBShape(readDB());
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
  writeDB(db);
  res.json(newProject);
});

app.put('/api/projects/:id', (req, res) => {
  const { userId, title, name, artist } = req.body;
  const db = ensureDBShape(readDB());
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
  writeDB(db);
  res.json(normalizeLibraryItem(db.projects[projectIndex], db, 'project'));
});

app.put('/api/projects/:id/move', (req, res) => {
  const { folderId, userId } = req.body;
  const db = readDB();
  const projIndex = db.projects.findIndex(p => p.id === req.params.id && p.userId === userId);
  if (projIndex === -1) return res.status(404).json({ error: 'Project not found' });
  if (folderId && !db.folders.some((folder) => folder.id === folderId && folder.userId === userId)) {
    return res.status(404).json({ error: 'Folder not found' });
  }
  
  db.projects[projIndex].folderId = folderId; // Can be null to move to root
  writeDB(db);
  res.json(db.projects[projIndex]);
});

app.delete('/api/projects/:id', (req, res) => {
  const db = readDB();
  const userId = requireUserId(req, res);
  if (!userId) return;
  const project = db.projects.find((p) => p.id === req.params.id && p.userId === userId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  db.projects = db.projects.filter(p => p.id !== req.params.id);
  db.tracks = db.tracks.filter(t => !(t.projectId === req.params.id && (t.userId === userId || t.uploader?.id === userId)));
  writeDB(db);
  res.json({ success: true });
});

app.put('/api/projects/:id/cover', (req, res) => {
  const { coverUrl, userId } = req.body;
  const db = readDB();
  const projIndex = db.projects.findIndex(p => p.id === req.params.id && p.userId === userId);
  if (projIndex === -1) return res.status(404).json({ error: 'Project not found' });
  if (coverUrl && !db.coverArts.some((cover) => cover.url === coverUrl && cover.userId === userId)) {
    return res.status(404).json({ error: 'Cover art not found' });
  }
  
  db.projects[projIndex].coverArt = coverUrl;
  writeDB(db);
  res.json(db.projects[projIndex]);
});

app.get('/api/projects/:id/insights', (req, res) => {
  const db = ensureDBShape(readDB());
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
app.post('/api/upload-cover', uploadCover.single('cover'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file uploaded' });
  const { userId } = req.body;
  const db = readDB();
  if (!userExists(db, userId)) {
    removeFileIfExists(req.file.path);
    return res.status(401).json({ error: 'Unauthorized user.' });
  }

  const url = fileToDataUrl(req.file);
  removeFileIfExists(req.file.path);
  const newCover = { id: Date.now().toString(), userId, url, mimeType: req.file.mimetype, uploadedAt: new Date().toISOString() };
  db.coverArts.push(newCover);
  writeDB(db);
  res.json(newCover);
});

app.delete('/api/covers/:id', (req, res) => {
  const db = readDB();
  const userId = requireUserId(req, res);
  if (!userId) return;
  const cover = db.coverArts.find((c) => c.id === req.params.id && c.userId === userId);
  if (!cover) return res.status(404).json({ error: 'Cover art not found' });

  db.coverArts = db.coverArts.filter(c => c.id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

// --- TRACKS ---
app.post('/api/upload', uploadTrack.single('track'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });
  const { title, userId, projectId, artist, producer } = req.body;
  const db = readDB();
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
  writeDB(db);
  res.json({ track: newTrack });
});

app.delete('/api/tracks/:id', (req, res) => {
  const db = readDB();
  const userId = requireUserId(req, res);
  if (!userId) return;
  const track = db.tracks.find((t) => t.id === req.params.id && (t.userId === userId || t.uploader?.id === userId));
  if (!track) return res.status(404).json({ error: 'Track not found' });

  db.tracks = db.tracks.filter(t => t.id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

app.get('/api/media/tracks/:id', (req, res) => {
  const db = ensureDBShape(readDB());
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

app.post('/api/convert', uploadTrack.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No video file uploaded' });
  const { userId } = req.body;
  const db = readDB();
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

app.get('/api/convert/status/:jobId', (req, res) => {
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

app.get('/api/calls/group', (req, res) => {
  const db = ensureDBShape(readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;
  if (!userExists(db, userId)) return res.status(401).json({ error: 'Unauthorized user.' });
  const call = db.calls.find((item) => item.type === 'group' && item.active);
  res.json({ call: hydrateCall(db, call) });
});

app.post('/api/calls/group/join', (req, res) => {
  const db = ensureDBShape(readDB());
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
  writeDB(db);
  res.json({ call: hydrateCall(db, call) });
});

app.post('/api/calls/group/leave', (req, res) => {
  const db = ensureDBShape(readDB());
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
  writeDB(db);
  res.json({ call: hydrateCall(db, call.active ? call : null) });
});

app.get('/api/calls/group/signals', (req, res) => {
  const db = ensureDBShape(readDB());
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

app.post('/api/calls/group/signals', (req, res) => {
  const db = ensureDBShape(readDB());
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
  writeDB(db);
  res.json({ signal });
});

// Get all users (for chat contacts)
app.get('/api/users', (req, res) => {
  const db = ensureDBShape(readDB());
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
app.get('/api/messages', (req, res) => {
  const db = ensureDBShape(readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;
  if (!userExists(db, userId)) return res.status(401).json({ error: 'Unauthorized user.' });

  const { type, partnerId } = req.query;

  let msgs;
  if (type === 'group') {
    msgs = db.messages.filter((m) => m.conversationType === 'group');
  } else {
    if (!partnerId) return res.status(400).json({ error: 'partnerId required for DM.' });
    msgs = db.messages.filter(
      (m) => m.conversationType === 'dm' &&
        ((m.senderId === userId && m.recipientId === partnerId) ||
          (m.senderId === partnerId && m.recipientId === userId))
    );
  }

  markConversationRead(db, { userId, type, partnerId });
  writeDB(db);

  res.json({
    messages: msgs.map((message) => hydrateMessage(db, message)),
    participants: type === 'group' ? db.users.map(publicUser) : []
  });
});

// Send a message
app.post('/api/messages', (req, res) => {
  const db = ensureDBShape(readDB());
  const { senderId, recipientId, conversationType, text, replyToMessageId } = req.body;
  if (!senderId || !text?.trim()) return res.status(400).json({ error: 'senderId and text required.' });
  if (!userExists(db, senderId)) return res.status(401).json({ error: 'Unauthorized user.' });

  if (conversationType === 'dm' && !recipientId) return res.status(400).json({ error: 'recipientId required for DM.' });

  const msg = createMessage(db, { senderId, recipientId, conversationType, text, replyToMessageId });

  db.messages.push(msg);
  notifyMessage(db, msg);
  writeDB(db);

  res.json({ message: hydrateMessage(db, msg) });
});

app.post('/api/messages/media', uploadChatMedia.single('media'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No media uploaded.' });
  const db = ensureDBShape(readDB());
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
  writeDB(db);
  res.json({ message: hydrateMessage(db, msg) });
});

app.patch('/api/messages/:id/pin', (req, res) => {
  const db = ensureDBShape(readDB());
  const { userId, pinned } = req.body;
  const message = db.messages.find((item) => item.id === req.params.id);
  if (!message) return res.status(404).json({ error: 'Message not found.' });
  if (!userExists(db, userId)) return res.status(401).json({ error: 'Unauthorized user.' });
  message.pinned = Boolean(pinned);
  message.pinnedBy = pinned ? userId : null;
  message.pinnedAt = pinned ? new Date().toISOString() : null;
  writeDB(db);
  res.json({ message: hydrateMessage(db, message) });
});

app.delete('/api/messages/:id', (req, res) => {
  const db = ensureDBShape(readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;
  const message = db.messages.find((item) => item.id === req.params.id);
  if (!message) return res.status(404).json({ error: 'Message not found.' });
  if (message.senderId !== userId) return res.status(403).json({ error: 'Only the sender can delete this message.' });
  message.deleted = true;
  message.text = '';
  message.attachments = [];
  message.deletedAt = new Date().toISOString();
  writeDB(db);
  res.json({ message: hydrateMessage(db, message) });
});

app.post('/api/messages/:id/forward', (req, res) => {
  const db = ensureDBShape(readDB());
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
  writeDB(db);
  res.json({ message: hydrateMessage(db, msg) });
});

// Get conversation previews (last message per convo) for a user
app.get('/api/conversations', (req, res) => {
  const db = ensureDBShape(readDB());
  const userId = requireUserId(req, res);
  if (!userId) return;
  if (!userExists(db, userId)) return res.status(401).json({ error: 'Unauthorized user.' });

  const others = db.users.filter((u) => u.id !== userId);
  const conversations = [];

  // DMs
  for (const other of others) {
    const msgs = db.messages.filter(
      (m) => m.conversationType === 'dm' &&
        ((m.senderId === userId && m.recipientId === other.id) ||
          (m.senderId === other.id && m.recipientId === userId))
    );
    const last = msgs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
    const unreadCount = msgs.filter((message) => message.senderId === other.id && !(message.readBy || []).includes(userId)).length;
    conversations.push({
      type: 'dm',
      partner: publicUser(other),
      lastMessage: last ? hydrateMessage(db, last) : null,
      unreadCount,
      updatedAt: last?.createdAt || null
    });
  }

  // Group
  const groupMsgs = db.messages.filter((m) => m.conversationType === 'group');
  const lastGroup = groupMsgs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
  const groupUnreadCount = groupMsgs.filter((message) => message.senderId !== userId && !(message.readBy || []).includes(userId)).length;
  conversations.push({
    type: 'group',
    partner: null,
    participants: db.users.map(publicUser),
    lastMessage: lastGroup ? hydrateMessage(db, lastGroup) : null,
    unreadCount: groupUnreadCount,
    updatedAt: lastGroup?.createdAt || null
  });

  conversations.sort((a, b) => {
    if (!a.updatedAt && !b.updatedAt) return 0;
    if (!a.updatedAt) return 1;
    if (!b.updatedAt) return -1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  res.json({ conversations });
});

syncFromJSONBin().finally(() => {
  app.listen(PORT, () => console.log(`Backend server running on http://localhost:${PORT}`));
});
// End of server file