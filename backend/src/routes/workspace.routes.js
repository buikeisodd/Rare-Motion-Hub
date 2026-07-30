const express = require('express');
const {
  getWorkspace,
  generateShare,
  getShareLink,
  getFolder,
  createFolder,
  moveFolder,
  updateFolder,
  deleteFolder,
  createProject,
  updateProject,
  moveProject,
  deleteProject,
  getCovers,
  updateProjectCover,
  getProject,
  uploadCover,
  deleteCover
} = require('../controllers/workspace.controller');
const { requireUserId } = require('../middlewares/auth.middleware');
const { uploadCover: uploadCoverMiddleware } = require('../middlewares/upload.middleware');

const router = express.Router();

// Workspace
router.get('/workspace', requireUserId, getWorkspace);

// Sharing
router.post('/share/generate', requireUserId, generateShare);
router.get('/share/link/:token', getShareLink);

// Folders
router.post('/folders', requireUserId, createFolder);
router.get('/folders/:id', requireUserId, getFolder);
router.put('/folders/:id', requireUserId, updateFolder);
router.put('/folders/:id/move', requireUserId, moveFolder);
router.delete('/folders/:id', requireUserId, deleteFolder);

// Projects
router.post('/projects', requireUserId, createProject);
router.get('/projects/:id', requireUserId, getProject);
router.put('/projects/:id', requireUserId, updateProject);
router.put('/projects/:id/move', requireUserId, moveProject);
router.delete('/projects/:id', requireUserId, deleteProject);
router.put('/projects/:id/cover', requireUserId, updateProjectCover);

// Covers
router.get('/covers', requireUserId, getCovers);
router.post('/upload-cover', requireUserId, uploadCoverMiddleware.single('cover'), uploadCover);
router.delete('/covers/:id', requireUserId, deleteCover);

module.exports = router;
