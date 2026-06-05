const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Device = require('../models/Device');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { name, location } = req.body;
    if (!name || !location) {
      return res.status(400).json({ error: 'name et location sont requis' });
    }

    const device = new Device({ name, location, apiKey: uuidv4() });
    await device.save();
    res.status(201).json(device);
  } catch (err) {
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
