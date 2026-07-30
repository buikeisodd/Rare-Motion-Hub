const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

let mongod = null;

const connectDB = async () => {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('FATAL: MONGODB_URI is not set in environment.');
    process.exit(1);
  }

  // Fix DNS resolution issues on Windows for MongoDB Atlas SRV records
  try {
    require('dns').setServers(['8.8.8.8', '8.8.4.4']);
  } catch (e) {
    // Ignore error in environments where dns setServers fails
  }

  try {
    console.log('Attempting to connect to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB Atlas');
  } catch (err) {
    console.warn(`MongoDB Atlas connection failed (${err.message}). Falling back to local in-memory MongoDB...`);
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const dbPath = path.join(__dirname, '..', '..', '.data', 'local-mongo');
      fs.mkdirSync(dbPath, { recursive: true });
      
      mongod = await MongoMemoryServer.create({
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
};

const disconnectDB = async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
};

module.exports = { connectDB, disconnectDB };
