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

const dbPath = path.join(__dirname, 'db.json');
const uploadDir = path.join(__dirname, 'uploads');
const coverDir = path.join(__dirname, 'covers');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(coverDir)) fs.mkdirSync(coverDir);

// Helpers
const readDB = () => JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const writeDB = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
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
const requireUserId = (req, res) => {
  const userId = (req.query.userId || req.body.userId || '').toString();
  if (!userId) {
    res.status(400).json({ error: 'User ID is required.' });
    return null;
  }
  return userId;
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

// --- AUTH ---
app.post('/api/auth', (req, res) => {
  const email = req.body.email?.trim();
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  const db = readDB();
  const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (user) res.json({ user });
  else res.status(401).json({ error: 'Unauthorized email. Only specific users are allowed.' });
});

// --- DATA FETCHING ---
app.get('/api/workspace', (req, res) => {
  const db = readDB();
  const userId = requireUserId(req, res);
  if (!userId) return;
  if (!userExists(db, userId)) return res.status(401).json({ error: 'Unauthorized user.' });

  res.json({
    folders: db.folders.filter((folder) => folder.userId === userId),
    projects: db.projects.filter((project) => project.userId === userId),
    tracks: db.tracks.filter((track) => track.userId === userId || track.uploader?.id === userId),
    coverArts: db.coverArts.filter((cover) => cover.userId === userId)
  });
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

app.listen(PORT, () => console.log(`Backend server running on http://localhost:${PORT}`));
// End of server file
