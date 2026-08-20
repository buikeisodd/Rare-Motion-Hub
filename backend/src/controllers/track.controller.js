const fs = require('fs');
const path = require('path');
const { Track, Project } = require('../models');
const { readDB, writeDB, ensureDBShape } = require('../utils/dbHelper');
const {
  makeId,
  publicUser,
  normalizeTrack,
  findAccessibleTrack,
  trackOwnerId,
  trackMediaPath,
  noteMemoDir,
  downloadFile,
  BASE_URL
} = require('../utils/helpers');
const { runDemucs, convertToWav, findStemOutputDir } = require('../services/audio.service');
const { getOrSetCache, invalidateCache } = require('../config/redis');
const { cloudinary, hasCloudinaryConfig, cloudName } = require('../config/cloudinary');
const { ensureUserDir, removeDirIfExists, removeFileIfExists, uploadDir, stemsDir } = require('../utils/fileHelper');
const { AppError } = require('../middlewares/error.middleware');

const conversionJobs = {};
const stemJobs = {};

const storeMemoFile = async (file, userId, trackId) => {
  if (hasCloudinaryConfig) {
    try {
      const uploadResult = await cloudinary.uploader.upload_large(file.path, {
        resource_type: 'video',
        folder: 'raremotionhub/memos'
      });
      removeFileIfExists(file.path);
      return { filename: null, url: uploadResult.secure_url };
    } catch (err) {
      console.error('Cloudinary memo upload failed, using local storage fallback:', err.message);
    }
  }
  const memoDir = noteMemoDir({ userId, uploader: { id: userId }, id: trackId });
  fs.mkdirSync(memoDir, { recursive: true });
  const filename = path.basename(file.filename || `${Date.now()}-${file.originalname || 'memo'}`).replace(/\s+/g, '_');
  const destination = path.join(memoDir, filename);
  if (path.resolve(file.path) !== path.resolve(destination)) fs.renameSync(file.path, destination);
  return { filename, url: null };
};

const storeTrackFile = async (file, userId, folder = 'raremotionhub/tracks') => {
  if (hasCloudinaryConfig) {
    try {
      const uploadResult = await cloudinary.uploader.upload_large(file.path, {
        resource_type: 'video',
        folder
      });
      removeFileIfExists(file.path);
      return { filename: null, url: uploadResult.secure_url };
    } catch (err) {
      console.error('Cloudinary track upload failed, using local storage fallback:', err.message);
    }
  }

  const userDir = ensureUserDir(uploadDir, userId);
  const safeName = path.basename(file.filename || `${Date.now()}-${file.originalname || 'track'}`).replace(/\s+/g, '_');
  const finalPath = path.join(userDir, safeName);
  if (path.resolve(file.path) !== path.resolve(finalPath)) {
    fs.renameSync(file.path, finalPath);
  }
  return {
    filename: safeName,
    url: `${BASE_URL}/uploads/${userId}/${safeName}`
  };
};

const storeTrackLocally = (file, userId) => {
  const userDir = ensureUserDir(uploadDir, userId);
  const safeName = path.basename(file.filename || `${Date.now()}-${file.originalname || 'track'}`).replace(/\s+/g, '_');
  const finalPath = path.join(userDir, safeName);
  if (path.resolve(file.path) !== path.resolve(finalPath)) fs.renameSync(file.path, finalPath);
  return { filename: safeName, url: `${BASE_URL}/uploads/${userId}/${safeName}`, path: finalPath };
};

const promoteTrackToCloudinary = async (track, localPath, userId) => {
  if (!hasCloudinaryConfig) return;
  try {
    const uploadResult = await cloudinary.uploader.upload_large(localPath, {
      resource_type: 'video',
      folder: 'raremotionhub/tracks'
    });
    const db = ensureDBShape(await readDB());
    const index = db.tracks.findIndex((item) => item.id === track.id);
    if (index === -1) return;
    db.tracks[index] = { ...db.tracks[index], filename: null, url: uploadResult.secure_url };
    await writeDB(db);
    invalidateCache(`workspace:${userId}`);
    if (track.projectId) invalidateCache(`project:${track.projectId}:${userId}`);
    // Keep the local fallback while the current client may still hold its URL.
  } catch (error) {
    console.error('Background Cloudinary track upload failed; local playback remains active:', error.message);
  }
};

const uploadTrackController = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('No audio file uploaded', 400));
    const { title, projectId, artist, producer } = req.body;
    const userId = req.userId;
    const db = ensureDBShape(await readDB());
    const uploader = db.users.find(u => u.id === userId);
    if (!uploader) {
      if (req.file) removeFileIfExists(req.file.path);
      return next(new AppError('Unauthorized user.', 401));
    }
    if (projectId && !db.projects.some((project) => project.id === projectId && project.userId === userId)) {
      if (req.file) removeFileIfExists(req.file.path);
      return next(new AppError('Project not found', 404));
    }
    
    // Acknowledge the upload from the server's persistent disk immediately.
    // Cloudinary promotion runs after the response so Render's request timeout
    // cannot turn a completed upload into a client-side network error.
    const storedFile = storeTrackLocally(req.file, userId);
    
    const trackId = makeId();
    const newTrack = {
      id: trackId,
      userId,
      projectId: projectId || null,
      title: title || req.file.originalname,
      artist: artist || '',
      producer: producer || '',
      filename: storedFile.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: storedFile.url,
      uploader: { id: uploader.id, name: uploader.name },
      uploadedAt: new Date().toISOString()
    };
    
    db.tracks.push(newTrack);
    await writeDB(db);
    invalidateCache(`workspace:${userId}`);
    if (projectId) invalidateCache(`project:${projectId}:${userId}`);
    res.json({ track: normalizeTrack(newTrack) });
    if (storedFile.path) promoteTrackToCloudinary(newTrack, storedFile.path, userId);
  } catch (error) {
    next(error);
  }
};

const promoteVersionToCloudinary = async (trackId, versionId, localPath, userId) => {
  if (!hasCloudinaryConfig || !localPath || !fs.existsSync(localPath)) return;
  try {
    const uploadResult = await cloudinary.uploader.upload_large(localPath, {
      resource_type: 'video',
      folder: 'raremotionhub/track-versions'
    });
    const db = ensureDBShape(await readDB());
    const track = db.tracks.find((item) => item.id === trackId);
    const version = track?.versions?.find((item) => item.id === versionId);
    if (!version) return;
    version.filename = null;
    version.url = uploadResult.secure_url;
    await writeDB(db);
    invalidateCache(`workspace:${userId}`);
    if (track.projectId) invalidateCache(`project:${track.projectId}:${userId}`);
    // Keep the local fallback while the current client may still hold its URL.
  } catch (error) {
    console.error('Background Cloudinary version upload failed; local fallback remains active:', error.message);
  }
};

const getTrackUploadSignature = (req, res, next) => {
  try {
    if (!hasCloudinaryConfig) return next(new AppError('Cloudinary storage is not configured.', 503));
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'raremotionhub/tracks';
    const signature = cloudinary.utils.api_sign_request({ folder, timestamp }, process.env.CLOUDINARY_API_SECRET);
    res.json({ timestamp, folder, signature, apiKey: process.env.CLOUDINARY_API_KEY, cloudName, resourceType: 'video' });
  } catch (error) {
    next(error);
  }
};

const createCloudinaryTrack = async (req, res, next) => {
  try {
    const { title, artist, producer, projectId, secureUrl, publicId, resourceType, format, bytes, duration } = req.body;
    const userId = req.userId;
    if (!secureUrl || !publicId) return next(new AppError('Cloudinary upload metadata is incomplete.', 400));
    const db = ensureDBShape(await readDB());
    const uploader = db.users.find((user) => user.id === userId);
    if (!uploader) return next(new AppError('Unauthorized user.', 401));
    if (projectId && !db.projects.some((project) => project.id === projectId && project.userId === userId)) {
      return next(new AppError('Project not found', 404));
    }
    const track = {
      id: makeId(), userId, projectId: projectId || null,
      title: title || publicId.split('/').pop(), artist: artist || '', producer: producer || '',
      filename: null, url: secureUrl, publicId, resourceType: resourceType || 'video',
      format: format || null, size: Number(bytes) || 0, duration: Number(duration) || 0,
      mimeType: format === 'wav' ? 'audio/wav' : 'audio/mpeg',
      uploader: { id: uploader.id, name: uploader.name }, uploadedAt: new Date().toISOString()
    };
    db.tracks.push(track);
    await writeDB(db);
    invalidateCache(`workspace:${userId}`);
    if (projectId) invalidateCache(`project:${projectId}:${userId}`);
    res.status(201).json({ track: normalizeTrack(track) });
  } catch (error) {
    next(error);
  }
};

const deleteTrack = async (req, res, next) => {
  try {
    const userId = req.userId;

    const track = await Track.findOne({ id: req.params.id, $or: [{ userId }, { 'uploader.id': userId }] }).lean();
    if (!track) return next(new AppError('Track not found', 404));

    if (track.filename) {
      removeFileIfExists(trackMediaPath(track));
      (track.versions || []).forEach((version) => {
        removeFileIfExists(path.join(uploadDir, trackOwnerId(track), version.filename));
      });
    } else if (track.url) {
      const publicId = track.url.split('/').pop().split('.')[0];
      cloudinary.uploader.destroy(`raremotionhub/tracks/${publicId}`, { resource_type: 'video' }).catch(console.error);
    }
    removeDirIfExists(path.join(stemsDir, trackOwnerId(track), track.id));

    await Track.deleteOne({ id: req.params.id });
    invalidateCache(`workspace:${userId}`);
    if (track.projectId) invalidateCache(`project:${track.projectId}:${userId}`);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const patchTrack = async (req, res, next) => {
  try {
    const userId = req.userId;

    const track = await Track.findOne({ id: req.params.id }).lean();
    if (!track) return next(new AppError('Track not found', 404));

    const updates = {};
    const { title, notes } = req.body;
    if (title !== undefined) {
      const nextTitle = title.toString().trim();
      if (!nextTitle) return next(new AppError('Track title is required.', 400));
      updates.title = nextTitle;
    }
    if (notes !== undefined) updates.notes = notes.toString();

    const updated = await Track.findOneAndUpdate({ id: req.params.id }, updates, { returnDocument: 'after' }).lean();
    invalidateCache(`workspace:${userId}`);
    if (track.projectId) invalidateCache(`project:${track.projectId}:${userId}`);
    res.json({ track: normalizeTrack(updated) });
  } catch (error) {
    next(error);
  }
};

const publishTrack = async (req, res, next) => {
  try {
    const userId = req.userId;
    const db = ensureDBShape(await readDB());
    const track = db.tracks.find((item) => item.id === req.params.id);
    if (!track || trackOwnerId(track) !== userId) return next(new AppError('Track not found', 404));
    const project = track.projectId ? db.projects.find((item) => item.id === track.projectId) : null;
    if (project?.visibility === 'private' && req.body.published !== false) {
      return next(new AppError('Private projects cannot be published to the feed.', 403));
    }

    const published = req.body.published !== false;
    const start = Number(req.body.previewStart ?? track.previewStart ?? 0);
    const end = req.body.previewEnd === '' || req.body.previewEnd === null || req.body.previewEnd === undefined
      ? track.previewEnd
      : Number(req.body.previewEnd);
    if (!Number.isFinite(start) || start < 0 || (end !== undefined && end !== null && (!Number.isFinite(end) || end <= start))) {
      return next(new AppError('Preview timing is invalid.', 400));
    }
    track.isPublished = published;
    track.publishedAt = published ? new Date().toISOString() : null;
    if (req.body.caption !== undefined) track.feedCaption = String(req.body.caption).slice(0, 500);
    track.previewStart = start;
    track.previewEnd = end ?? null;
    track.likes ||= [];
    track.comments ||= [];
    await writeDB(db);
    invalidateCache(`workspace:${userId}`);
    if (track.projectId) invalidateCache(`project:${track.projectId}:${userId}`);
    res.json({ track: normalizeTrack(track) });
  } catch (error) {
    next(error);
  }
};

const getFeed = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const items = db.tracks
      .filter((track) => {
        if (!track.isPublished || (!track.url && !track.filename)) return false;
        const project = track.projectId ? db.projects.find((item) => item.id === track.projectId) : null;
        if (project?.visibility === 'private') return false;
        let folder = project?.folderId ? db.folders.find((item) => item.id === project.folderId) : null;
        while (folder) {
          if (folder.visibility === 'private') return false;
          folder = folder.parentFolderId ? db.folders.find((item) => item.id === folder.parentFolderId) : null;
        }
        return true;
      })
      .sort((a, b) => new Date(b.publishedAt || b.uploadedAt) - new Date(a.publishedAt || a.uploadedAt))
      .slice(0, 50)
      .map((track) => {
        const owner = db.users.find((user) => user.id === trackOwnerId(track));
        const project = db.projects.find((item) => item.id === track.projectId);
        return {
          ...normalizeTrack(track),
          owner: owner ? { id: owner.id, name: owner.name, avatarUrl: owner.avatarUrl || null } : null,
          project: project ? { id: project.id, title: project.title || project.name, coverArt: project.coverArt || null } : null,
          likeCount: (track.likes || []).length,
          likedByMe: (track.likes || []).includes(req.userId),
          savedByMe: (track.savedBy || []).includes(req.userId),
          comments: (track.comments || []).map((comment) => {
            const commenter = db.users.find((user) => user.id === comment.userId);
            return { ...comment, likes: comment.likes || [], likeCount: (comment.likes || []).length, likedByMe: (comment.likes || []).includes(req.userId), user: commenter ? { id: commenter.id, name: commenter.name, avatarUrl: commenter.avatarUrl || null } : null };
          })
        };
      });
    res.json({ items });
  } catch (error) {
    next(error);
  }
};

const toggleFeedSave = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const track = db.tracks.find((item) => item.id === req.params.id && item.isPublished);
    if (!track) return next(new AppError('Preview not found', 404));
    track.savedBy ||= [];
    const index = track.savedBy.indexOf(req.userId);
    if (index >= 0) track.savedBy.splice(index, 1); else track.savedBy.push(req.userId);
    await writeDB(db);
    res.json({ saved: index < 0 });
  } catch (error) { next(error); }
};

const deleteFeed = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const track = db.tracks.find((item) => item.id === req.params.id);
    if (!track || trackOwnerId(track) !== req.userId) return next(new AppError('Preview not found', 404));
    track.isPublished = false;
    track.publishedAt = null;
    await writeDB(db);
    invalidateCache(`workspace:${req.userId}`);
    res.json({ success: true });
  } catch (error) { next(error); }
};

const toggleFeedLike = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const track = db.tracks.find((item) => item.id === req.params.id && item.isPublished);
    if (!track) return next(new AppError('Preview not found', 404));
    track.likes ||= [];
    const index = track.likes.indexOf(req.userId);
    if (index >= 0) track.likes.splice(index, 1);
    else {
      track.likes.push(req.userId);
      const actor = db.users.find((user) => user.id === req.userId);
      const ownerId = trackOwnerId(track);
      if (ownerId && ownerId !== req.userId) db.notifications.push({ id: makeId(), userId: ownerId, type: 'like', actor: publicUser(actor), track: { id: track.id, title: track.title }, message: `${actor?.name || 'Someone'} liked your preview`, read: false, createdAt: new Date().toISOString() });
    }
    await writeDB(db);
    res.json({ liked: index < 0, likeCount: track.likes.length });
  } catch (error) { next(error); }
};

const addFeedComment = async (req, res, next) => {
  try {
    const text = String(req.body.text || '').trim();
    if (!text || text.length > 500) return next(new AppError('Comment must be between 1 and 500 characters.', 400));
    const db = ensureDBShape(await readDB());
    const track = db.tracks.find((item) => item.id === req.params.id && item.isPublished);
    if (!track) return next(new AppError('Preview not found', 404));
    const parentId = req.body.parentId ? String(req.body.parentId) : null;
    if (parentId && !(track.comments || []).some((entry) => entry.id === parentId)) return next(new AppError('Comment not found', 404));
    const comment = { id: makeId(), userId: req.userId, text, parentId, likes: [], createdAt: new Date().toISOString() };
    track.comments ||= [];
    track.comments.push(comment);
    if (parentId) {
      const parent = track.comments.find((entry) => entry.id === parentId);
      const actor = db.users.find((user) => user.id === req.userId);
      if (parent?.userId && parent.userId !== req.userId) {
        db.notifications.push({
          id: makeId(),
          userId: parent.userId,
          type: 'comment_reply',
          actor: publicUser(actor),
          track: { id: track.id, title: track.title },
          message: `${actor?.name || 'Someone'} replied to your comment`,
          read: false,
          createdAt: new Date().toISOString()
        });
      }
    }
    await writeDB(db);
    const commenter = db.users.find((user) => user.id === req.userId);
    res.status(201).json({ comment: { ...comment, likeCount: 0, likedByMe: false, user: commenter ? { id: commenter.id, name: commenter.name, avatarUrl: commenter.avatarUrl || null } : null } });
  } catch (error) { next(error); }
};

const toggleCommentLike = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const track = db.tracks.find((item) => item.id === req.params.id && item.isPublished);
    const comment = track?.comments?.find((entry) => entry.id === req.params.commentId);
    if (!comment) return next(new AppError('Comment not found', 404));
    comment.likes ||= [];
    const index = comment.likes.indexOf(req.userId);
    if (index >= 0) comment.likes.splice(index, 1);
    else {
      comment.likes.push(req.userId);
      const actor = db.users.find((user) => user.id === req.userId);
      if (comment.userId && comment.userId !== req.userId) db.notifications.push({ id: makeId(), userId: comment.userId, type: 'comment_like', actor: publicUser(actor), track: { id: track.id, title: track.title }, message: `${actor?.name || 'Someone'} liked your comment`, read: false, createdAt: new Date().toISOString() });
    }
    await writeDB(db);
    res.json({ liked: index < 0, likeCount: comment.likes.length });
  } catch (error) { next(error); }
};

const deleteFeedComment = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const track = db.tracks.find((item) => item.id === req.params.id);
    if (!track) return next(new AppError('Preview not found', 404));
    const index = (track.comments || []).findIndex((comment) => comment.id === req.params.commentId && comment.userId === req.userId);
    if (index < 0) return next(new AppError('Comment not found', 404));
    track.comments.splice(index, 1);
    await writeDB(db);
    res.json({ success: true });
  } catch (error) { next(error); }
};

const getTrackInsights = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const userId = req.userId;

    const track = findAccessibleTrack(db, req.params.id, userId);
    if (!track) return next(new AppError('Track not found', 404));

    const sourceTrackId = track.sourceTrackId || track.id;
    const ownerId = trackOwnerId(track) || track.userId;
    if (String(ownerId) !== String(userId)) return next(new AppError('Only the project owner can view insights.', 403));
    const playEvents = db.playEvents.filter((event) => (
      (event.projectId === track.projectId && (event.trackId === track.id || event.sourceTrackId === sourceTrackId)) ||
      ((event.ownerId === ownerId || event.ownerId === userId) && (event.sourceTrackId === sourceTrackId || event.trackId === track.id))
    ));

    const listenerMap = new Map();
    playEvents.forEach((event) => {
      const key = event.userId || event.actorId || 'unknown';
      const listener = db.users.find((item) => item.id === key);
      const current = listenerMap.get(key) || {
        id: key,
        name: listener?.name || 'Unknown listener',
        avatarUrl: listener?.avatarUrl || null,
        plays: 0,
        lastListenedAt: event.playedAt || event.createdAt
      };
      current.plays += 1;
      const playedAt = event.playedAt || event.createdAt;
      if (new Date(playedAt) > new Date(current.lastListenedAt)) current.lastListenedAt = playedAt;
      listenerMap.set(key, current);
    });

    res.json({
      track: { id: track.id, title: track.title },
      totalPlays: playEvents.length,
      byListener: Array.from(listenerMap.values()).sort((a, b) => b.plays - a.plays)
    });
  } catch (error) {
    next(error);
  }
};

const recordListen = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const track = db.tracks.find((item) => item.id === req.body?.trackId);
    if (!track) return next(new AppError('Track not found', 404));
    const project = db.projects.find((item) => item.id === (req.body?.projectId || track.projectId));
    if (!project) return next(new AppError('Project not found', 404));
    const playedAt = new Date().toISOString();
    db.playEvents.push({
      id: makeId(),
      trackId: track.id,
      projectId: project.id,
      ownerId: project.userId,
      userId: req.userId,
      playedAt
    });
    await writeDB(db);
    res.status(201).json({ recorded: true, playedAt });
  } catch (error) { next(error); }
};

const getProjectInsights = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const project = db.projects.find((item) => item.id === req.params.id);
    if (!project) return next(new AppError('Project not found', 404));
    if (project.userId !== req.userId) return next(new AppError('Only the project owner can view insights.', 403));
    const tracks = db.tracks.filter((item) => item.projectId === project.id);
    const trackIds = new Set(tracks.map((item) => item.id));
    const events = db.playEvents.filter((event) => event.projectId === project.id || trackIds.has(event.trackId));
    const byTrack = tracks.map((track) => ({ id: track.id, title: track.title, plays: events.filter((event) => event.trackId === track.id).length })).sort((a, b) => b.plays - a.plays);
    const listenerMap = new Map();
    events.forEach((event) => {
      const key = event.userId || 'unknown';
      const listener = db.users.find((item) => item.id === key);
      const current = listenerMap.get(key) || { id: key, name: listener?.name || 'Unknown listener', avatarUrl: listener?.avatarUrl || null, plays: 0, lastListenedAt: event.playedAt };
      current.plays += 1;
      if (new Date(event.playedAt) > new Date(current.lastListenedAt)) current.lastListenedAt = event.playedAt;
      listenerMap.set(key, current);
    });
    res.json({ project: { id: project.id, name: project.title || project.name, coverArt: project.coverArt, ownerName: db.users.find((item) => item.id === project.userId)?.name || 'Unknown artist', trackCount: tracks.length }, totalPlays: events.length, byTrack, byListener: Array.from(listenerMap.values()).sort((a, b) => b.plays - a.plays) });
  } catch (error) { next(error); }
};

const replaceAudio = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('No audio file uploaded', 400));
    const db = ensureDBShape(await readDB());
    const userId = req.userId;

    const trackIndex = db.tracks.findIndex((item) => item.id === req.params.id && (item.userId === userId || item.uploader?.id === userId));
    if (trackIndex === -1) {
      if (req.file) removeFileIfExists(req.file.path);
      return next(new AppError('Track not found', 404));
    }

    const track = db.tracks[trackIndex];
    track.versions ||= [];
    const previousFilename = track.filename;
    const previousVersionId = makeId();

    if (track.filename || track.url) {
      track.versions.push({
        id: previousVersionId,
        filename: track.filename,
        url: track.url,
        mimeType: track.mimeType,
        size: track.size,
        label: `Version ${track.versions.length + 1}`,
        uploadedAt: track.uploadedAt || new Date().toISOString()
      });
    }

    // Complete the request from local storage first; cloud promotion is best-effort.
    const storedFile = storeTrackLocally(req.file, userId);

    track.filename = storedFile.filename;
    track.url = storedFile.url;
    track.mimeType = req.file.mimetype;
    track.size = req.file.size;
    track.uploadedAt = new Date().toISOString();
    db.tracks[trackIndex] = track;
    await writeDB(db);
    invalidateCache(`workspace:${userId}`);
    if (track.projectId) invalidateCache(`project:${track.projectId}:${userId}`);
    res.json({ track: normalizeTrack(track) });
    const previousPath = previousFilename ? trackMediaPath({ ...track, filename: previousFilename }) : null;
    promoteTrackToCloudinary(track, storedFile.path, userId)
      .then(() => previousFilename && promoteVersionToCloudinary(track.id, previousVersionId, previousPath, userId))
      .catch((error) => console.error('Version Cloudinary promotion failed:', error.message));
  } catch (error) {
    next(error);
  }
};

const switchVersion = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const userId = req.userId;
    const { versionId } = req.body;
    if (!versionId) return next(new AppError('Version ID is required.', 400));

    const trackIndex = db.tracks.findIndex((item) => item.id === req.params.id && (item.userId === userId || item.uploader?.id === userId));
    if (trackIndex === -1) return next(new AppError('Track not found', 404));

    const track = db.tracks[trackIndex];
    track.versions ||= [];
    const versionIndex = track.versions.findIndex((version) => String(version.id) === String(versionId));
    if (versionIndex === -1) return next(new AppError('Version not found', 404));

    const selectedVersion = track.versions[versionIndex];
    const currentVersion = {
      id: makeId(),
      filename: track.filename,
      url: track.url,
      mimeType: track.mimeType,
      size: track.size,
      label: selectedVersion.label || `Version ${versionIndex + 1}`,
      uploadedAt: track.uploadedAt || new Date().toISOString()
    };

    track.versions.splice(versionIndex, 1, currentVersion);
    track.filename = selectedVersion.filename;
    track.url = selectedVersion.url || (selectedVersion.filename ? `${BASE_URL}/api/media/tracks/${track.id}/versions/${selectedVersion.id}` : track.url);
    track.mimeType = selectedVersion.mimeType;
    track.size = selectedVersion.size;
    track.uploadedAt = selectedVersion.uploadedAt || track.uploadedAt;
    db.tracks[trackIndex] = track;
    await writeDB(db);
    invalidateCache(`workspace:${userId}`);
    if (track.projectId) invalidateCache(`project:${track.projectId}:${userId}`);
    res.json({ track: normalizeTrack(track) });
  } catch (error) {
    next(error);
  }
};

const deleteVersion = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const userId = req.userId;

    const trackIndex = db.tracks.findIndex((item) => item.id === req.params.id && (item.userId === userId || item.uploader?.id === userId));
    if (trackIndex === -1) return next(new AppError('Track not found', 404));

    const track = db.tracks[trackIndex];
    track.versions ||= [];
    const versionIndex = track.versions.findIndex((version) => version.id === req.params.versionId);
    if (versionIndex === -1) return next(new AppError('Version not found', 404));

    const [removed] = track.versions.splice(versionIndex, 1);
    removeFileIfExists(path.join(uploadDir, trackOwnerId(track), removed.filename));
    db.tracks[trackIndex] = track;
    await writeDB(db);
    invalidateCache(`workspace:${userId}`);
    if (track.projectId) invalidateCache(`project:${track.projectId}:${userId}`);
    res.json({ track: normalizeTrack(track) });
  } catch (error) {
    next(error);
  }
};

const updateVersionLabel = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const userId = req.userId;
    const { label } = req.body;
    if (!label?.toString().trim()) return next(new AppError('Version label is required.', 400));

    const trackIndex = db.tracks.findIndex((item) => item.id === req.params.id && (item.userId === userId || item.uploader?.id === userId));
    if (trackIndex === -1) return next(new AppError('Track not found', 404));

    const track = db.tracks[trackIndex];
    track.versions ||= [];
    const version = track.versions.find((item) => item.id === req.params.versionId);
    if (!version) return next(new AppError('Version not found', 404));

    version.label = label.toString().trim();
    await writeDB(db);
    invalidateCache(`workspace:${userId}`);
    if (track.projectId) invalidateCache(`project:${track.projectId}:${userId}`);
    res.json({ track: normalizeTrack(track) });
  } catch (error) {
    next(error);
  }
};

const createNoteMemo = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('No voice memo uploaded', 400));
    const db = ensureDBShape(await readDB());
    const userId = req.userId;

    const trackIndex = db.tracks.findIndex((item) => item.id?.toString() === req.params.id?.toString());
    const track = trackIndex === -1 ? null : findAccessibleTrack(db, req.params.id, userId);
    if (!track) {
      if (req.file) removeFileIfExists(req.file.path);
      return next(new AppError('Track not found', 404));
    }

    const storedMemo = await storeMemoFile(req.file, userId, track.id);

    track.noteMemos ||= [];
    const memo = {
      id: makeId(),
      filename: storedMemo.filename,
      url: storedMemo.url,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date().toISOString()
    };
    track.noteMemos.push(memo);
    db.tracks[trackIndex] = track;
    await writeDB(db);
    invalidateCache(`workspace:${userId}`);
    if (track.projectId) invalidateCache(`project:${track.projectId}:${userId}`);
    res.json({ track: normalizeTrack(track), memo });
  } catch (error) {
    next(error);
  }
};

const deleteNoteMemo = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const userId = req.userId;

    const trackIndex = db.tracks.findIndex((item) => item.id?.toString() === req.params.id?.toString());
    const track = trackIndex === -1 ? null : findAccessibleTrack(db, req.params.id, userId);
    if (!track) return next(new AppError('Track not found', 404));

    track.noteMemos ||= [];
    const memo = track.noteMemos.find((item) => item.id === req.params.memoId);
    if (!memo) return next(new AppError('Voice memo not found', 404));

    if (memo.filename) {
      removeFileIfExists(path.join(noteMemoDir(track), memo.filename));
    } else if (memo.url) {
      const publicId = memo.url.split('/').pop().split('.')[0];
      cloudinary.uploader.destroy(`raremotionhub/memos/${publicId}`, { resource_type: 'video' }).catch(console.error);
    }

    track.noteMemos = track.noteMemos.filter((item) => item.id !== req.params.memoId);
    db.tracks[trackIndex] = track;
    await writeDB(db);
    invalidateCache(`workspace:${userId}`);
    if (track.projectId) invalidateCache(`project:${track.projectId}:${userId}`);
    res.json({ track: normalizeTrack(track) });
  } catch (error) {
    next(error);
  }
};

const splitStems = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const userId = req.userId;

    const track = findAccessibleTrack(db, req.params.id, userId);
    if (!track) return next(new AppError('Track not found', 404));

    const jobId = makeId();
    const outputRoot = path.join(stemsDir, userId, track.id, jobId);
    fs.mkdirSync(outputRoot, { recursive: true });

    const isCloudinary = !track.filename && Boolean(track.url);
    let sourcePath = track.filename ? trackMediaPath(track) : null;
    
    if (!isCloudinary && (!sourcePath || !fs.existsSync(sourcePath))) {
      return next(new AppError('Track audio file is missing on the server. Try re-uploading this track.', 404));
    }
    if (!isCloudinary && !sourcePath) {
      return next(new AppError('Track has no playable media source.', 422));
    }

    stemJobs[jobId] = { progress: 5, done: false, error: null, stems: null };
    res.json({ jobId });

    (async () => {
      let simulatedProgress = 25;
      const progressTimer = setInterval(() => {
        if (stemJobs[jobId] && !stemJobs[jobId].done && !stemJobs[jobId].error) {
          const remaining = 88 - simulatedProgress;
          const step = Math.max(1, Math.floor(remaining * 0.12));
          simulatedProgress = Math.min(88, simulatedProgress + step);
          stemJobs[jobId].progress = simulatedProgress;
        } else {
          clearInterval(progressTimer);
        }
      }, 2000);

      try {
        stemJobs[jobId].progress = 10;
        if (isCloudinary) {
          sourcePath = path.join(outputRoot, 'downloaded_track.mp3');
          await downloadFile(track.url, sourcePath);
        }

        let inputPath = sourcePath;
        const ext = path.extname(sourcePath).toLowerCase();
        if (ext !== '.wav') {
          const tempWav = path.join(outputRoot, 'input.wav');
          await convertToWav(sourcePath, tempWav);
          inputPath = tempWav;
        }

        stemJobs[jobId].progress = 25;
        await runDemucs(inputPath, outputRoot);
        clearInterval(progressTimer);
        stemJobs[jobId].progress = 90;

        const demucsOutputDir = findStemOutputDir(outputRoot);
        if (!demucsOutputDir) throw new Error('Stem output not found after Demucs processing.');

        const stems = await Promise.all(['drums', 'bass', 'other', 'vocals'].map(async (stem) => {
          const sourceFile = fs.readdirSync(demucsOutputDir).find((file) => file.startsWith(stem));
          if (!sourceFile) return null;
          
          const uploadResult = await cloudinary.uploader.upload_large(path.join(demucsOutputDir, sourceFile), {
            folder: `raremotionhub/stems/${track.id}`,
            resource_type: 'video',
            public_id: `${stem}-${jobId}`
          });

          return {
            name: stem,
            filename: null,
            url: uploadResult.secure_url
          };
        }));

        const completedStems = stems.filter(Boolean);
        const stemTracks = completedStems.map((stem) => ({
          id: makeId(),
          userId,
          projectId: track.projectId || null,
          title: `${track.title} - ${stem.name}`,
          artist: track.artist || '',
          producer: track.producer || '',
          filename: null,
          mimeType: 'audio/wav',
          size: 0,
          url: stem.url,
          uploader: track.uploader,
          uploadedAt: new Date().toISOString(),
          isStem: true,
          stemOf: track.id,
          stemType: stem.name
        }));
        const latestDb = ensureDBShape(await readDB());
        const originalIndex = latestDb.tracks.findIndex((item) => item.id === track.id);
        if (originalIndex !== -1) {
          latestDb.tracks[originalIndex] = {
            ...latestDb.tracks[originalIndex],
            stems: completedStems.map((stem) => ({ name: stem.name, url: stem.url, filename: null }))
          };
          latestDb.tracks.push(...stemTracks);
          await writeDB(latestDb);
          invalidateCache(`workspace:${userId}`);
          if (track.projectId) invalidateCache(`project:${track.projectId}:${userId}`);
        }
        stemJobs[jobId].stems = completedStems;
        stemJobs[jobId].trackIds = stemTracks.map((stem) => stem.id);
        stemJobs[jobId].done = true;
        stemJobs[jobId].progress = 100;
        removeDirIfExists(outputRoot);
        setTimeout(() => delete stemJobs[jobId], 120000);
      } catch (err) {
        clearInterval(progressTimer);
        console.error('Stem split failed:', err);
        stemJobs[jobId].error = err.message || 'Stem split failed';
        removeDirIfExists(outputRoot);
        setTimeout(() => delete stemJobs[jobId], 120000);
      }
    })();
  } catch (error) {
    next(error);
  }
};

const getStemStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const sendEvent = (data) => {
      try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch {}
    };

    sendEvent({ progress: 5 });

    const job = stemJobs[jobId];
    if (!job) {
      sendEvent({ error: 'Job not found or already expired.' });
      return res.end();
    }

    const timer = setInterval(() => {
      if (stemJobs[jobId]) {
        sendEvent({
          progress: stemJobs[jobId].progress,
          done: stemJobs[jobId].done,
          stems: stemJobs[jobId].stems,
          error: stemJobs[jobId].error
        });
        if (stemJobs[jobId].done || stemJobs[jobId].error) {
          clearInterval(timer);
          res.end();
        }
      } else {
        clearInterval(timer);
        res.end();
      }
    }, 1000);

    req.on('close', () => clearInterval(timer));
  } catch (error) {
    next(error);
  }
};

const convertVideo = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('No video file uploaded', 400));
    const userId = req.userId;
    const db = ensureDBShape(await readDB());
    const uploader = db.users.find(u => u.id === userId);
    if (!uploader) {
      removeFileIfExists(req.file.path);
      return next(new AppError('Unauthorized user.', 401));
    }

    const outputFormat = ['mp3', 'wav', 'm4a'].includes(String(req.body.format || '').toLowerCase())
      ? String(req.body.format).toLowerCase()
      : 'mp3';
    const originalNameNoExt = path.basename(req.file.originalname, path.extname(req.file.originalname));
    const newFilename = Date.now() + '-' + Math.round(Math.random() * 1e9) + `.${outputFormat}`;
    const userDir = path.join(uploadDir, userId);
    fs.mkdirSync(userDir, { recursive: true });
    const outputPath = path.join(userDir, newFilename);
    const jobId = makeId();
    conversionJobs[jobId] = { progress: 0, done: false, error: null };
    res.json({ jobId });

    const { ffmpeg } = require('../services/audio.service');
    const conversion = ffmpeg(req.file.path).noVideo().audioFrequency(44100);
    if (outputFormat === 'mp3') conversion.audioCodec('libmp3lame').audioBitrate('192k');
    if (outputFormat === 'wav') conversion.audioCodec('pcm_s16le');
    if (outputFormat === 'm4a') conversion.audioCodec('aac').audioBitrate('192k');
    conversion
      .on('progress', (progress) => {
        if (progress.percent && conversionJobs[jobId]) {
          conversionJobs[jobId].progress = Math.round(progress.percent);
        }
      })
      .on('end', async () => {
        try {
        const currentDb = ensureDBShape(await readDB());
        const projectId = makeId();
        const newProject = {
          id: projectId,
          name: originalNameNoExt,
          title: originalNameNoExt,
          artist: uploader.name,
          userId,
          folderId: null,
          coverArt: null,
          createdAt: new Date().toISOString()
        };
        currentDb.projects.push(newProject);

        const trackId = makeId();
        const newTrack = {
          id: trackId,
          userId,
          projectId: projectId,
          title: originalNameNoExt,
          artist: uploader.name,
          producer: '',
          filename: null,
          mimeType: outputFormat === 'wav' ? 'audio/wav' : outputFormat === 'm4a' ? 'audio/mp4' : 'audio/mpeg',
          size: fs.statSync(outputPath).size,
          url: '',
          uploader: { id: uploader.id, name: uploader.name },
          uploadedAt: new Date().toISOString()
        };
        
        const storedFile = await storeTrackFile({
          path: outputPath,
          filename: newFilename,
          originalname: newFilename,
          mimetype: outputFormat === 'wav' ? 'audio/wav' : outputFormat === 'm4a' ? 'audio/mp4' : 'audio/mpeg'
        }, userId);
        newTrack.filename = storedFile.filename;
        newTrack.url = storedFile.url;
        removeFileIfExists(req.file.path);

        currentDb.tracks.push(newTrack);
        await writeDB(currentDb);
        invalidateCache(`workspace:${userId}`);
        
        if (conversionJobs[jobId]) {
          conversionJobs[jobId].done = true;
          conversionJobs[jobId].project = newProject;
          conversionJobs[jobId].track = newTrack;
          setTimeout(() => delete conversionJobs[jobId], 60000);
        }
        } catch (err) {
          console.error('Conversion finalization failed:', err);
          removeFileIfExists(req.file.path);
          removeFileIfExists(outputPath);
          if (conversionJobs[jobId]) {
            conversionJobs[jobId].error = err.message || 'Conversion finalization failed';
            setTimeout(() => delete conversionJobs[jobId], 60000);
          }
        }
      })
      .on('error', (err) => {
        console.error('ffmpeg error:', err);
        removeFileIfExists(req.file.path);
        removeFileIfExists(outputPath);
        if (conversionJobs[jobId]) {
          conversionJobs[jobId].error = 'Conversion failed';
          setTimeout(() => delete conversionJobs[jobId], 60000);
        }
      })
      .save(outputPath);
  } catch (error) {
    next(error);
  }
};

const getConvertStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    if (req.query.poll === '1') {
      const job = conversionJobs[jobId];
      if (!job) return res.status(404).json({ error: 'Job not found or already expired.' });
      return res.json({ progress: job.progress, done: job.done, project: job.project, track: job.track, error: job.error });
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (data) => {
      try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch {}
    };

    const job = conversionJobs[jobId];
    if (!job) {
      sendEvent({ error: 'Job not found' });
      return res.end();
    }

    const timer = setInterval(() => {
      if (conversionJobs[jobId]) {
        sendEvent({
          progress: conversionJobs[jobId].progress,
          done: conversionJobs[jobId].done,
          project: conversionJobs[jobId].project,
          error: conversionJobs[jobId].error
        });
        if (conversionJobs[jobId].done || conversionJobs[jobId].error) {
          clearInterval(timer);
          res.end();
        }
      } else {
        clearInterval(timer);
        res.end();
      }
    }, 1000);

    req.on('close', () => clearInterval(timer));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadTrackController,
  getTrackUploadSignature,
  createCloudinaryTrack,
  deleteTrack,
  patchTrack,
  publishTrack,
  getFeed,
  deleteFeed,
  toggleFeedLike,
  toggleFeedSave,
  addFeedComment,
  deleteFeedComment,
  toggleCommentLike,
  getTrackInsights,
  recordListen,
  getProjectInsights,
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
};
