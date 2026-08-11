const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./middlewares/error.middleware');
const { uploadDir, coverDir, avatarDir } = require('./utils/fileHelper');

const authRoutes = require('./routes/auth.routes');
const workspaceRoutes = require('./routes/workspace.routes');
const trackRoutes = require('./routes/track.routes');
const mediaRoutes = require('./routes/media.routes');
const chatRoutes = require('./routes/chat.routes');

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length
    ? (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Origin is not allowed by CORS'));
      }
    : true,
  credentials: true
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

// TEMPORARY DEBUG ENDPOINT — remove once Cloudinary issue is resolved.
// Performs a real upload against Cloudinary using the live server's env vars
// so we can see the exact raw error Cloudinary returns, without needing
// local reproduction.
app.get('/api/debug/cloudinary-test', async (req, res) => {
  const { cloudinary, hasCloudinaryConfig } = require('./config/cloudinary');
  if (!hasCloudinaryConfig) {
    return res.json({ ok: false, stage: 'config', reason: 'Cloudinary env vars not set on this server.' });
  }

  // Show exactly what's loaded into the SDK at runtime, byte for byte,
  // without leaking the full secret. Wrapped in JSON.stringify + quotes
  // so any leading/trailing whitespace or hidden characters become visible.
  const cfg = cloudinary.config();
  const inspect = {
    cloud_name: JSON.stringify(cfg.cloud_name),
    cloud_name_length: (cfg.cloud_name || '').length,
    api_key: JSON.stringify(cfg.api_key),
    api_key_length: (cfg.api_key || '').length,
    api_secret_length: (cfg.api_secret || '').length,
    api_secret_first4: (cfg.api_secret || '').slice(0, 4),
    api_secret_last4: (cfg.api_secret || '').slice(-4),
  };

  try {
    const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const result = await cloudinary.uploader.upload(tinyPng, {
      folder: 'raremotionhub/debug-test'
    });
    return res.json({ ok: true, url: result.secure_url, public_id: result.public_id, config: inspect });
  } catch (err) {
    return res.json({
      ok: false,
      stage: 'upload',
      message: err.message,
      http_code: err.http_code || err.error?.http_code,
      name: err.name,
      raw: err.error || err,
      config: inspect
    });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api', workspaceRoutes); // Was mounted at /api/workspaces breaking /api/workspace and /api/folders
app.use('/api', trackRoutes);     // Was mounted at /api/tracks breaking /api/tracks/:id (became /api/tracks/tracks/:id)
app.use('/api', chatRoutes);

// Global Error Handler
app.use(errorHandler);

module.exports = app;
