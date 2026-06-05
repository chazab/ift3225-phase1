const express = require('express');
const Observation = require('../models/Observation');
const auth = require('../middlewares/auth');

const router = express.Router();

router.post('/', auth, async (req, res) => {
  try {
    const { location, proximity, vibe, notes, timestamp } = req.body;
    if (!location || !proximity || !vibe) {
      return res.status(400).json({ error: 'location, proximity et vibe sont requis' });
    }

    const observation = new Observation({
      location,
      proximity,
      vibe,
      notes,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    });
    await observation.save();
    res.status(201).json(observation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
