const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Folder, Project, Track, CoverArt, Notification, PlayEvent } = require('../models');
const { readDB, writeDB, ensureDBShape } = require('../utils/dbHelper');
const { removeDirIfExists, getUserDir, uploadDir, coverDir, avatarDir } = require('../utils/fileHelper');
const { cloudinary } = require('../config/cloudinary');
const { invalidateCache } = require('../config/redis');
const { AppError } = require('../middlewares/error.middleware');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

const register = async (req, res, next) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;
    if (!email || !password) return next(new AppError('Email and password are required.', 400));

    let user = await User.findOne({ email }).lean();
    if (user) return next(new AppError('Email already exists.', 400));

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const name = email.split('@')[0];
    const passwordHash = await bcrypt.hash(password, 10);
    
    const newUser = {
      id,
      name,
      email,
      passwordHash,
      avatarUrl: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await User.create(newUser);
    
    const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '7d' });
    const userSafe = { id: newUser.id, name: newUser.name, email: newUser.email, avatarUrl: newUser.avatarUrl };
    res.json({ user: userSafe, token });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;
    if (!email || !password) return next(new AppError('Email and password are required.', 400));

    const user = await User.findOne({ email }).lean();
    if (!user || !user.passwordHash) return next(new AppError('Invalid email or password.', 401));

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return next(new AppError('Invalid email or password.', 401));

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    const userSafe = { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl };
    res.json({ user: userSafe, token });
  } catch (error) {
    next(error);
  }
};

const getUser = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const user = db.users.find((item) => item.id === req.params.id);
    if (!user) return next(new AppError('User not found.', 404));
    
    // Don't return password hash
    const { passwordHash, ...userSafe } = user;
    res.json({ user: userSafe });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { name } = req.body;
    const db = ensureDBShape(await readDB());
    const userIndex = db.users.findIndex((user) => user.id === req.params.id);
    if (userIndex === -1) return next(new AppError('User not found.', 404));

    const nextName = name?.trim();
    if (!nextName) return next(new AppError('Username is required.', 400));

    db.users[userIndex] = { ...db.users[userIndex], name: nextName, updatedAt: new Date().toISOString() };
    await writeDB(db);
    res.json({ user: db.users[userIndex] });
  } catch (error) {
    next(error);
  }
};

const uploadUserAvatar = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('No profile image uploaded.', 400));
    const db = ensureDBShape(await readDB());
    const userIndex = db.users.findIndex((user) => user.id === req.params.id);
    if (userIndex === -1) {
      if (req.file.filename) {
        cloudinary.uploader.destroy(req.file.filename).catch(console.error);
      }
      return next(new AppError('User not found.', 404));
    }

    db.users[userIndex].avatarUrl = req.file.path; // Cloudinary URL
    db.users[userIndex].avatarUpdatedAt = new Date().toISOString();
    db.users[userIndex].updatedAt = db.users[userIndex].avatarUpdatedAt;
    await writeDB(db);
    invalidateCache(`workspace:${req.params.id}`);
    res.json({ user: db.users[userIndex] });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const user = db.users.find((item) => item.id === req.params.id);
    if (!user) return next(new AppError('User not found.', 404));

    const uid = req.params.id;
    await Promise.all([
      User.deleteOne({ id: uid }),
      Folder.deleteMany({ userId: uid }),
      Project.deleteMany({ userId: uid }),
      Track.deleteMany({ $or: [{ userId: uid }, { 'uploader.id': uid }] }),
      CoverArt.deleteMany({ userId: uid }),
      Notification.deleteMany({ $or: [{ userId: uid }, { 'actor.id': uid }] }),
      PlayEvent.deleteMany({ $or: [{ ownerId: uid }, { actorId: uid }] }),
    ]);

    removeDirIfExists(getUserDir(uploadDir, req.params.id));
    removeDirIfExists(getUserDir(coverDir, req.params.id));
    removeDirIfExists(getUserDir(avatarDir, req.params.id));
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getUser,
  updateUser,
  uploadUserAvatar,
  deleteUser
};
