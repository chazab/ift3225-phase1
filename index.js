require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const devicesRouter      = require('./routes/devices');
const measurementsRouter = require('./routes/measurements');
const observationsRouter = require('./routes/observations');
const ambianceRouter     = require('./routes/ambiance');

const app = express();
app.use(express.json());

app.use('/devices',      devicesRouter);
app.use('/measurements', measurementsRouter);
app.use('/observations', observationsRouter);
app.use('/ambiance',     ambianceRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

const PORT = process.env.PORT || 3000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connecté à MongoDB');
    app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
  })
  .catch(err => {
    console.error('Erreur de connexion MongoDB :', err.message);
    process.exit(1);
  });
