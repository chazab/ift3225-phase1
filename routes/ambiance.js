const express = require('express');
const Measurement = require('../models/Measurement');
const Observation = require('../models/Observation');

const router = express.Router();

// GET /ambiance/:location/current
// Moyenne audio + dernière observation des 30 dernières minutes
router.get('/:location/current', async (req, res) => {
  try {
    const { location } = req.params;
    const since = new Date(Date.now() - 30 * 60 * 1000);

    const measurements = await Measurement.find({
      location,
      timestamp: { $gte: since }
    });

    const avgDb = measurements.length
      ? measurements.reduce((sum, m) => sum + m.value, 0) / measurements.length
      : null;

    const lastObservation = await Observation.findOne({
      location,
      timestamp: { $gte: since }
    }).sort({ timestamp: -1 });

    res.json({
      location,
      window: '30min',
      measurementCount: measurements.length,
      averageDb: avgDb !== null ? Math.round(avgDb * 10) / 10 : null,
      lastObservation: lastObservation || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /ambiance/:location/quiet-hours
// Créneaux calmes (moyenne < 45 dB) par heure de la journée
router.get('/:location/quiet-hours', async (req, res) => {
  try {
    const { location } = req.params;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await Measurement.aggregate([
      {
        $match: {
          location,
          timestamp: { $gte: since }
        }
      },
      {
        $group: {
          _id: { $hour: '$timestamp' },
          avgDb: { $avg: '$value' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const hourlyStats = result.map(h => ({
      hour: h._id,
      averageDb: Math.round(h.avgDb * 10) / 10,
      measurementCount: h.count,
      isQuiet: h.avgDb < 45
    }));

    const quietHours = hourlyStats.filter(h => h.isQuiet);

    res.json({
      location,
      threshold: 45,
      quietHours,
      allHours: hourlyStats
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /ambiance/:location/history?last=3h
// Évolution par tranches de 30 minutes
router.get('/:location/history', async (req, res) => {
  try {
    const { location } = req.params;
    const lastParam = req.query.last || '3h';

    const match = lastParam.match(/^(\d+)(h|m)$/);
    if (!match) {
      return res.status(400).json({ error: 'Paramètre last invalide. Format attendu : ex. 3h, 90m' });
    }

    const amount = parseInt(match[1]);
    const unit = match[2];
    const durationMs = unit === 'h' ? amount * 60 * 60 * 1000 : amount * 60 * 1000;
    const since = new Date(Date.now() - durationMs);

    const result = await Measurement.aggregate([
      {
        $match: {
          location,
          timestamp: { $gte: since }
        }
      },
      {
        $group: {
          _id: {
            // Tronque au slot de 30 minutes
            slot: {
              $subtract: [
                { $toLong: '$timestamp' },
                {
                  $mod: [
                    { $toLong: '$timestamp' },
                    30 * 60 * 1000
                  ]
                }
              ]
            }
          },
          avgDb: { $avg: '$value' },
          minDb: { $min: '$value' },
          maxDb: { $max: '$value' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.slot': 1 } }
    ]);

    const slots = result.map(s => ({
      slotStart: new Date(s._id.slot),
      averageDb: Math.round(s.avgDb * 10) / 10,
      minDb: s.minDb,
      maxDb: s.maxDb,
      measurementCount: s.count
    }));

    res.json({
      location,
      since,
      slotDuration: '30min',
      slots
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
