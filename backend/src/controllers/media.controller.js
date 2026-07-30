const fs = require('fs');
const path = require('path');
const { readDB, ensureDBShape } = require('../utils/dbHelper');
const { findAccessibleTrack, trackOwnerId, noteMemoDir } = require('../utils/helpers');
const { uploadDir, stemsDir } = require('../utils/fileHelper');
const { AppError } = require('../middlewares/error.middleware');

const streamTrack = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const track = db.tracks.find((item) => item.id === req.params.id);
    if (!track) return next(new AppError('Track not found', 404));

    if (track.url) {
      return res.redirect(track.url);
    }

    // Fallback for local legacy files
    const mediaOwnerId = trackOwnerId(track);
    const filePath = path.join(uploadDir, mediaOwnerId, track.filename || '');
    if (!track.filename || !fs.existsSync(filePath)) {
      return next(new AppError('Track media file not found on local disk.', 404));
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const contentType = track.mimeType || 'audio/mpeg';
    const range = req.headers.range;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    if (!range) {
      res.setHeader('Content-Length', fileSize);
      return fs.createReadStream(filePath).pipe(res);
    }

    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start >= fileSize || end >= fileSize) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      return res.status(416).end();
    }

    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', end - start + 1);
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } catch (error) {
    next(error);
  }
};

const streamVersion = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const userId = req.userId;

    const track = findAccessibleTrack(db, req.params.id, userId);
    if (!track) return next(new AppError('Track not found', 404));

    const version = (track.versions || []).find((item) => item.id === req.params.versionId);
    if (!version) return next(new AppError('Version not found', 404));

    if (version.url) {
      return res.redirect(version.url);
    }

    const filePath = path.join(uploadDir, trackOwnerId(track), version.filename || '');
    if (!version.filename || !fs.existsSync(filePath)) {
      return next(new AppError('Version media file not found', 404));
    }

    const stat = fs.statSync(filePath);
    const contentType = version.mimeType || 'audio/mpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Accept-Ranges', 'bytes');
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    next(error);
  }
};

const streamNoteMemo = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const userId = req.userId;

    const track = findAccessibleTrack(db, req.params.id, userId);
    if (!track) return next(new AppError('Track not found', 404));

    const memo = (track.noteMemos || []).find((item) => item.id === req.params.memoId);
    if (!memo) return next(new AppError('Voice memo not found', 404));

    if (memo.url) {
      return res.redirect(memo.url);
    }

    const filePath = path.join(noteMemoDir(track), memo.filename || '');
    if (!memo.filename || !fs.existsSync(filePath)) {
      return next(new AppError('Voice memo file not found', 404));
    }

    res.setHeader('Content-Type', memo.mimeType || 'audio/webm');
    res.setHeader('Accept-Ranges', 'bytes');
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    next(error);
  }
};

const streamStem = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const userId = req.userId;

    const track = findAccessibleTrack(db, req.params.trackId, userId);
    if (!track) return next(new AppError('Track not found', 404));

    const stemName = req.params.filename.split('.')[0]; // e.g. "drums.wav" -> "drums"
    // Find the stem in the track object if we saved URLs for stems
    const stem = (track.stems || []).find(s => s.name === stemName || s.filename === req.params.filename);
    
    if (stem && stem.url) {
      return res.redirect(stem.url);
    }

    // Fallback to local stems directory
    const filePath = path.join(stemsDir, userId, track.id, req.params.filename);
    if (!fs.existsSync(filePath)) return next(new AppError('Stem file not found', 404));

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  streamTrack,
  streamVersion,
  streamNoteMemo,
  streamStem
};
