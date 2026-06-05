require('dotenv').config();

const PHYPHOX_URL = process.env.PHYPHOX_URL;
const API_KEY     = process.env.API_KEY;
const LOCATION    = process.env.LOCATION || 'bib-udem';
const SERVER_URL  = `http://localhost:${process.env.PORT || 3000}/measurements`;
const INTERVAL_MS = 5000;

if (!PHYPHOX_URL) {
  console.error('[bridge] PHYPHOX_URL manquant dans .env — arrêt.');
  process.exit(1);
}
if (!API_KEY) {
  console.error('[bridge] API_KEY manquant dans .env — arrêt.');
  process.exit(1);
}

async function fetchAmplitude() {
  const url = `${PHYPHOX_URL}/get?amp`;
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`Phyphox HTTP ${res.status}`);
  const json = await res.json();

  // Phyphox renvoie { buffer: { amp: { buffer: [val], ...} } }
  const buffer = json?.buffer?.amp?.buffer;
  if (!Array.isArray(buffer) || buffer.length === 0) {
    throw new Error('Réponse Phyphox inattendue : ' + JSON.stringify(json));
  }
  return buffer[buffer.length - 1];
}

async function postMeasurement(value) {
  const timestamp = new Date().toISOString();
  const res = await fetch(SERVER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    },
    body: JSON.stringify({ value, location: LOCATION, timestamp }),
    signal: AbortSignal.timeout(4000)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Serveur HTTP ${res.status} : ${body}`);
  }
  return timestamp;
}

async function tick() {
  try {
    const value = await fetchAmplitude();
    const timestamp = await postMeasurement(value);
    console.log(`[${timestamp}] ${LOCATION} → ${value} dB  ✓`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ERREUR : ${err.message}`);
  }
}

console.log(`[bridge] Démarré — Phyphox: ${PHYPHOX_URL} | Serveur: ${SERVER_URL} | Intervalle: ${INTERVAL_MS / 1000}s`);
tick();
setInterval(tick, INTERVAL_MS);
