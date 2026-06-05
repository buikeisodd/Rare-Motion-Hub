const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const BASE_URL = process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || 'https://rare-motion-hub.onrender.com';

app.use(cors());
app.use(express.json());
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
const getProjectBundle = (db, project) => ({
  type: 'project',
  project,
  owner: publicUser(db.users.find((user) => user.id === project.userId)),
  tracks: db.tracks.filter((track) => track.projectId === project.id)
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
app.put('/api/users/:id', (req, res) => {
  const { name } = req.body;
  const db = ensureDBShape(readDB());
  const userIndex = db.users.findIndex((user) => user.id === req.params.id);
  if (userIndex === -1) return res.status(404).json({ error: 'User not found.' });

  const nextName = name?.trim();
  if (!nextName) return res.status(400).json({ error: 'Username is required.' });

  db.users[userIndex] = { ...db.users[userIndex], name: nextName };
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

  res.json({
    folders: db.folders.filter((folder) => folder.userId === userId),
    projects: db.projects.filter((project) => project.userId === userId),
    tracks: db.tracks.filter((track) => track.userId === userId || track.uploader?.id === userId),
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
    folder,
    owner: publicUser(db.users.find((user) => user.id === folder.userId)),
    projects,
    tracks: db.tracks.filter((track) => projectIds.includes(track.projectId))
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
app.post('/api/folders', (req, res) => {
  const { name, userId } = req.body;
  const db = readDB();
  if (!userExists(db, userId)) return res.status(401).json({ error: 'Unauthorized user.' });
  const newFolder = { id: Date.now().toString(), name, userId, createdAt: new Date().toISOString() };
  db.folders.push(newFolder);
  writeDB(db);
  res.json(newFolder);
});

// --- PROJECTS ---
app.post('/api/projects', (req, res) => {
  const { name, userId, folderId } = req.body;
  const db = readDB();
  if (!userExists(db, userId)) return res.status(401).json({ error: 'Unauthorized user.' });
  if (folderId && !db.folders.some((folder) => folder.id === folderId && folder.userId === userId)) {
    return res.status(404).json({ error: 'Folder not found' });
  }
  const newProject = { 
    id: Date.now().toString(), 
    name, 
    userId, 
    folderId: folderId || null,
    coverArt: null,
    createdAt: new Date().toISOString() 
  };
  db.projects.push(newProject);
  writeDB(db);
  res.json(newProject);
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

  moveFileToUserDir(req.file, coverDir, userId);
  const url = `${BASE_URL}/covers/${userId}/${req.file.filename}`;
  const newCover = { id: Date.now().toString(), userId, url, uploadedAt: new Date().toISOString() };
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
  
  const newTrack = {
    id: Date.now().toString(),
    userId,
    projectId: projectId || null,
    title: title || req.file.originalname,
    artist: artist || '',
    producer: producer || '',
    filename: req.file.filename,
    url: `${BASE_URL}/uploads/${userId}/${req.file.filename}`,
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
    conversations.push({
      type: 'dm',
      partner: publicUser(other),
      lastMessage: last ? hydrateMessage(db, last) : null,
      updatedAt: last?.createdAt || null
    });
  }

  // Group
  const groupMsgs = db.messages.filter((m) => m.conversationType === 'group');
  const lastGroup = groupMsgs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
  conversations.push({
    type: 'group',
    partner: null,
    participants: db.users.map(publicUser),
    lastMessage: lastGroup ? hydrateMessage(db, lastGroup) : null,
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
