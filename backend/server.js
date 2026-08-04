require('dotenv').config();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const app = require('./src/app');
const { configCloudinary, hasCloudinaryConfig } = require('./src/config/cloudinary');
const { connectRedis } = require('./src/config/redis');

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;

async function startServer() {
  // Configure Cloudinary SDK with credentials from env
  configCloudinary();
  if (hasCloudinaryConfig) {
    console.log('Cloudinary configured.');
  }

  // Connect to Redis (no-op if REDIS_URL isn't set)
  await connectRedis();

  try {
    console.log('Attempting to connect to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB Atlas');
  } catch (err) {
    console.warn(`MongoDB Atlas connection failed (${err.message}). Falling back to local in-memory MongoDB...`);
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const dbPath = path.join(__dirname, '.data', 'local-mongo');
      fs.mkdirSync(dbPath, { recursive: true });
      
      const mongod = await MongoMemoryServer.create({
        instance: { dbPath, storageEngine: 'wiredTiger' }
      });
      const uri = mongod.getUri();
      await mongoose.connect(uri);
      console.log(`Connected to Local MongoDB Fallback at ${dbPath}`);
    } catch (fallbackErr) {
      console.error('Failed to start local MongoDB fallback:', fallbackErr);
      process.exit(1);
    }
  }

  const server = app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
  
  // Set connection and header timeouts to 10 minutes to support large uploads on slow connections
  server.timeout = 600000;
  server.keepAliveTimeout = 600000;
  server.headersTimeout = 605000;
}

startServer();
