# Équipe
| Nom | Matricule |
|-----|-----------|
| Chaza Boukhira | 20276819 |
| Ruotian Tang | À 20090403 |

---

# IFT3225 — Phase 1 : Infrastructure de collecte

## Description

Système de collecte de données d'ambiance pour la **Bibliothèque UdeM** (`bib-udem`).  
Pipeline complet : **Phyphox → bridge.js → serveur Express → MongoDB Atlas**.

- Les capteurs (téléphones avec Phyphox) envoient des mesures audio en dB toutes les 5 secondes via `bridge.js`
- Le serveur Express expose des endpoints REST pour collecter et interroger les données
- MongoDB Atlas stocke les mesures, observations et devices

---

## Prérequis

- Node.js 18+
- Compte MongoDB Atlas (cluster M0 gratuit suffisant)
- Application [Phyphox](https://phyphox.org/) sur téléphone — expérience **"Acoustics"**

---

## Installation

```sh
# 1. Cloner le dépôt
git clone https://github.com/chazab/ift3225-phase1.git
cd ift3225-phase1

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement
cp .env.example .env
# → éditer .env avec les vraies valeurs (voir section ci-dessous)

# 4. Peupler la base de données
npm run seed

# 5. Lancer le serveur
npm start
```

---

## Variables d'environnement (.env)

| Variable | Obligatoire | Description | Exemple |
|---|---|---|---|
| `MONGODB_URI` | Oui | URI de connexion MongoDB Atlas | `mongodb+srv://user:pass@cluster.mongodb.net/ift3225` |
| `PORT` | Non | Port du serveur Express (défaut : 3000) | `3000` |
| `PHYPHOX_URL` | Pour bridge | URL HTTP du téléphone Phyphox | `http://192.168.1.42` |
| `API_KEY` | Pour bridge | Clé API utilisée par le bridge pour s'authentifier | `seed-api-key-001` |
| `LOCATION` | Non | Identifiant du lieu (défaut : `bib-udem`) | `bib-udem` |

---

## Table des endpoints

| Méthode | Endpoint | Auth (`x-api-key`) | Description |
|---|---|---|---|
| `POST` | `/devices` | Non | Crée un nouveau device (génère un `apiKey` uuid) |
| `GET` | `/devices` | Non | Liste tous les devices enregistrés |
| `POST` | `/measurements` | **Oui** | Enregistre une mesure audio (dB) |
| `POST` | `/observations` | **Oui** | Enregistre une observation qualitative |
| `GET` | `/ambiance/:location/current` | Non | Moyenne audio + dernière observation des 30 dernières minutes |
| `GET` | `/ambiance/:location/quiet-hours` | Non | Créneaux calmes (moyenne < 45 dB) par heure sur 24h |
| `GET` | `/ambiance/:location/history` | Non | Évolution par tranches de 30 min (`?last=3h` ou `?last=90m`) |

### Exemples de réponses

**POST /devices**
```json
{
  "_id": "664a1b2c...",
  "name": "Capteur Nord",
  "location": "bib-udem",
  "apiKey": "bfe3b9d6-ec5d-4bf0-aba1-960c637096b5",
  "createdAt": "2026-06-04T14:00:00.000Z"
}
```

**GET /ambiance/bib-udem/current**
```json
{
  "location": "bib-udem",
  "window": "30min",
  "measurementCount": 6,
  "averageDb": 52.3,
  "lastObservation": {
    "vibe": "studieux",
    "proximity": "proche",
    "notes": "Étudiants concentrés"
  }
}
```

**GET /ambiance/bib-udem/quiet-hours**
```json
{
  "location": "bib-udem",
  "threshold": 45,
  "quietHours": [
    { "hour": 10, "averageDb": 42.9, "measurementCount": 3, "isQuiet": true }
  ],
  "allHours": [...]
}
```

**GET /ambiance/bib-udem/history?last=3h**
```json
{
  "location": "bib-udem",
  "since": "2026-06-04T11:00:00.000Z",
  "slotDuration": "30min",
  "slots": [
    { "slotStart": "2026-06-04T11:00:00.000Z", "averageDb": 48.1, "minDb": 38.0, "maxDb": 61.5, "measurementCount": 4 }
  ]
}
```

---

## Lancer le bridge Phyphox

Le bridge interroge Phyphox toutes les 5 secondes et envoie les mesures au serveur local.

**Étape 1 — Configurer Phyphox :**
1. Ouvrir l'application Phyphox sur ton téléphone
2. Choisir l'expérience **"Acoustics"** → **"dB(A)"** ou **"Amplitude"**
3. Menu (⋮) → **"Allow remote access"**
4. Noter l'IP affichée (ex: `http://192.168.1.42`)

**Étape 2 — Mettre à jour `.env` :**
```env
PHYPHOX_URL=http://192.168.1.42
API_KEY=seed-api-key-001
LOCATION=bib-udem
```

**Étape 3 — Lancer (dans un terminal séparé du serveur) :**
```sh
npm run bridge
```

**Output attendu :**
```
[bridge] Démarré — Phyphox: http://192.168.1.42 | Serveur: http://localhost:3000/measurements | Intervalle: 5s
[2026-06-04T14:32:05.000Z] bib-udem → 52.3 dB  ✓
[2026-06-04T14:32:10.000Z] bib-udem → 48.7 dB  ✓
```

> Le bridge gère les erreurs sans crasher : si Phyphox ou le serveur est inaccessible, l'erreur est affichée et la prochaine tentative a lieu 5s plus tard.

---

## Tests avec curl

### Devices

```sh
# Créer un device
curl -s -X POST http://localhost:3000/devices \
  -H "Content-Type: application/json" \
  -d '{"name": "Capteur Test", "location": "bib-udem"}' | jq

# Lister tous les devices
curl -s http://localhost:3000/devices | jq
```

### Measurements

```sh
# Insérer une mesure (clé du seed)
curl -s -X POST http://localhost:3000/measurements \
  -H "x-api-key: seed-api-key-001" \
  -H "Content-Type: application/json" \
  -d '{"value": 58.5, "location": "bib-udem", "timestamp": "2026-06-04T14:30:00Z"}' | jq

# Sans clé → 401
curl -s -X POST http://localhost:3000/measurements \
  -H "Content-Type: application/json" \
  -d '{"value": 50, "location": "bib-udem"}' | jq

# Clé invalide → 403
curl -s -X POST http://localhost:3000/measurements \
  -H "x-api-key: fausse-cle" \
  -H "Content-Type: application/json" \
  -d '{"value": 50, "location": "bib-udem"}' | jq
```

### Observations

```sh
curl -s -X POST http://localhost:3000/observations \
  -H "x-api-key: seed-api-key-001" \
  -H "Content-Type: application/json" \
  -d '{
    "location": "bib-udem",
    "proximity": "proche",
    "vibe": "studieux",
    "notes": "Très calme ce matin",
    "timestamp": "2026-06-04T09:00:00Z"
  }' | jq
```

### Ambiance (endpoints sémantiques)

```sh
# Ambiance actuelle (30 dernières minutes)
curl -s http://localhost:3000/ambiance/bib-udem/current | jq

# Créneaux calmes sur 24h
curl -s http://localhost:3000/ambiance/bib-udem/quiet-hours | jq

# Historique par slots de 30 min — 3 dernières heures
curl -s "http://localhost:3000/ambiance/bib-udem/history?last=3h" | jq

# Historique sur 24h
curl -s "http://localhost:3000/ambiance/bib-udem/history?last=24h" | jq

# Historique sur 90 minutes
curl -s "http://localhost:3000/ambiance/bib-udem/history?last=90m" | jq
```

---

## Fichier .env.example

```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/ift3225?retryWrites=true&w=majority
PORT=3000
PHYPHOX_URL=http://192.168.x.x
API_KEY=seed-api-key-001
LOCATION=bib-udem
```

---

## Structure du projet

```
ift3225-phase1/
├── index.js              # Point d'entrée : connexion Mongoose + montage des routes
├── bridge.js             # Polling Phyphox → POST /measurements toutes les 5s
├── seed.js               # Peuple la base avec 2 devices, 20 mesures, 5 observations
├── package.json          # Dépendances et scripts npm
├── .env                  # Variables d'environnement (ignoré par git)
├── .env.example          # Modèle de configuration à copier
├── .gitignore            # Exclut node_modules/ et .env
│
├── models/
│   ├── Device.js         # Schéma : name, location, apiKey, createdAt
│   ├── Measurement.js    # Schéma : type, value (dB), location, timestamp, receivedAt
│   └── Observation.js    # Schéma : location, proximity, vibe, notes, timestamp, receivedAt
│
├── routes/
│   ├── devices.js        # POST /devices, GET /devices
│   ├── measurements.js   # POST /measurements (protégé x-api-key)
│   ├── observations.js   # POST /observations (protégé x-api-key)
│   └── ambiance.js       # GET /ambiance/:location/current|quiet-hours|history
│
└── middlewares/
    └── auth.js           # Vérifie x-api-key → 401 absent, 403 invalide
```
