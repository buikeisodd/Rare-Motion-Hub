const multer = require('multer');
const fs = require('fs');
const { uploadDir, coverDir, avatarDir } = require('../utils/fileHelper');
[uploadDir, coverDir, avatarDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Local storage for large files to be chunked to Cloudinary later
const localDiskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const diskStorage = (destination) => multer.diskStorage({
  destination: (req, file, cb) => cb(null, destination),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});

const uploadTrack = multer({
  storage: localDiskStorage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

const uploadCover = multer({
  storage: diskStorage(coverDir),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

const uploadAvatar = multer({
  storage: diskStorage(avatarDir),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

const uploadGroupAvatar = multer({
  storage: diskStorage(avatarDir),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype))
});

const uploadNoteMemo = multer({
  storage: localDiskStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

const uploadChatMedia = multer({
  storage: localDiskStorage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

const uploadMarketplace = multer({ storage: localDiskStorage, limits: { fileSize: 100 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  if (file.fieldname === 'beat') return cb(null, /^audio\//i.test(file.mimetype));
  if (file.fieldname === 'agreement') return cb(null, file.mimetype === 'application/pdf');
  return cb(null, false);
} });

module.exports = {
  uploadTrack,
  uploadCover,
  uploadAvatar,
  uploadGroupAvatar,
  uploadNoteMemo,
  uploadChatMedia,
  uploadMarketplace
};
