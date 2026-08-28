const crypto = require('crypto');
const path = require('path');
const { Folder, Project, Track, CoverArt } = require('../models');
const { readDB, writeDB, ensureDBShape } = require('../utils/dbHelper');
const {
  makeId,
  publicUser,
  userExists,
  ownerNameFor,
  defaultTitleFor,
  normalizeLibraryItem,
  normalizeTrack,
  getProjectBundle,
  notifyListen,
  trackOwnerId,
  trackMediaPath,
  BASE_URL
} = require('../utils/helpers');
const { getOrSetCache, invalidateCache } = require('../config/redis');
const { cloudinary, hasCloudinaryConfig } = require('../config/cloudinary');
const { removeDirIfExists, removeFileIfExists, stemsDir, coverDir } = require('../utils/fileHelper');
const { AppError } = require('../middlewares/error.middleware');

const canAccessItem = (item, userId) => item && (item.userId === userId || item.visibility !== 'private' || (item.allowedUserIds || []).includes(userId));

const getWorkspace = async (req, res, next) => {
  try {
    const userId = req.userId;
    const data = await getOrSetCache(`workspace:${userId}`, 3600, async () => {
      const db = ensureDBShape(await readDB());
      if (!userExists(db, userId)) return { error: 'Unauthorized user.', status: 401 };

      const rootFolders = db.folders.filter((folder) => folder.userId === userId && !folder.parentFolderId);
      return {
        folders: rootFolders.map((folder) => normalizeLibraryItem(folder, db, 'folder')),
        projects: db.projects.filter((project) => project.userId === userId).map((project) => normalizeLibraryItem(project, db, 'project')),
        tracks: db.tracks.filter((track) => track.userId === userId || track.uploader?.id === userId).map(normalizeTrack),
        coverArts: db.coverArts.filter((cover) => cover.userId === userId),
        notifications: db.notifications.filter((notification) => notification.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      };
    });

    if (data.error) return next(new AppError(data.error, data.status));
    res.json(data);
  } catch (error) {
    next(error);
  }
};

const generateShare = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const { type, targetId, expiresInMs } = req.body;
    if (!['project', 'folder'].includes(type) || !targetId) {
      return next(new AppError('Valid type and targetId are required.', 400));
    }

    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = expiresInMs ? new Date(Date.now() + expiresInMs).toISOString() : null;

    const shareLink = {
      id: makeId(),
      token,
      type,
      itemId: targetId,
      userId: req.userId,
      expiresAt,
      createdAt: new Date().toISOString()
    };

    db.shareLinks.push(shareLink);
    await writeDB(db);

    res.json({ token, expiresAt });
  } catch (error) {
    next(error);
  }
};

const getShareLink = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const link = db.shareLinks.find((l) => l.token === req.params.token);
    
    if (!link) return next(new AppError('Share link not found.', 404));

    if (link.expiresAt && Date.now() > new Date(link.expiresAt).getTime()) {
      return res.status(410).json({ error: 'Link no longer accessible.', expired: true });
    }

    if (link.type === 'project') {
      const project = db.projects.find((item) => item.id === (link.itemId || link.targetId));
      if (!project) return next(new AppError('Project not found.', 404));
      return res.json(getProjectBundle(db, project));
    } else if (link.type === 'folder') {
      const folder = db.folders.find((item) => item.id === (link.itemId || link.targetId));
      if (!folder) return next(new AppError('Folder not found.', 404));
      const subFolders = db.folders.filter((f) => f.folderId === folder.id);
      const subProjects = db.projects.filter((p) => p.folderId === folder.id);
      const tracks = db.tracks.filter((t) => subProjects.some((sp) => sp.id === t.projectId));
      return res.json({
        type: 'folder',
        folder: normalizeLibraryItem(folder, db, 'folder'),
        owner: publicUser(db.users.find((user) => user.id === folder.userId)),
        folders: subFolders.map((f) => normalizeLibraryItem(f, db, 'folder')),
        projects: subProjects.map((p) => normalizeLibraryItem(p, db, 'project')),
        tracks: tracks.map(normalizeTrack)
      });
    }

    return next(new AppError('Invalid link type.', 400));
  } catch (error) {
    next(error);
  }
};

const getFolder = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const userId = req.userId;
    const folder = db.folders.find((f) => f.id === req.params.id);
    if (!folder) return next(new AppError('Folder not found', 404));
    if (!canAccessItem(folder, userId)) return next(new AppError('This folder is private.', 403));

    const childProjects = db.projects.filter((p) => p.folderId === folder.id && canAccessItem(p, userId));
    const childFolders = db.folders.filter((f) => f.parentFolderId === folder.id && canAccessItem(f, userId));

    const breadcrumbs = [];
    let current = folder;
    while (current.parentFolderId) {
      const parent = db.folders.find((f) => f.id === current.parentFolderId);
      if (!parent) break;
      breadcrumbs.unshift({ id: parent.id, title: parent.title || parent.name });
      current = parent;
    }

    res.json({
      folder: normalizeLibraryItem(folder, db, 'folder'),
      folders: childFolders.map((f) => normalizeLibraryItem(f, db, 'folder')),
      projects: childProjects.map((p) => normalizeLibraryItem(p, db, 'project')),
      tracks: db.tracks.filter((t) => t.userId === userId || t.uploader?.id === userId).map(normalizeTrack),
      breadcrumbs
    });
  } catch (error) {
    next(error);
  }
};

const createFolder = async (req, res, next) => {
  try {
    const { name, title, artist, parentFolderId } = req.body;
    const userId = req.userId;
    const db = ensureDBShape(await readDB());
    const ownerName = ownerNameFor(db, userId);
    if (!userExists(db, userId)) return next(new AppError('Unauthorized user.', 401));
    if (parentFolderId && !db.folders.some((f) => f.id === parentFolderId && f.userId === userId)) {
      return next(new AppError('Parent folder not found', 404));
    }
    const nextTitle = (title || name || '').trim() || defaultTitleFor('folder');
    const newFolder = {
      id: makeId(),
      name: nextTitle,
      title: nextTitle,
      artist: artist?.trim() || ownerName,
      visibility: 'public',
      allowedUserIds: [],
      accessRequests: [],
      userId,
      parentFolderId: parentFolderId || null,
      createdAt: new Date().toISOString()
    };
    db.folders.push(newFolder);
    await writeDB(db);
    invalidateCache(`workspace:${userId}`);
    res.json(newFolder);
  } catch (error) {
    next(error);
  }
};

const moveFolder = async (req, res, next) => {
  try {
    const { parentFolderId } = req.body;
    const userId = req.userId;
    const db = ensureDBShape(await readDB());
    const folderIndex = db.folders.findIndex((f) => f.id === req.params.id && f.userId === userId);
    if (folderIndex === -1) return next(new AppError('Folder not found', 404));

    if (parentFolderId) {
      if (parentFolderId === req.params.id) return next(new AppError('Cannot move a folder into itself', 400));
      if (!db.folders.some((f) => f.id === parentFolderId && f.userId === userId)) {
        return next(new AppError('Target folder not found', 404));
      }
      const isDescendant = (folderId, ancestorId) => {
        const f = db.folders.find((x) => x.id === folderId);
        if (!f || !f.parentFolderId) return false;
        if (f.parentFolderId === ancestorId) return true;
        return isDescendant(f.parentFolderId, ancestorId);
      };
      if (isDescendant(parentFolderId, req.params.id)) {
        return next(new AppError('Cannot move a folder into one of its own sub-folders', 400));
      }
    }

    const nextParentFolderId = parentFolderId || null;
    db.folders[folderIndex].parentFolderId = nextParentFolderId;
    db.folders[folderIndex].updatedAt = new Date().toISOString();
    await writeDB(db);
    await Folder.findOneAndUpdate(
      { id: req.params.id, userId },
      { parentFolderId: nextParentFolderId, updatedAt: db.folders[folderIndex].updatedAt }
    );
    invalidateCache(`workspace:${userId}`);
    res.json(normalizeLibraryItem(db.folders[folderIndex], db, 'folder'));
  } catch (error) {
    next(error);
  }
};

const updateFolder = async (req, res, next) => {
  try {
    const { title, name, artist, visibility, allowedUserIds } = req.body;
    const userId = req.userId;
    const db = ensureDBShape(await readDB());
    const folderIndex = db.folders.findIndex((folder) => folder.id === req.params.id && folder.userId === userId);
    if (folderIndex === -1) return next(new AppError('Folder not found', 404));

    const nextTitle = (title ?? name ?? db.folders[folderIndex].title ?? db.folders[folderIndex].name ?? '').trim() || defaultTitleFor('folder');
    const nextArtist = (artist ?? db.folders[folderIndex].artist ?? '').trim() || ownerNameFor(db, userId);
    db.folders[folderIndex] = {
      ...db.folders[folderIndex],
      name: nextTitle,
      title: nextTitle,
      artist: nextArtist,
      visibility: visibility === undefined ? (db.folders[folderIndex].visibility || 'public') : (visibility === 'private' ? 'private' : 'public'),
      allowedUserIds: Array.isArray(allowedUserIds) ? allowedUserIds : (db.folders[folderIndex].allowedUserIds || []),
      updatedAt: new Date().toISOString()
    };
    if (db.folders[folderIndex].visibility === 'private') {
      const childProjectIds = db.projects.filter((project) => project.folderId === req.params.id).map((project) => project.id);
      db.tracks.forEach((track) => { if (childProjectIds.includes(track.projectId)) { track.isPublished = false; track.publishedAt = null; } });
    }
    await writeDB(db);
    invalidateCache(`workspace:${userId}`);
    res.json(normalizeLibraryItem(db.folders[folderIndex], db, 'folder'));
  } catch (error) {
    next(error);
  }
};

const deleteFolder = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const userId = req.userId;

    const folderIndex = db.folders.findIndex((f) => f.id === req.params.id && f.userId === userId);
    if (folderIndex === -1) return next(new AppError('Folder not found', 404));

    db.folders.forEach(f => {
      if (f.parentFolderId === req.params.id) f.parentFolderId = null;
    });
    db.projects.forEach(p => {
      if (p.folderId === req.params.id) p.folderId = null;
    });

    db.folders.splice(folderIndex, 1);
    await writeDB(db);
    await Folder.deleteOne({ id: req.params.id });
    invalidateCache(`workspace:${userId}`);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const createProject = async (req, res, next) => {
  try {
    const { name, title, artist, folderId, visibility } = req.body;
    const userId = req.userId;
    const db = ensureDBShape(await readDB());
    const ownerName = ownerNameFor(db, userId);
    if (!userExists(db, userId)) return next(new AppError('Unauthorized user.', 401));
    if (folderId && !db.folders.some((folder) => folder.id === folderId && folder.userId === userId)) {
      return next(new AppError('Folder not found', 404));
    }
    const nextTitle = (title || name || '').trim() || defaultTitleFor('project');
    const newProject = { 
      id: makeId(),
      name: nextTitle,
      title: nextTitle,
      artist: artist?.trim() || ownerName,
      userId, 
      folderId: folderId || null,
      coverArt: null,
      visibility: visibility === 'private' ? 'private' : 'public',
      allowedUserIds: [],
      accessRequests: [],
      createdAt: new Date().toISOString() 
    };
    db.projects.push(newProject);
    await writeDB(db);
    invalidateCache(`workspace:${userId}`);
    res.json(newProject);
  } catch (error) {
    next(error);
  }
};

const updateProject = async (req, res, next) => {
  try {
    const { title, name, artist, visibility, allowedUserIds } = req.body;
    const userId = req.userId;
    const db = ensureDBShape(await readDB());
    const projectIndex = db.projects.findIndex((project) => project.id === req.params.id && project.userId === userId);
    if (projectIndex === -1) return next(new AppError('Project not found', 404));

    const nextTitle = (title ?? name ?? db.projects[projectIndex].title ?? db.projects[projectIndex].name ?? '').trim() || defaultTitleFor('project');
    const nextArtist = (artist ?? db.projects[projectIndex].artist ?? '').trim() || ownerNameFor(db, userId);
    db.projects[projectIndex] = {
      ...db.projects[projectIndex],
      name: nextTitle,
      title: nextTitle,
      artist: nextArtist,
      visibility: visibility === undefined ? (db.projects[projectIndex].visibility || 'public') : (visibility === 'private' ? 'private' : 'public'),
      allowedUserIds: Array.isArray(allowedUserIds) ? allowedUserIds : (db.projects[projectIndex].allowedUserIds || []),
      updatedAt: new Date().toISOString()
    };
    if (db.projects[projectIndex].visibility === 'private') {
      db.tracks.forEach((track) => { if (track.projectId === req.params.id) { track.isPublished = false; track.publishedAt = null; } });
    }
    await writeDB(db);
    invalidateCache(`workspace:${userId}`);
    invalidateCache(`project:${req.params.id}:${userId}`);
    res.json(normalizeLibraryItem(db.projects[projectIndex], db, 'project'));
  } catch (error) {
    next(error);
  }
};

const moveProject = async (req, res, next) => {
  try {
    const { folderId } = req.body;
    const userId = req.userId;
    const db = ensureDBShape(await readDB());
    const projIndex = db.projects.findIndex(p => p.id === req.params.id && p.userId === userId);
    if (projIndex === -1) return next(new AppError('Project not found', 404));
    if (folderId && !db.folders.some((folder) => folder.id === folderId && folder.userId === userId)) {
      return next(new AppError('Folder not found', 404));
    }

    const nextFolderId = folderId || null;
    db.projects[projIndex].folderId = nextFolderId;
    db.projects[projIndex].updatedAt = new Date().toISOString();
    await writeDB(db);
    await Project.findOneAndUpdate(
      { id: req.params.id, userId },
      { folderId: nextFolderId, updatedAt: db.projects[projIndex].updatedAt }
    );
    invalidateCache(`workspace:${userId}`);
    res.json(normalizeLibraryItem(db.projects[projIndex], db, 'project'));
  } catch (error) {
    next(error);
  }
};

const deleteProject = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const userId = req.userId;
    const project = db.projects.find((p) => p.id === req.params.id && p.userId === userId);
    if (!project) return next(new AppError('Project not found', 404));

    const tracksToDelete = db.tracks.filter(t => t.projectId === req.params.id && (t.userId === userId || t.uploader?.id === userId));
    for (const track of tracksToDelete) {
      if (track.filename) {
        removeFileIfExists(trackMediaPath(track));
        (track.versions || []).forEach((version) => {
          removeFileIfExists(path.join(uploadDir, trackOwnerId(track), version.filename));
        });
      } else if (track.url) {
        // Delete from Cloudinary
        const publicId = track.url.split('/').pop().split('.')[0];
        cloudinary.uploader.destroy(`raremotionhub/tracks/${publicId}`, { resource_type: 'video' }).catch(console.error);
      }
      removeDirIfExists(path.join(stemsDir, trackOwnerId(track), track.id));
    }

    db.projects = db.projects.filter(p => p.id !== req.params.id);
    db.tracks = db.tracks.filter(t => !(t.projectId === req.params.id && (t.userId === userId || t.uploader?.id === userId)));
    await writeDB(db);

    await Project.deleteOne({ id: req.params.id });
    await Track.deleteMany({ projectId: req.params.id, $or: [{ userId }, { 'uploader.id': userId }] });
    await CoverArt.deleteMany({ projectId: req.params.id });

    invalidateCache(`workspace:${userId}`);
    invalidateCache(`project:${req.params.id}:${userId}`);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const getCovers = async (req, res, next) => {
  try {
    const userId = req.userId;
    const db = ensureDBShape(await readDB());
    const covers = db.coverArts
      .filter(c => c.userId === userId)
      .sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
    res.json({ covers });
  } catch (error) {
    next(error);
  }
};

const updateProjectCover = async (req, res, next) => {
  try {
    const { coverUrl } = req.body;
    const userId = req.userId;
    const db = ensureDBShape(await readDB());
    const projIndex = db.projects.findIndex(p => p.id === req.params.id && p.userId === userId);
    if (projIndex === -1) return next(new AppError('Project not found', 404));

    db.projects[projIndex].coverArt = coverUrl || null;
    await writeDB(db);
    invalidateCache(`workspace:${userId}`);
    invalidateCache(`project:${req.params.id}:${userId}`);
    res.json(db.projects[projIndex]);
  } catch (error) {
    next(error);
  }
};

const getSharedItem = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const { type, id } = req.params;
    if (type === 'project') {
      const project = db.projects.find((item) => item.id === id);
      if (!project) return next(new AppError('Project not found.', 404));
      return res.json(getProjectBundle(db, project));
    }
    if (type === 'folder') {
      const folder = db.folders.find((item) => item.id === id);
      if (!folder) return next(new AppError('Folder not found.', 404));
      const subFolders = db.folders.filter((item) => item.parentFolderId === folder.id);
      const subProjects = db.projects.filter((item) => item.folderId === folder.id);
      const tracks = db.tracks.filter((track) => subProjects.some((project) => project.id === track.projectId));
      return res.json({
        type: 'folder',
        folder: normalizeLibraryItem(folder, db, 'folder'),
        owner: publicUser(db.users.find((user) => user.id === folder.userId)),
        folders: subFolders.map((item) => normalizeLibraryItem(item, db, 'folder')),
        projects: subProjects.map((item) => normalizeLibraryItem(item, db, 'project')),
        tracks: tracks.map(normalizeTrack)
      });
    }
    return next(new AppError('Invalid shared item type.', 400));
  } catch (error) {
    next(error);
  }
};

const saveSharedItem = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const userId = req.userId;
    const type = req.params.type;
    const sourceId = req.params.id;
    if (!['project', 'folder'].includes(type)) return next(new AppError('Invalid shared item type.', 400));

    const source = type === 'project'
      ? db.projects.find((item) => item.id === sourceId)
      : db.folders.find((item) => item.id === sourceId);
    if (!source) return next(new AppError('Shared item not found.', 404));
    if (source.userId === userId) return next(new AppError('This item is already in your library.', 409));

    // Cloned records must receive fresh Mongo identifiers. Copying lean _id
    // values into a new record causes duplicate-key failures and can also
    // preserve identifiers belonging to nested version subdocuments.
    const stripMongoIds = (value) => {
      if (Array.isArray(value)) return value.map(stripMongoIds);
      if (!value || typeof value !== 'object') return value;
      const { _id, ...rest } = value;
      return Object.fromEntries(Object.entries(rest).map(([key, entry]) => [key, stripMongoIds(entry)]));
    };

    const sourceProjects = type === 'project'
      ? [source]
      : db.projects.filter((item) => item.folderId === source.id);
    const sourceFolders = type === 'folder'
      ? [source, ...db.folders.filter((item) => item.parentFolderId === source.id)]
      : [];
    const folderMap = new Map();
    const savedFolders = sourceFolders.map((folder) => {
      const copy = { ...stripMongoIds(folder), id: makeId(), userId, sourceItemId: folder.id, sourceOwnerId: folder.userId, allowedUserIds: [], accessRequests: [] };
      folderMap.set(folder.id, copy.id);
      return copy;
    });
    savedFolders.forEach((folder, index) => {
      const original = sourceFolders[index];
      folder.parentFolderId = original.parentFolderId ? (folderMap.get(original.parentFolderId) || null) : null;
    });

    const projectMap = new Map();
    const savedProjects = sourceProjects.map((project) => {
      const copy = { ...stripMongoIds(project), id: makeId(), userId, sourceItemId: project.id, sourceOwnerId: project.userId, allowedUserIds: [], accessRequests: [] };
      copy.folderId = project.folderId ? (folderMap.get(project.folderId) || null) : (type === 'folder' ? folderMap.get(source.id) : null);
      projectMap.set(project.id, copy.id);
      return copy;
    });
    const savedTracks = db.tracks
      .filter((track) => projectMap.has(track.projectId))
      .map((track) => ({ ...stripMongoIds(track), id: makeId(), sourceTrackId: track.sourceTrackId || track.sourceItemId || track.id, userId, projectId: projectMap.get(track.projectId), sourceItemId: track.id, sourceOwnerId: track.userId, uploader: { id: userId, name: db.users.find((item) => item.id === userId)?.name || '' } }));

    db.folders.push(...savedFolders);
    db.projects.push(...savedProjects);
    db.tracks.push(...savedTracks);
    await writeDB(db);
    invalidateCache(`workspace:${userId}`);
    const rootFolder = savedFolders.find((folder) => !folder.parentFolderId);
    const rootProject = savedProjects.find((project) => !project.folderId) || savedProjects[0];
    res.status(201).json({
      type,
      folder: rootFolder ? normalizeLibraryItem(rootFolder, db, 'folder') : null,
      project: rootProject ? normalizeLibraryItem(rootProject, db, 'project') : null,
      projects: savedProjects.map((project) => normalizeLibraryItem(project, db, 'project')),
      tracks: savedTracks.map(normalizeTrack)
    });
  } catch (error) {
    next(error);
  }
};

const requestWorkspaceAccess = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const userId = req.userId;
    if (!['folder', 'project'].includes(req.params.type)) return next(new AppError('Invalid workspace type.', 400));
    const collection = req.params.type === 'folder' ? db.folders : db.projects;
    const item = collection.find((entry) => entry.id === req.params.id);
    if (!item) return next(new AppError('Workspace item not found.', 404));
    if (item.visibility === 'public' || item.userId === userId || (item.allowedUserIds || []).includes(userId)) return res.json({ status: 'granted' });
    item.accessRequests ||= [];
    if (!item.accessRequests.some((request) => request.userId === userId && request.status === 'pending')) item.accessRequests.push({ userId, status: 'pending', createdAt: new Date().toISOString() });
    await writeDB(db);
    res.status(201).json({ status: 'pending' });
  } catch (error) { next(error); }
};

const decideWorkspaceAccess = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    if (!['folder', 'project'].includes(req.params.type)) return next(new AppError('Invalid workspace type.', 400));
    const collection = req.params.type === 'folder' ? db.folders : db.projects;
    const item = collection.find((entry) => entry.id === req.params.id && entry.userId === req.userId);
    if (!item) return next(new AppError('Workspace item not found.', 404));
    const request = (item.accessRequests || []).find((entry) => entry.userId === req.body.userId);
    if (!request) return next(new AppError('Access request not found.', 404));
    request.status = req.body.approved === true ? 'approved' : 'rejected';
    item.allowedUserIds = (item.allowedUserIds || []).filter((id) => id !== request.userId);
    if (request.status === 'approved') item.allowedUserIds.push(request.userId);
    await writeDB(db);
    res.json({ status: request.status, allowedUserIds: item.allowedUserIds });
  } catch (error) { next(error); }
};

const getProject = async (req, res, next) => {
  try {
    const userId = req.userId;
    // Project comments are collaborative and must be read fresh. Serving a
    // long-lived cached project snapshot hides comments from shared listeners.
    const data = await (async () => {
      const db = ensureDBShape(await readDB());
      const project = db.projects.find((item) => item.id === req.params.id);
      if (!project) return { error: 'Project not found', status: 404 };
      if (!canAccessItem(project, userId)) return { error: 'This project is private.', status: 403 };
      const tracks = db.tracks.filter((track) => track.projectId === project.id).map((track) => {
        const sourceId = track.sourceTrackId || track.sourceItemId;
        const source = sourceId ? db.tracks.find((item) => item.id === sourceId) : null;
        return normalizeTrack({ ...track, comments: source?.comments || track.comments || [] });
      });
      return { project: normalizeLibraryItem(project, db, 'project'), tracks };
    })();

    if (data.error) return next(new AppError(data.error, data.status));
    res.json(data);
  } catch (error) {
    next(error);
  }
};

const uploadCover = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('No image file uploaded', 400));
    const userId = req.userId;
    const db = ensureDBShape(await readDB());
    if (!userExists(db, userId)) {
      if (req.file.filename) {
        cloudinary.uploader.destroy(req.file.filename).catch(console.error);
      }
      return next(new AppError('Unauthorized user.', 401));
    }

    let url = `${BASE_URL}/covers/${req.file.filename}`;
    if (hasCloudinaryConfig) {
      try {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: 'raremotionhub/covers',
          resource_type: 'image'
        });
        url = uploadResult.secure_url;
        removeFileIfExists(req.file.path);
      } catch (uploadError) {
        console.error('Cloudinary cover upload failed, keeping local file:', uploadError.message);
      }
    }
    const newCover = {
      id: Date.now().toString(),
      userId,
      url,
      filename: url.startsWith(`${BASE_URL}/covers/`) ? req.file.filename : null,
      mimeType: req.file.mimetype,
      uploadedAt: new Date().toISOString()
    };
    db.coverArts.push(newCover);
    await writeDB(db);
    invalidateCache(`workspace:${userId}`);
    res.json(newCover);
  } catch (error) {
    next(error);
  }
};

const deleteCover = async (req, res, next) => {
  try {
    const db = ensureDBShape(await readDB());
    const userId = req.userId;
    const cover = db.coverArts.find((c) => c.id === req.params.id && c.userId === userId);
    if (!cover) return next(new AppError('Cover art not found', 404));

    const coverUrl = cover.url;
    db.coverArts = db.coverArts.filter(c => c.id !== req.params.id);
    db.projects.forEach(p => {
      if (p.coverArt === coverUrl) p.coverArt = null;
    });

    await writeDB(db);
    await CoverArt.deleteOne({ id: req.params.id });
    
    if (cover.filename) {
      removeFileIfExists(path.join(coverDir, cover.filename));
    } else {
      const publicId = coverUrl.split('/').pop().split('.')[0];
      cloudinary.uploader.destroy(`raremotionhub/covers/${publicId}`).catch(console.error);
    }

    invalidateCache(`workspace:${userId}`);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWorkspace,
  generateShare,
  getShareLink,
  getSharedItem,
  saveSharedItem,
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
  requestWorkspaceAccess,
  decideWorkspaceAccess,
  uploadCover,
  deleteCover
};
