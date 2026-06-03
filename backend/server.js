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
  const { email } = req.body;
  const db = readDB();
  const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (user) res.json({ user });
  else res.status(401).json({ error: 'Unauthorized email. Only specific users are allowed.' });
});

// --- DATA FETCHING ---
app.get('/api/workspace', (req, res) => {
  const db = readDB();
  res.json({
    folders: db.folders,
    projects: db.projects,
    tracks: db.tracks,
    coverArts: db.coverArts
  });
});

// --- FOLDERS ---
app.post('/api/folders', (req, res) => {
  const { name, userId } = req.body;
  const db = readDB();
  const newFolder = { id: Date.now().toString(), name, userId, createdAt: new Date().toISOString() };
  db.folders.push(newFolder);
  writeDB(db);
  res.json(newFolder);
});

// --- PROJECTS ---
app.post('/api/projects', (req, res) => {
  const { name, userId, folderId } = req.body;
  const db = readDB();
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
  const { folderId } = req.body;
  const db = readDB();
  const projIndex = db.projects.findIndex(p => p.id === req.params.id);
  if (projIndex === -1) return res.status(404).json({ error: 'Project not found' });
  
  db.projects[projIndex].folderId = folderId; // Can be null to move to root
  writeDB(db);
  res.json(db.projects[projIndex]);
});

app.delete('/api/projects/:id', (req, res) => {
  const db = readDB();
  db.projects = db.projects.filter(p => p.id !== req.params.id);
  // Also delete tracks inside project? Optional, let's just orphan them or delete them.
  // The user asked to delete project, we'll keep it simple and just delete project.
  writeDB(db);
  res.json({ success: true });
});

app.put('/api/projects/:id/cover', (req, res) => {
  const { coverUrl } = req.body;
  const db = readDB();
  const projIndex = db.projects.findIndex(p => p.id === req.params.id);
  if (projIndex === -1) return res.status(404).json({ error: 'Project not found' });
  
  db.projects[projIndex].coverArt = coverUrl;
  writeDB(db);
  res.json(db.projects[projIndex]);
});

// --- COVERS ---
app.post('/api/upload-cover', uploadCover.single('cover'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file uploaded' });
  const db = readDB();
  const url = `${BASE_URL}/covers/${req.file.filename}`;
  const newCover = { id: Date.now().toString(), url, uploadedAt: new Date().toISOString() };
  db.coverArts.push(newCover);
  writeDB(db);
  res.json(newCover);
});

app.delete('/api/covers/:id', (req, res) => {
  const db = readDB();
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
  
  const newTrack = {
    id: Date.now().toString(),
    projectId: projectId || null,
    title: title || req.file.originalname,
    artist: artist || '',
    producer: producer || '',
    filename: req.file.filename,
    url: `${BASE_URL}/uploads/${req.file.filename}`,
    uploader: { id: uploader.id, name: uploader.name },
    uploadedAt: new Date().toISOString()
  };
  
  db.tracks.push(newTrack);
  writeDB(db);
  res.json({ track: newTrack });
});

app.delete('/api/tracks/:id', (req, res) => {
  const db = readDB();
  db.tracks = db.tracks.filter(t => t.id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`Backend server running on http://localhost:${PORT}`));
// End of server file
