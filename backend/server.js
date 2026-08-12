require('dotenv').config();
const app = require('./src/app');
const { configCloudinary, hasCloudinaryConfig } = require('./src/config/cloudinary');
const { connectRedis } = require('./src/config/redis');
const { connectDB } = require('./src/config/db');

const PORT = process.env.PORT || 4000;

async function startServer() {
  // Configure Cloudinary SDK with credentials from env
  configCloudinary();
  if (hasCloudinaryConfig) {
    console.log('Cloudinary configured.');
  }

  // Connect to Redis (no-op if REDIS_URL isn't set)
  await connectRedis();

  // Connect to MongoDB Atlas, falling back to an in-memory instance locally
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
  
  // Set connection and header timeouts to 10 minutes to support large uploads on slow connections
  server.timeout = 600000;
  server.keepAliveTimeout = 600000;
  server.headersTimeout = 605000;
}

startServer();
