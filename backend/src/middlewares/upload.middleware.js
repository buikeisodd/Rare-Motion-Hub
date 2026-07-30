const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('../config/cloudinary');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', '..', '.data', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Local storage for large files to be chunked to Cloudinary later
const localDiskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});

// Direct Cloudinary storage for small images
const makeCloudinaryStorage = (folderName, resourceType = 'auto') => {
  return new CloudinaryStorage({
    cloudinary,
    params: {
      folder: `raremotionhub/${folderName}`,
      resource_type: resourceType,
    },
  });
};

const uploadTrack = multer({
  storage: localDiskStorage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

const uploadCover = multer({
  storage: makeCloudinaryStorage('covers', 'image'),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

const uploadAvatar = multer({
  storage: makeCloudinaryStorage('avatars', 'image'),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

const uploadNoteMemo = multer({
  storage: localDiskStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

const uploadChatMedia = multer({
  storage: localDiskStorage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

module.exports = {
  uploadTrack,
  uploadCover,
  uploadAvatar,
  uploadNoteMemo,
  uploadChatMedia
};
