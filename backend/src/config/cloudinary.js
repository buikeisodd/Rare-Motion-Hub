const { v2: cloudinary } = require('cloudinary');

const hasCloudinaryConfig = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

const configCloudinary = () => {
  if (!hasCloudinaryConfig) {
    console.warn('Cloudinary credentials missing in environment. File uploads will use local fallback where possible.');
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }
};

module.exports = { cloudinary, configCloudinary, hasCloudinaryConfig, cloudName: process.env.CLOUDINARY_CLOUD_NAME || '' };
