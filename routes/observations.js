const express = require('express');
const Observation = require('../models/Observation');
const auth = require('../middlewares/auth');
const { isNonEmptyString, parseTimestamp } = require('../utils/validation');

const router = express.Router();

router.post('/', auth, async (req, res) => {
  try {
    const { location, proximity, vibe, notes, timestamp } = req.body || {};

    // Validate explicit types before Mongoose can cast invalid request values.
    if (!isNonEmptyString(location)) {
      return res.status(400).json({ error: 'location doit être une chaîne non vide' });
    }

    if (!isNonEmptyString(proximity)) {
      return res.status(400).json({ error: 'proximity doit être une chaîne non vide' });
    }

    if (!isNonEmptyString(vibe)) {
      return res.status(400).json({ error: 'vibe doit être une chaîne non vide' });
    }

    if (notes !== undefined && typeof notes !== 'string') {
      return res.status(400).json({ error: 'notes doit être une chaîne de caractères' });
    }

    const parsedTimestamp = parseTimestamp(timestamp);
    if (!parsedTimestamp.ok) {
      return res.status(400).json({ error: 'timestamp doit être une date ISO 8601 valide' });
    }

    const observation = new Observation({
      location: location.trim(),
      proximity: proximity.trim(),
      vibe: vibe.trim(),
      notes: notes === undefined ? undefined : notes.trim(),
      timestamp: parsedTimestamp.date
    });
    await observation.save();
    res.status(201).json(observation);
  } catch (err) {
    if (err.name === 'ValidationError' || err.name === 'CastError') {
      return res.status(400).json({ error: err.message });
    }

    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
