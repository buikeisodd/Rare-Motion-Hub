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
const marketplaceRoutes = require('./routes/marketplace.routes');
const liveRoutes = require('./routes/live.routes');

const app = express();

const IS_PROD = process.env.NODE_ENV === 'production';

// Origins that are allowed to make credentialed cross-origin requests.
// Wildcards are never permitted with credentials:true — browsers will reject
// the response anyway, but we enforce it here explicitly so a misconfigured
// environment variable can't accidentally open a security hole.
//
// Production: CORS_ORIGINS may contain additional exact origins. FRONTEND_URL
// and the deployed Vercel origin are included as exact fallbacks so a missing
// Render variable does not break the primary web application.
//
// Development: falls back to localhost on both common Vite ports (5173, 3000).
// Never include these in the production list.

const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4000'];

const explicitOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const configuredFrontendOrigin = (process.env.FRONTEND_URL || '')
  .trim()
  .replace(/\/$/, '');
const deployedFrontendOrigin = 'https://rare-motion-hub.vercel.app';

const allowedOrigins = IS_PROD
  ? [...new Set([...explicitOrigins, configuredFrontendOrigin, deployedFrontendOrigin].filter(Boolean))]
  : [...explicitOrigins, ...DEV_ORIGINS];

const originCallback = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (allowedOrigins.includes(origin)) return callback(null, true);
  // Allow local network IP testing only outside production.
  if (!IS_PROD && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    return callback(null, true);
  }
  const error = Object.assign(new Error('Not allowed by CORS'), { status: 403 });
  console.warn(`[CORS] Rejected origin: ${origin || '(none)'}`);
  return callback(error);
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
app.use('/api/live', liveRoutes);
app.use('/api/marketplace', marketplaceRoutes);

// Global Error Handler
app.use(errorHandler);

module.exports = app;
