const { MongoMemoryServer } = require('mongodb-memory-server');
let mongod;
module.exports = async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI_TEST = mongod.getUri();
  process.env.JWT_SECRET = 'test_jwt_secret_phase10';
  process.env.NODE_ENV = 'test';
  process.env.FRONTEND_URL = 'http://localhost:5173';
  global.__MONGOD__ = mongod;
};
