const crypto = require('crypto');
const fs = require('fs/promises');
const { MarketplaceBeat } = require('../models');
const { cloudinary, hasCloudinaryConfig, cloudName } = require('../config/cloudinary');
const { AppError } = require('../middlewares/error.middleware');

const getUploadSignature = (req, res, next) => {
  try {
    if (!hasCloudinaryConfig) return next(new AppError('Cloudinary storage is not configured.', 503));
    const kind = req.query.kind === 'agreement' ? 'agreement' : 'beat';
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `raremotionhub/marketplace/${kind}`;
    const resourceType = kind === 'agreement' ? 'raw' : 'video';
    const signature = cloudinary.utils.api_sign_request({ folder, timestamp }, process.env.CLOUDINARY_API_SECRET);
    res.json({ timestamp, folder, signature, apiKey: process.env.CLOUDINARY_API_KEY, cloudName, resourceType });
  } catch (error) { next(error); }
};

const finalizeCloudinaryBeat = async (req, res, next) => {
  try {
    const { title, price, licenseType, genre, bpm, key, beat, agreement } = req.body || {};
    if (!beat?.secureUrl || !beat.publicId || !agreement?.secureUrl || !agreement.publicId) return next(new AppError('Cloudinary upload metadata is incomplete.', 400));
    const record = await MarketplaceBeat.create({ id: crypto.randomUUID(), sellerId: req.userId, title: String(title || '').trim(), price: Number(price), licenseType, genre, bpm: Number(bpm), key: String(key || '').trim(), beatUrl: beat.secureUrl, agreementUrl: agreement.secureUrl, beatPublicId: beat.publicId, agreementPublicId: agreement.publicId });
    res.status(201).json({ beat: record });
  } catch (error) { next(error); }
};

const createBeat = async (req, res, next) => {
  try {
    const beat = req.files?.beat?.[0];
    const agreement = req.files?.agreement?.[0];
    const title = String(req.body.title || '').trim();
    const price = Number(req.body.price);
    const licenseType = req.body.licenseType;
    const genre = String(req.body.genre || '').trim();
    const bpm = Number(req.body.bpm);
    const key = String(req.body.key || '').trim();
    if (!beat || !agreement || !title || !genre || !key || !Number.isFinite(price) || price < 25000 || !Number.isFinite(bpm) || bpm < 1 || bpm > 400 || !['lease', 'exclusive'].includes(licenseType)) {
      return res.status(400).json({ error: 'Title, price, license, genre, BPM, key, beat, and agreement certification are required.' });
    }
    const record = await MarketplaceBeat.create({ id: crypto.randomUUID(), sellerId: req.userId, title, price, licenseType, genre, bpm, key, beatUrl: `/uploads/${beat.filename}`, agreementUrl: `/uploads/${agreement.filename}` });
    res.status(201).json({ beat: record });
  } catch (error) { next(error); }
};

const listBeats = async (req, res, next) => { try { res.json({ beats: await MarketplaceBeat.find().sort({ createdAt: -1 }).lean() }); } catch (error) { next(error); } };

const deleteBeat = async (req, res, next) => {
  try {
      const beat = await MarketplaceBeat.findOne({ id: req.params.id });
      if (!beat) return next(new AppError('Marketplace beat not found.', 404));
      if (String(beat.sellerId) !== String(req.userId)) return next(new AppError('You can only delete your own marketplace listings.', 403));
    if (hasCloudinaryConfig) {
      if (beat.beatPublicId) await cloudinary.uploader.destroy(beat.beatPublicId, { resource_type: 'video' }).catch(() => {});
      if (beat.agreementPublicId) await cloudinary.uploader.destroy(beat.agreementPublicId, { resource_type: 'raw' }).catch(() => {});
    }
    await MarketplaceBeat.deleteOne({ id: beat.id });
    res.json({ deleted: true, id: beat.id });
  } catch (error) { next(error); }
};

module.exports = { createBeat, listBeats, deleteBeat, getUploadSignature, finalizeCloudinaryBeat };

