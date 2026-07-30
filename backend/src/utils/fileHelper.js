const fs = require('fs');
const path = require('path');

const baseDir = process.env.DATA_DIR || path.join(__dirname, '..', '..');
const uploadDir = path.join(baseDir, 'uploads');
const coverDir = path.join(baseDir, 'covers');
const avatarDir = path.join(baseDir, 'avatars');
const chatDir = path.join(uploadDir, 'chat');
const stemsDir = path.join(baseDir, 'stems');

// Ensure necessary base directories exist
const initDirectories = () => {
  [uploadDir, coverDir, avatarDir, chatDir, stemsDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
};

const getUserDir = (base, userId) => path.join(base, userId);

const ensureUserDir = (base, userId) => {
  const dir = getUserDir(base, userId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const removeFileIfExists = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error(`Error deleting file ${filePath}:`, err);
    }
  }
};

const removeDirIfExists = (dirPath) => {
  if (dirPath && fs.existsSync(dirPath)) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
    } catch (err) {
      console.error(`Error deleting directory ${dirPath}:`, err);
    }
  }
};

module.exports = {
  uploadDir,
  coverDir,
  avatarDir,
  chatDir,
  stemsDir,
  initDirectories,
  getUserDir,
  ensureUserDir,
  removeFileIfExists,
  removeDirIfExists,
};
