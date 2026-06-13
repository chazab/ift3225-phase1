const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Device = require('../models/Device');
const { isNonEmptyString } = require('../utils/validation');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { name, location } = req.body || {};

    // Validate before saving so malformed client input returns 400 instead of 500.
    if (!isNonEmptyString(name)) {
      return res.status(400).json({ error: 'name doit être une chaîne non vide' });
    }

    if (!isNonEmptyString(location)) {
      return res.status(400).json({ error: 'location doit être une chaîne non vide' });
    }

    const device = new Device({
      name: name.trim(),
      location: location.trim(),
      apiKey: uuidv4()
    });
    await device.save();
    res.status(201).json(device);
  } catch (err) {
    if (err.name === 'ValidationError' || err.name === 'CastError') {
      return res.status(400).json({ error: err.message });
    }

    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const devices = await Device.find().sort({ createdAt: -1 });
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
