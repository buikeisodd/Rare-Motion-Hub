const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Folder, Project, Track, CoverArt, Notification, PlayEvent } = require('../models');
const { readDB, writeDB, ensureDBShape } = require('../utils/dbHelper');
const { removeDirIfExists, getUserDir, uploadDir, coverDir, avatarDir } = require('../utils/fileHelper');
const { cloudinary, hasCloudinaryConfig } = require('../config/cloudinary');
const { invalidateCache } = require('../config/redis');
const { AppError } = require('../middlewares/error.middleware');
const { BASE_URL, publicUser } = require('../utils/helpers');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'fallback_secret');

const ensureAuthConfig = () => {
  if (!JWT_SECRET) throw new AppError('Server authentication is not configured.', 500);
};

const register = async (req, res, next) => {
  try {
    ensureAuthConfig();
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
      username: name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      bio: '',
      followers: [],
      following: [],
      email,
      passwordHash,
      avatarUrl: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await User.create(newUser);
    
    const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '7d' });
    const userSafe = { ...publicUser(newUser), email: newUser.email };
    res.json({ user: userSafe, token });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    ensureAuthConfig();
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;
    if (!email || !password) return next(new AppError('Email and password are required.', 400));

    const user = await User.findOne({ email }).lean();
    if (!user || !user.passwordHash) return next(new AppError('Invalid email or password.', 401));

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return next(new AppError('Invalid email or password.', 401));

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    const userSafe = { ...publicUser(user), email: user.email };
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
    const { passwordHash, email, ...userSafe } = user;
    const tracks = db.tracks.filter((track) => track.userId === user.id && track.isPublished).map((track) => {
      const project = db.projects.find((item) => item.id === track.projectId);
      return { id: track.id, title: track.title, url: track.url, projectId: track.projectId, coverArt: project?.coverArt || null, publishedAt: track.publishedAt };
    });
    res.json({ user: { ...publicUser(userSafe), email }, isFollowing: (user.followers || []).includes(req.userId), posts: tracks });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { name, username, bio } = req.body;
    const db = ensureDBShape(await readDB());
    const userIndex = db.users.findIndex((user) => user.id === req.params.id);
    if (userIndex === -1) return next(new AppError('User not found.', 404));

    const nextName = name?.trim();
    if (!nextName) return next(new AppError('Username is required.', 400));

    const nextUsername = String(username || db.users[userIndex].username || nextName).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    db.users[userIndex] = { ...db.users[userIndex], name: nextName, username: nextUsername, bio: String(bio || '').trim().slice(0, 160), updatedAt: new Date().toISOString() };
    await writeDB(db);
    res.json({ user: db.users[userIndex] });
  } catch (error) {
    next(error);
  }
};

const toggleFollow = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    if (req.params.id === req.userId) return next(new AppError('You cannot follow yourself.', 400));
    const target = db.users.find((item) => item.id === req.params.id);
    const actor = db.users.find((item) => item.id === req.userId);
    if (!target || !actor) return next(new AppError('User not found.', 404));
    target.followers ||= []; actor.following ||= [];
    const index = target.followers.indexOf(req.userId);
    if (index >= 0) { target.followers.splice(index, 1); actor.following = actor.following.filter((id) => id !== target.id); }
    else { target.followers.push(req.userId); actor.following.push(target.id); }
    await writeDB(db);
    res.json({ following: index < 0, followerCount: target.followers.length });
  } catch (error) { next(error); }
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

    let avatarUrl = `${BASE_URL}/avatars/${req.file.filename}`;
    if (hasCloudinaryConfig) {
      try {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: 'raremotionhub/avatars',
          resource_type: 'image'
        });
        avatarUrl = uploadResult.secure_url;
        removeFileIfExists(req.file.path);
      } catch (uploadError) {
        console.error('Cloudinary avatar upload failed, keeping local file:', uploadError.message);
      }
    }
    db.users[userIndex].avatarUrl = avatarUrl;
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
  toggleFollow,
  uploadUserAvatar,
  deleteUser
};
