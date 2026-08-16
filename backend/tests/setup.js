const mongoose = require('mongoose');

beforeAll(async () => {
  const uri = process.env.MONGODB_URI_TEST;
  if (!uri) throw new Error('MONGODB_URI_TEST not set — globalSetup may not have run');
  await mongoose.connect(uri);
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map(c => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
});
