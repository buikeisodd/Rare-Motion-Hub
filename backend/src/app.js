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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/tracks', trackRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api', chatRoutes); // Chat routes are mixed (messages, conversations, users)

// Global Error Handler
app.use(errorHandler);

module.exports = app;
