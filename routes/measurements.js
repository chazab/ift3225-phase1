const express = require('express');
const Measurement = require('../models/Measurement');
const auth = require('../middlewares/auth');
const { isNonEmptyString, parseTimestamp } = require('../utils/validation');

const router = express.Router();

router.post('/', auth, async (req, res) => {
  try {
    const { type = 'audio', value, location, timestamp } = req.body || {};

    // Validate explicit types before Mongoose can cast invalid request values.
    if (type !== 'audio') {
      return res.status(400).json({ error: 'type doit être audio' });
    }

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return res.status(400).json({ error: 'value doit être un nombre valide' });
    }

    if (!isNonEmptyString(location)) {
      return res.status(400).json({ error: 'location doit être une chaîne non vide' });
    }

    const parsedTimestamp = parseTimestamp(timestamp);
    if (!parsedTimestamp.ok) {
      return res.status(400).json({ error: 'timestamp doit être une date ISO 8601 valide' });
    }

    const measurement = new Measurement({
      type,
      value,
      location: location.trim(),
      timestamp: parsedTimestamp.date
    });
    await measurement.save();
    res.status(201).json(measurement);
  } catch (err) {
    if (err.name === 'ValidationError' || err.name === 'CastError') {
      return res.status(400).json({ error: err.message });
    }

    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
