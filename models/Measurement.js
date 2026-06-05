const mongoose = require('mongoose');

const measurementSchema = new mongoose.Schema({
  type: { type: String, default: 'audio', enum: ['audio'] },
  value: { type: Number, required: true },
  location: { type: String, required: true },
  timestamp: { type: Date, required: true },
  receivedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Measurement', measurementSchema);
