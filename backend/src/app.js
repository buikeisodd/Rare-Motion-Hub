const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./middlewares/error.middleware');
const { uploadDir, coverDir, avatarDir } = require('./utils/fileHelper');

const authRoutes = require('./routes/auth.routes');
const workspaceRoutes = require('./routes/workspace.routes');
const trackRoutes = require('./routes/track.routes');
const storyRoutes = require('./routes/story.routes');
const mediaRoutes = require('./routes/media.routes');
const chatRoutes = require('./routes/chat.routes');

const app = express();

const IS_PROD = process.env.NODE_ENV === 'production';

// Origins that are allowed to make credentialed cross-origin requests.
// Wildcards are never permitted with credentials:true — browsers will reject
// the response anyway, but we enforce it here explicitly so a misconfigured
// environment variable can't accidentally open a security hole.
//
// Production: CORS_ORIGINS must be set. Comma-separated list of exact
// origins, e.g. "https://app.starlightstation.com,https://starlightstation.com".
// The app will log a warning and serve no credentialed cross-origin requests
// if this var is missing in production.
//
// Development: falls back to localhost on both common Vite ports (5173, 3000).
// Never include these in the production list.

const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4000'];

const explicitOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

if (IS_PROD && explicitOrigins.length === 0) {
  console.warn(
    '[CORS] WARNING: NODE_ENV=production but CORS_ORIGINS is not set. ' +
    'No cross-origin requests with credentials will be permitted. ' +
    'Set CORS_ORIGINS to a comma-separated list of allowed origins.'
  );
}

const allowedOrigins = IS_PROD ? explicitOrigins : [...explicitOrigins, ...DEV_ORIGINS];

const originCallback = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (allowedOrigins.includes(origin)) return callback(null, true);
  // Allow local network IP testing only outside production.
  if (!IS_PROD && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    return callback(null, true);
  }
  return callback(Object.assign(new Error('Not allowed by CORS'), { status: 403 }));
};

app.use(cors({
  origin: originCallback,
  credentials: true,
  // Preflight cache: 1 hour for prod, 0 for dev so changes take effect immediately
  maxAge: IS_PROD ? 3600 : 0,
  exposedHeaders: ['x-csrf-token']
}));
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(uploadDir));
app.use('/covers', express.static(coverDir));
app.use('/avatars', express.static(avatarDir));

// System routes
app.get('/api/ping', (req, res) => res.json({ ok: true, ts: Date.now() }));
app.get('/api/status', (req, res) => {
  const { hasCloudinaryConfig } = require('./config/cloudinary');
  const { getRedisClient } = require('./config/redis');
  const redisClient = getRedisClient();
  res.json({
    cloudinary: hasCloudinaryConfig,
    redis: Boolean(redisClient && redisClient.isReady),
    mongoState: require('mongoose').connection.readyState // 1 = connected
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api', workspaceRoutes); // Was mounted at /api/workspaces breaking /api/workspace and /api/folders
app.use('/api', trackRoutes);     // Was mounted at /api/tracks breaking /api/tracks/:id (became /api/tracks/tracks/:id)
app.use('/api', storyRoutes);
app.use('/api', chatRoutes);

// Global Error Handler
app.use(errorHandler);

module.exports = app;
