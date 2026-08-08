const mongoose = require('mongoose');

async function testMongooseFallback() {
  try {
    console.log('Attempting to connect to invalid URI...');
    // Use an invalid URI that will timeout
    await mongoose.connect('mongodb://192.168.1.250:27017/test', { serverSelectionTimeoutMS: 2000 });
  } catch (err) {
    console.log('Failed as expected:', err.message);
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      console.log('Connecting to MongoMemoryServer at', uri);
      
      // DO WE NEED mongoose.disconnect() HERE?
      // await mongoose.disconnect();
      
      await mongoose.connect(uri);
      console.log('Connected to fallback. Checking state:', mongoose.connection.readyState);
      
      // Define a dummy model
      const User = mongoose.model('User', new mongoose.Schema({ name: String }));
      
      console.log('Running User.findOne()...');
      const user = await User.findOne({ name: 'test' }).maxTimeMS(2000);
      console.log('Success:', user);
      
      await mongoose.disconnect();
      await mongod.stop();
    } catch (e) {
      console.error('Error during fallback test:', e);
    }
  }
}

testMongooseFallback();
