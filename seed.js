require('dotenv').config();
const mongoose = require('mongoose');
const Device = require('./models/Device');
const Measurement = require('./models/Measurement');
const Observation = require('./models/Observation');

const LOCATION = 'bib-udem';

const DEVICES = [
  { name: 'Capteur Nord', location: LOCATION, apiKey: 'seed-api-key-001' },
  { name: 'Capteur Sud',  location: LOCATION, apiKey: 'seed-api-key-002' }
];

function randomBetween(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

function hoursAgo(h) {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connecté à MongoDB');

  await Device.deleteMany({ location: LOCATION });
  await Measurement.deleteMany({ location: LOCATION });
  await Observation.deleteMany({ location: LOCATION });
  console.log('Collections vidées');

  await Device.insertMany(DEVICES);
  console.log('2 devices créés');

  const measurements = Array.from({ length: 20 }, (_, i) => ({
    type: 'audio',
    value: randomBetween(35, 75),
    location: LOCATION,
    timestamp: hoursAgo(24 - i * 1.2),
    receivedAt: new Date()
  }));
  await Measurement.insertMany(measurements);
  console.log('20 measurements insérés');

  const observations = [
    { location: LOCATION, proximity: 'proche', vibe: 'calme',   notes: 'Peu de monde, silence respecté',      timestamp: hoursAgo(22) },
    { location: LOCATION, proximity: 'loin',   vibe: 'animé',   notes: 'Groupes de travail bruyants',          timestamp: hoursAgo(16) },
    { location: LOCATION, proximity: 'proche', vibe: 'studieux', notes: 'Étudiants concentrés, ambiance zen',  timestamp: hoursAgo(10) },
    { location: LOCATION, proximity: 'loin',   vibe: 'calme',   notes: 'Fin de journée, peu d\'occupants',    timestamp: hoursAgo(4)  },
    { location: LOCATION, proximity: 'proche', vibe: 'animé',   notes: 'Période d\'examens, salle comble',    timestamp: hoursAgo(0.5) }
  ];
  await Observation.insertMany(observations.map(o => ({ ...o, receivedAt: new Date() })));
  console.log('5 observations insérées');

  await mongoose.disconnect();
  console.log('Seed terminé.');
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
