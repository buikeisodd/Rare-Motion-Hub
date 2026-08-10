const fs = require('fs');
const path = require('path');
const { Track, Project } = require('../models');
const { readDB, writeDB, ensureDBShape } = require('../utils/dbHelper');
const {
  makeId,
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
    removeFileIfExists(localPath);
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

const getTrackInsights = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const userId = req.userId;

    const track = findAccessibleTrack(db, req.params.id, userId);
    if (!track) return next(new AppError('Track not found', 404));

    const sourceTrackId = track.sourceTrackId || track.id;
    const playEvents = db.playEvents.filter((event) => (
      event.ownerId === userId &&
      (event.sourceTrackId === sourceTrackId || event.trackId === track.id)
    ));

    const listenerMap = new Map();
    playEvents.forEach((event) => {
      const listener = db.users.find((item) => item.id === event.actorId);
      const key = event.actorId || 'unknown';
      const current = listenerMap.get(key) || {
        id: key,
        name: listener?.name || 'Unknown listener',
        avatarUrl: listener?.avatarUrl || null,
        plays: 0,
        lastListenedAt: event.createdAt
      };
      current.plays += 1;
      if (new Date(event.createdAt) > new Date(current.lastListenedAt)) current.lastListenedAt = event.createdAt;
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

    if (track.filename) {
      track.versions.push({
        id: makeId(),
        filename: track.filename,
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
    promoteTrackToCloudinary(track, storedFile.path, userId);
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
    const versionIndex = track.versions.findIndex((version) => version.id === versionId);
    if (versionIndex === -1) return next(new AppError('Version not found', 404));

    const selectedVersion = track.versions[versionIndex];
    const currentVersion = {
      id: makeId(),
      filename: track.filename,
      mimeType: track.mimeType,
      size: track.size,
      label: selectedVersion.label || `Version ${versionIndex + 1}`,
      uploadedAt: track.uploadedAt || new Date().toISOString()
    };

    track.versions.splice(versionIndex, 1, currentVersion);
    track.filename = selectedVersion.filename;
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
        const currentDb = await readDB();
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
          mimetype: 'audio/wav'
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
};
