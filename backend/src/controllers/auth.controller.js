const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { User, Folder, Project, Track, CoverArt, Notification, PlayEvent } = require('../models');
const { readDB, writeDB, ensureDBShape } = require('../utils/dbHelper');
const { removeDirIfExists, removeFileIfExists, getUserDir, uploadDir, coverDir, avatarDir } = require('../utils/fileHelper');
const { cloudinary, hasCloudinaryConfig } = require('../config/cloudinary');
const { invalidateCache } = require('../config/redis');
const { AppError } = require('../middlewares/error.middleware');
const { BASE_URL, publicUser } = require('../utils/helpers');
const { hasSmtpConfig, sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'fallback_secret');

const ensureAuthConfig = () => {
  if (!JWT_SECRET) throw new AppError('Server authentication is not configured.', 500);
};

const FRONTEND_URL = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const makeVerificationToken = () => crypto.randomBytes(32).toString('hex');
const tokenForUser = (id) => jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '7d' });
const userResponse = (user) => ({ ...publicUser(user), email: user.email, emailVerified: user.emailVerified !== false, authProvider: user.authProvider || 'password' });

const createEmailVerification = async (user) => {
  const verificationToken = makeVerificationToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
  const verificationUrl = `${FRONTEND_URL.replace(/\/$/, '')}/verify-email?token=${verificationToken}`;
  await User.updateOne(
    { id: user.id },
    {
      emailVerificationTokenHash: hashToken(verificationToken),
      emailVerificationExpiresAt: expiresAt,
      updatedAt: new Date().toISOString()
    }
  );
  const emailResult = await sendVerificationEmail({ to: user.email, name: user.name, verificationUrl });
  return {
    sent: emailResult.sent,
    verificationUrl: process.env.NODE_ENV === 'production' ? undefined : verificationUrl
  };
};

const createPasswordReset = async (user) => {
  const resetToken = makeVerificationToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();
  const resetUrl = `${FRONTEND_URL.replace(/\/$/, '')}/login?resetToken=${resetToken}`;
  await User.updateOne(
    { id: user.id },
    {
      passwordResetTokenHash: hashToken(resetToken),
      passwordResetExpiresAt: expiresAt,
      updatedAt: new Date().toISOString()
    }
  );
  const emailResult = await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl });
  return {
    sent: emailResult.sent,
    resetUrl: process.env.NODE_ENV === 'production' ? undefined : resetUrl
  };
};

const register = async (req, res, next) => {
  try {
    ensureAuthConfig();
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;
    if (!email || !password) return next(new AppError('Email and password are required.', 400));
    if (String(password).length < 8) return next(new AppError('Password must be at least 8 characters.', 400));

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
      emailVerified: false,
      authProvider: 'password',
      avatarUrl: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await User.create(newUser);

    const verification = await createEmailVerification(newUser);
    res.status(201).json({
      requiresVerification: true,
      emailSent: verification.sent,
      verificationUrl: verification.verificationUrl,
      message: hasSmtpConfig
        ? 'Check your email to verify your account before signing in.'
        : 'Account created. Email sending is not configured, so verification cannot be delivered yet.'
    });
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
    if (user.isDeactivated) return next(new AppError('This account is deactivated.', 403));

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return next(new AppError('Invalid email or password.', 401));
    if (user.emailVerified === false) {
      return next(new AppError('Please verify your email before signing in.', 403));
    }

    const token = tokenForUser(user.id);
    res.json({ user: userResponse(user), token });
  } catch (error) {
    next(error);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    ensureAuthConfig();
    const token = req.body.token || req.query.token;
    if (!token) return next(new AppError('Verification token is required.', 400));
    const tokenHash = hashToken(token);
    const user = await User.findOne({ emailVerificationTokenHash: tokenHash }).lean();
    if (!user) return next(new AppError('Invalid verification link.', 400));
    if (user.emailVerificationExpiresAt && new Date(user.emailVerificationExpiresAt).getTime() < Date.now()) {
      return next(new AppError('Verification link has expired. Request a new one.', 400));
    }
    const updates = {
      emailVerified: true,
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
      updatedAt: new Date().toISOString()
    };
    await User.updateOne({ id: user.id }, updates);
    const verifiedUser = { ...user, ...updates };
    res.json({ user: userResponse(verifiedUser), token: tokenForUser(user.id) });
  } catch (error) {
    next(error);
  }
};

const resendVerification = async (req, res, next) => {
  try {
    ensureAuthConfig();
    const email = req.body.email?.trim().toLowerCase();
    if (!email) return next(new AppError('Email is required.', 400));
    const user = await User.findOne({ email }).lean();
    if (!user) return next(new AppError('Account not found.', 404));
    if (user.emailVerified !== false) return res.json({ message: 'Email is already verified.' });
    const verification = await createEmailVerification(user);
    res.json({
      emailSent: verification.sent,
      verificationUrl: verification.verificationUrl,
      message: verification.sent ? 'Verification email sent.' : 'Email sending is not configured.'
    });
  } catch (error) {
    next(error);
  }
};

const requestPasswordReset = async (req, res, next) => {
  try {
    ensureAuthConfig();
    const email = req.body.email?.trim().toLowerCase();
    if (!email) return next(new AppError('Email is required.', 400));
    const user = await User.findOne({ email }).lean();
    if (user && user.passwordHash && !user.isDeactivated) {
      const reset = await createPasswordReset(user);
      return res.json({
        emailSent: reset.sent,
        resetUrl: reset.resetUrl,
        message: reset.sent
          ? 'Password reset email sent.'
          : 'Password reset created. Email sending is not configured.'
      });
    }
    res.json({ message: 'If this email exists, a password reset link has been sent.' });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    ensureAuthConfig();
    const { token, password } = req.body;
    if (!token || !password) return next(new AppError('Reset token and new password are required.', 400));
    if (String(password).length < 8) return next(new AppError('Password must be at least 8 characters.', 400));
    const user = await User.findOne({ passwordResetTokenHash: hashToken(token) }).lean();
    if (!user) return next(new AppError('Invalid reset link.', 400));
    if (user.passwordResetExpiresAt && new Date(user.passwordResetExpiresAt).getTime() < Date.now()) {
      return next(new AppError('Reset link has expired. Request a new one.', 400));
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const updates = {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      emailVerified: true,
      updatedAt: new Date().toISOString()
    };
    await User.updateOne({ id: user.id }, updates);
    const nextUser = { ...user, ...updates };
    res.json({ user: userResponse(nextUser), token: tokenForUser(user.id) });
  } catch (error) {
    next(error);
  }
};

const providerIntent = (req, res, next) => {
  const provider = String(req.body.provider || 'provider').toLowerCase();
  return next(new AppError(`${provider} sign-in needs an external OAuth provider. Starlight core auth is configured for email and password.`, 501));
};

const phoneIntent = (req, res, next) => (
  next(new AppError('Phone sign-in needs an SMS/OTP provider. Starlight core auth is configured for email and password.', 501))
);

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
    res.json({ user: { ...publicUser(userSafe), email, emailVerified: user.emailVerified !== false }, isFollowing: (user.followers || []).includes(req.userId), posts: tracks });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { name, username, bio } = req.body || {};
    if (req.params.id !== req.userId) return next(new AppError('You can only edit your own profile.', 403));
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

const deactivateUser = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const index = db.users.findIndex((item) => item.id === req.params.id);
    if (index < 0) return next(new AppError('User not found.', 404));
    const deactivatedAt = new Date().toISOString();
    db.users[index] = { ...db.users[index], isDeactivated: true, deactivatedAt, updatedAt: deactivatedAt };
    await writeDB(db);
    await User.updateOne({ id: req.params.id }, { isDeactivated: true, deactivatedAt });
    res.json({ success: true });
  } catch (error) { next(error); }
};

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerification,
  requestPasswordReset,
  resetPassword,
  providerIntent,
  phoneIntent,
  getUser,
  updateUser,
  toggleFollow,
  uploadUserAvatar,
  deleteUser,
  deactivateUser
};
