const mongoose = require('mongoose');

const observationSchema = new mongoose.Schema({
  location: { type: String, required: true },
  proximity: { type: String, required: true },
  vibe: { type: String, required: true },
  notes: { type: String },
  timestamp: { type: Date, required: true },
  receivedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Observation', observationSchema);
