const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('../config/cloudinary');

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
  storage: makeCloudinaryStorage('tracks', 'video'),
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
  storage: makeCloudinaryStorage('memos', 'video'),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

const uploadChatMedia = multer({
  storage: makeCloudinaryStorage('chat', 'auto'),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

module.exports = {
  uploadTrack,
  uploadCover,
  uploadAvatar,
  uploadNoteMemo,
  uploadChatMedia
};
