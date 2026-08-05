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

app.use(cors());
app.use(express.json());
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
  try {
    const result = await cloudinary.uploader.upload(
      'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      { folder: 'raremotionhub/debug-test' }
    );
    return res.json({ ok: true, url: result.secure_url, public_id: result.public_id });
  } catch (err) {
    return res.json({
      ok: false,
      stage: 'upload',
      message: err.message,
      http_code: err.http_code || err.error?.http_code,
      name: err.name,
      raw: err.error || err
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
