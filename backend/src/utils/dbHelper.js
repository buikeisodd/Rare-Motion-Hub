const {
  User, Project, Track, Folder, CoverArt,
  Notification, PlayEvent, Message, ChatGroup, Call, CallSignal, ShareLink, Story
} = require('../models');

const readDB = async () => {
  const [users, projects, tracks, folders, coverArts, notifications, playEvents, messages, groups, calls, callSignals, shareLinks, stories] = await Promise.all([
    User.find().lean(),
    Project.find().lean(),
    Track.find().lean(),
    Folder.find().lean(),
    CoverArt.find().lean(),
    Notification.find().lean(),
    PlayEvent.find().lean(),
    Message.find().lean(),
    ChatGroup.find().lean(),
    Call.find().lean(),
    CallSignal.find().lean(),
    ShareLink.find().lean(),
    Story.find().lean(),
  ]);
  return { users, projects, tracks, folders, coverArts, notifications, playEvents, messages, groups, calls, callSignals, shareLinks, stories };
};

const writeDB = async (db) => {
  const ops = [
    ...( db.users        || [] ).map(d => User.findOneAndUpdate(        { id: d.id }, d, { upsert: true, returnDocument: 'after', lean: true } )),
    ...( db.projects     || [] ).map(d => Project.findOneAndUpdate(     { id: d.id }, d, { upsert: true, returnDocument: 'after', lean: true } )),
    ...( db.tracks       || [] ).map(d => Track.findOneAndUpdate(       { id: d.id }, d, { upsert: true, returnDocument: 'after', lean: true } )),
    ...( db.folders      || [] ).map(d => Folder.findOneAndUpdate(      { id: d.id }, d, { upsert: true, returnDocument: 'after', lean: true } )),
    ...( db.coverArts    || [] ).map(d => CoverArt.findOneAndUpdate(    { id: d.id }, d, { upsert: true, returnDocument: 'after', lean: true } )),
    ...( db.notifications|| [] ).map(d => Notification.findOneAndUpdate({ id: d.id }, d, { upsert: true, returnDocument: 'after', lean: true } )),
    ...( db.playEvents   || [] ).map(d => PlayEvent.findOneAndUpdate(   { id: d.id }, d, { upsert: true, returnDocument: 'after', lean: true } )),
    ...( db.messages     || [] ).map(d => Message.findOneAndUpdate(     { id: d.id }, d, { upsert: true, returnDocument: 'after', lean: true } )),
    ...( db.groups       || [] ).map(d => ChatGroup.findOneAndUpdate(   { id: d.id }, d, { upsert: true, returnDocument: 'after', lean: true } )),
    ...( db.calls        || [] ).map(d => Call.findOneAndUpdate(        { id: d.id }, d, { upsert: true, returnDocument: 'after', lean: true } )),
    ...( db.callSignals  || [] ).map(d => CallSignal.findOneAndUpdate(  { id: d.id }, d, { upsert: true, returnDocument: 'after', lean: true } )),
    ...( db.shareLinks   || [] ).map(d => ShareLink.findOneAndUpdate(   { id: d.id }, d, { upsert: true, returnDocument: 'after', lean: true } )),
    ...( db.stories      || [] ).map(d => Story.findOneAndUpdate(      { id: d.id }, d, { upsert: true, returnDocument: 'after', lean: true } )),
  ];
  await Promise.all(ops);
};

const ensureDBShape = (db) => {
  db.users         ||= [];
  db.folders       ||= [];
  db.projects      ||= [];
  db.tracks        ||= [];
  db.coverArts     ||= [];
  db.notifications ||= [];
  db.playEvents    ||= [];
  db.messages      ||= [];
  db.groups        ||= [];
  db.calls         ||= [];
  db.callSignals   ||= [];
  db.shareLinks    ||= [];
  db.stories       ||= [];
  return db;
};

module.exports = { readDB, writeDB, ensureDBShape };
