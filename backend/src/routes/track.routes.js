const express = require('express');
const {
  uploadTrackController,
  getTrackUploadSignature,
  createCloudinaryTrack,
  deleteTrack,
  patchTrack,
  publishTrack,
  getFeed,
  getTrackInsights,
  replaceAudio,
  switchVersion,
  deleteVersion,
  updateVersionLabel,
  createNoteMemo,
  deleteNoteMemo,
  splitStems,
  getStemStatus,
  convertVideo,
  getConvertStatus
} = require('../controllers/track.controller');
const { requireUserId } = require('../middlewares/auth.middleware');
const { uploadTrack, uploadNoteMemo } = require('../middlewares/upload.middleware');

const router = express.Router();

// Track operations
router.post('/upload', requireUserId, uploadTrack.single('track'), uploadTrackController);
router.get('/upload/signature', requireUserId, getTrackUploadSignature);
router.post('/upload/cloudinary', requireUserId, createCloudinaryTrack);
router.delete('/tracks/:id', requireUserId, deleteTrack);
router.patch('/tracks/:id', requireUserId, patchTrack);
router.patch('/tracks/:id/publish', requireUserId, publishTrack);
router.get('/feed', requireUserId, getFeed);
router.get('/tracks/:id/insights', requireUserId, getTrackInsights);
router.post('/tracks/:id/replace-audio', requireUserId, uploadTrack.single('track'), replaceAudio);

// Versions
router.patch('/tracks/:id/switch-version', requireUserId, switchVersion);
router.patch('/tracks/:id/versions/:versionId', requireUserId, updateVersionLabel);
router.delete('/tracks/:id/versions/:versionId', requireUserId, deleteVersion);

// Note memos
router.post('/tracks/:id/note-memos', requireUserId, uploadNoteMemo.single('memo'), createNoteMemo);
router.delete('/tracks/:id/note-memos/:memoId', requireUserId, deleteNoteMemo);

// Stems
router.post('/tracks/:id/split-stems', requireUserId, splitStems);
router.get('/tracks/:id/split-stems/status/:jobId', getStemStatus);

// Video conversions
router.post('/convert', requireUserId, uploadTrack.single('video'), convertVideo);
router.get('/convert/status/:jobId', getConvertStatus);

module.exports = router;
