const redis = require('redis');

let redisClient = null;

const connectRedis = async () => {
  if (process.env.REDIS_URL) {
    try {
      redisClient = redis.createClient({ url: process.env.REDIS_URL });
      redisClient.on('error', (err) => console.error('Redis Client Error', err));
      await redisClient.connect();
      console.log('Connected to Redis');
    } catch (error) {
      console.error('Failed to connect to Redis:', error.message);
    }
  }
};

const getOrSetCache = async (key, ttl, fetcher) => {
  if (!redisClient || !redisClient.isReady) return fetcher();
  try {
    const cached = await redisClient.get(key);
    if (cached) return JSON.parse(cached);
    const data = await fetcher();
    await redisClient.setEx(key, ttl, JSON.stringify(data));
    return data;
  } catch (err) {
    console.error('Redis cache error:', err);
    return fetcher();
  }
};

const invalidateCache = async (pattern) => {
  if (!redisClient || !redisClient.isReady) return;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (err) {
    console.error('Redis invalidate error:', err);
  }
};

module.exports = { connectRedis, getOrSetCache, invalidateCache, getRedisClient: () => redisClient };
