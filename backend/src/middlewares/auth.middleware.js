const jwt = require('jsonwebtoken');
const { AppError } = require('./error.middleware');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'fallback_secret');

const requireUserId = (req, res, next) => {
  if (!JWT_SECRET) return next(new AppError('Server authentication is not configured.', 500));
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Unauthorized: Missing token', 401));
  }
  
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return next(new AppError('Unauthorized: Invalid token', 401));
  }
};

module.exports = { requireUserId };
