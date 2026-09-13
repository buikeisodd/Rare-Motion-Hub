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
    if (!beat || !agreement || !title || !Number.isFinite(price) || price < 0 || !['lease', 'exclusive'].includes(licenseType)) {
      return res.status(400).json({ error: 'Title, price, license type, beat, and agreement certification are required.' });
    }
    const record = await MarketplaceBeat.create({ id: crypto.randomUUID(), sellerId: req.userId, title, price, licenseType, beatUrl: `/uploads/${beat.filename}`, agreementUrl: `/uploads/${agreement.filename}` });
    res.status(201).json({ beat: record });
  } catch (error) { next(error); }
};

const listBeats = async (req, res, next) => { try { res.json({ beats: await MarketplaceBeat.find().sort({ createdAt: -1 }).lean() }); } catch (error) { next(error); } };

module.exports = { createBeat, listBeats };
