const http = require('http');

const PORT = 8080;

const PROFILES = [
  { start:  0, end:  7, min: 35, max: 45, label: 'nuit'        },
  { start:  8, end: 10, min: 35, max: 45, label: 'matin calme' },
  { start: 11, end: 14, min: 55, max: 70, label: 'midi animé'  },
  { start: 15, end: 18, min: 45, max: 55, label: 'après-midi'  },
  { start: 19, end: 22, min: 40, max: 50, label: 'soir'        },
  { start: 23, end: 23, min: 35, max: 45, label: 'fermeture'   },
];

function getProfile() {
  const hour = new Date().getHours();
  return PROFILES.find(p => hour >= p.start && hour <= p.end) || PROFILES[0];
}

function randomDb(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/get' && url.searchParams.has('amp')) {
    const profile = getProfile();
    const value = randomDb(profile.min, profile.max);

    console.log(`[${new Date().toISOString()}] ${profile.label.padEnd(13)} → ${value} dB`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      buffer: {
        amp: {
          buffer: [value]
        }
      }
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`[phyphox-mock] Serveur démarré sur http://localhost:${PORT}`);
  console.log(`[phyphox-mock] Profils horaires :`);
  PROFILES.forEach(p =>
    console.log(`  ${String(p.start).padStart(2)}h–${String(p.end).padStart(2)}h  ${p.label.padEnd(13)}  ${p.min}–${p.max} dB`)
  );
});
