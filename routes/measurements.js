const express = require('express');
const Measurement = require('../models/Measurement');
const auth = require('../middlewares/auth');

const router = express.Router();

router.post('/', auth, async (req, res) => {
  try {
    const { value, location, timestamp } = req.body;
    if (value === undefined || !location) {
      return res.status(400).json({ error: 'value et location sont requis' });
    }

    const measurement = new Measurement({
      type: 'audio',
      value,
      location,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    });
    await measurement.save();
    res.status(201).json(measurement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
