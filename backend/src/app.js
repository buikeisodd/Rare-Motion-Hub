const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./middlewares/error.middleware');

const authRoutes = require('./routes/auth.routes');
const workspaceRoutes = require('./routes/workspace.routes');
const trackRoutes = require('./routes/track.routes');
const mediaRoutes = require('./routes/media.routes');
const chatRoutes = require('./routes/chat.routes');

const app = express();

app.use(cors());
app.use(express.json());

// System routes
app.get('/api/ping', (req, res) => res.json({ ok: true, ts: Date.now() }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api', workspaceRoutes); // Was mounted at /api/workspaces breaking /api/workspace and /api/folders
app.use('/api', trackRoutes);     // Was mounted at /api/tracks breaking /api/tracks/:id (became /api/tracks/tracks/:id)
app.use('/api', chatRoutes);

// Global Error Handler
app.use(errorHandler);

module.exports = app;
