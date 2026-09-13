const crypto = require('crypto');
const fs = require('fs/promises');
const { MarketplaceBeat } = require('../models');

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
    if (!beat || !agreement || !title || !genre || !key || !Number.isFinite(price) || price < 0 || !Number.isFinite(bpm) || bpm < 1 || bpm > 400 || !['lease', 'exclusive'].includes(licenseType)) {
      return res.status(400).json({ error: 'Title, price, license, genre, BPM, key, beat, and agreement certification are required.' });
    }
    const record = await MarketplaceBeat.create({ id: crypto.randomUUID(), sellerId: req.userId, title, price, licenseType, genre, bpm, key, beatUrl: `/uploads/${beat.filename}`, agreementUrl: `/uploads/${agreement.filename}` });
    res.status(201).json({ beat: record });
  } catch (error) { next(error); }
};

const listBeats = async (req, res, next) => { try { res.json({ beats: await MarketplaceBeat.find().sort({ createdAt: -1 }).lean() }); } catch (error) { next(error); } };

module.exports = { createBeat, listBeats };
