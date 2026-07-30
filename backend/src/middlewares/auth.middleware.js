const jwt = require('jsonwebtoken');
const { AppError } = require('./error.middleware');

const requireUserId = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Unauthorized: Missing token', 401));
  }
  
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return next(new AppError('Unauthorized: Invalid token', 401));
  }
};

module.exports = { requireUserId };
