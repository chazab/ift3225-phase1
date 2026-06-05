---
Équipe :
- Chaza Boukhira — 20276819
- Coéquipier #2 — À compléter

Cours : IFT3225 — Technologies Web
Remise : Phase 1 — Infrastructure de collecte
Date : 15 juin 2026
---

# 1. Ressources et endpoints

L'architecture REST du système repose sur quatre ressources distinctes, chacune correspondant à une entité sémantiquement cohérente du domaine.

| Méthode | Chemin | Corps attendu | Réponse | Statut |
|---|---|---|---|---|
| POST | `/devices` | `{ name, location }` | Objet device avec `apiKey` généré | 201 |
| GET | `/devices` | — | Tableau de devices | 200 |
| POST | `/measurements` | `{ value, location, timestamp }` | Objet measurement créé | 201 |
| POST | `/observations` | `{ location, proximity, vibe, notes, timestamp }` | Objet observation créé | 201 |
| GET | `/ambiance/:location/current` | — | `{ averageDb, measurementCount, lastObservation }` | 200 |
| GET | `/ambiance/:location/quiet-hours` | — | `{ quietHours, allHours, threshold }` | 200 |
| GET | `/ambiance/:location/history` | Query `?last=3h` | `{ slots, since, slotDuration }` | 200 |

La séparation en quatre ressources répond à un principe de cohésion forte : `devices` représente les capteurs physiques et leur cycle de vie ; `measurements` encapsule des données quantitatives brutes émises automatiquement ; `observations` capture des données qualitatives saisies manuellement par un humain. Ces deux types de données ont des producteurs, des rythmes et des structures radicalement différents — les fusionner aurait introduit une ambiguïté dans le schéma et compliqué les requêtes d'agrégation.

La ressource `ambiance` occupe une place particulière : elle ne correspond à aucune collection MongoDB. Il s'agit d'une vue dérivée, calculée à la volée à partir des measurements et des observations existants. La stocker serait redondant et introduirait un risque de désynchronisation entre les données brutes et les agrégats. En la maintenant comme endpoint de lecture pure, on garantit que chaque réponse reflète l'état exact de la base au moment de la requête, sans état intermédiaire à gérer.

---

# 2. Conventions

Plusieurs conventions ont été adoptées de manière délibérée pour assurer la cohérence et l'interopérabilité de l'API.

Les chemins de ressources utilisent le **kebab-case au pluriel** (`/measurements`, `/quiet-hours`). Le pluriel est la convention REST la plus répandue pour désigner des collections, et le kebab-case évite toute ambiguïté entre les conventions de casse selon les systèmes (contrairement au camelCase ou au snake_case qui sont interprétés différemment selon les langages). Ce choix facilite l'intégration avec des clients variés.

Les **timestamps** suivent le format ISO 8601 (`2026-06-04T14:30:00Z`). Chaque mesure porte deux horodatages distincts : `timestamp`, qui correspond au moment de la capture par le capteur, et `receivedAt`, qui enregistre l'instant d'arrivée sur le serveur. Cette distinction est essentielle dans un contexte de collecte en temps réel : si le bridge ou le réseau subit une interruption et que des mesures sont envoyées en lot différé, `timestamp` préserve la vérité temporelle de la mesure tandis que `receivedAt` documente la latence réelle du pipeline.

La **structure des erreurs** suit le format minimaliste `{ "error": "message" }`. Ce choix de simplicité est volontaire : il garantit qu'un client peut toujours lire l'erreur avec `response.error`, sans avoir à naviguer dans une hiérarchie de champs. Pour une API académique mono-équipe, l'overhead d'un format RFC 7807 (`type`, `title`, `detail`) n'apporterait pas de bénéfice proportionnel à sa complexité.

Les **réponses de création** retournent l'objet complet tel que persité en base, y compris `_id` et `receivedAt`. Les endpoints de liste retournent un tableau nu, sans enveloppe `{ data: [...] }`. Ce choix pragmatique simplifie la consommation côté client, étant donné que la pagination n'est pas encore implémentée et que le contexte ne requiert pas de métadonnées au niveau de l'enveloppe.

---

# 3. Authentification

Le mécanisme d'authentification retenu est une **clé API transmise via le header HTTP `x-api-key`**. Ce choix privilégie la simplicité d'intégration côté capteur : un microcontrôleur ou un script de bridge n'a besoin que d'inclure un header statique dans chaque requête, sans gérer de sessions, de tokens expirables ou de flux OAuth.

Le flux complet d'enregistrement d'un capteur est le suivant : l'opérateur appelle `POST /devices` avec le nom et le lieu du capteur ; le serveur génère automatiquement un `apiKey` sous forme d'UUID v4 et le retourne dans la réponse. Cet `apiKey` est ensuite configuré dans le fichier `.env` du bridge (`API_KEY=...`) et injecté dans chaque requête `POST /measurements` et `POST /observations` via le header `x-api-key`. Le middleware `auth.js` vérifie la présence et la validité de cette clé à chaque appel protégé.

Le comportement d'erreur distingue deux cas : une réponse `401 Unauthorized` est retournée lorsque le header `x-api-key` est complètement absent de la requête — le client n'a pas tenté de s'authentifier. Une réponse `403 Forbidden` est retournée lorsque le header est présent mais que la clé ne correspond à aucun device en base — le client s'est authentifié avec une identité inconnue ou révoquée. Cette distinction sémantique est conforme aux conventions HTTP et aide à diagnostiquer rapidement l'origine du problème.

Une **vulnérabilité identifiée** : l'endpoint `POST /devices` est actuellement accessible sans authentification, ce qui signifie que n'importe qui peut créer un device et obtenir une clé API valide. Dans un contexte de production, deux approches permettraient de corriger ce point : la protection par un token d'administration statique (défini dans les variables d'environnement du serveur), ou un système d'invitation par email qui génère un lien à usage unique pour enregistrer un device. Cette lacune est reconnue comme une limite volontaire dans le cadre du cours.

---

# 4. Collecte

Le pipeline de collecte de données suit une architecture linéaire en trois étapes : **Phyphox → bridge.js → POST /measurements**.

L'application Phyphox, installée sur un téléphone placé dans la bibliothèque, expose une API HTTP locale accessible sur le réseau Wi-Fi de l'établissement. L'expérience "Acoustics" mesure l'amplitude sonore en décibels et la rend disponible via l'endpoint `GET /get?amp`. Le script `bridge.js` interroge cet endpoint toutes les **5 secondes** via un `setInterval`, extrait la valeur du champ `buffer.amp.buffer`, puis la transmet au serveur Express local via `POST /measurements` avec un timestamp ISO 8601 et le header `x-api-key` correspondant au device configuré.

Ce choix de collecte en **temps réel** plutôt qu'en batch différé est justifié par la nature des données : l'ambiance sonore est un phénomène volatile qui peut varier significativement en quelques minutes. Un envoi toutes les 5 secondes permet de capturer ces variations avec une granularité suffisante pour les agrégats de 30 minutes. Un envoi en batch horaire, par exemple, ferait perdre toute information sur les pics ponctuels de bruit.

Les **données environnementales** (affluence, vibe, notes textuelles) sont collectées via `POST /observations`, à saisie manuelle. Ce mécanisme constitue un complément naturel aux mesures automatiques : là où les décibels décrivent l'intensité sonore, les observations qualifient le contexte social — une salle bondée en silence studieux n'a pas le même profil qu'une salle vide avec de la musique. Le lieu de collecte est la **Bibliothèque de l'Université de Montréal**, identifiée par la chaîne `"bib-udem"` dans tous les documents.

---

# 5. Agrégation

Les trois endpoints sémantiques de la ressource `ambiance` offrent des vues complémentaires sur les données collectées, à différentes échelles temporelles.

L'endpoint `/ambiance/:location/current` calcule la **moyenne des décibels sur une fenêtre glissante de 30 minutes** à partir de l'instant de la requête. Il retourne également la dernière observation qualitative reçue dans ce même intervalle. Cette fenêtre de 30 minutes a été choisie comme compromis entre réactivité et représentativité : une fenêtre trop courte (5 minutes) serait trop sensible aux pics ponctuels, tandis qu'une fenêtre d'une heure lissierait des variations significatives.

L'endpoint `/ambiance/:location/quiet-hours` regroupe les mesures par **heure de la journée** via une agrégation MongoDB (`$group` sur `$hour`), calculant la moyenne de chaque tranche horaire sur les dernières 24 heures. Les heures dont la moyenne est inférieure à **45 dB** sont marquées comme `isQuiet: true`. Ce seuil de 45 dB correspond au niveau sonore généralement recommandé pour les espaces de travail calmes et les bibliothèques universitaires, en accord avec les normes acoustiques de confort cognitif.

L'endpoint `/ambiance/:location/history` découpe la période demandée (paramètre `?last=Xh` ou `?last=Xm`) en **slots de 30 minutes**, calculant pour chacun la moyenne, le minimum et le maximum des décibels enregistrés. Ce découpage permet de visualiser l'évolution temporelle de l'ambiance sans surcharger le client avec chaque mesure individuelle. La logique de troncature au slot de 30 minutes est réalisée directement dans le pipeline d'agrégation MongoDB via `$mod` sur le timestamp en millisecondes.

---

# 6. Limites et évolutions

Ce premier prototype atteint les objectifs de la phase 1, mais plusieurs limites méritent d'être soulignées honnêtement.

La **vulnérabilité la plus évidente** reste l'absence de protection sur `POST /devices` : un acteur malveillant pourrait polluer la base en créant des milliers de devices fictifs, ou obtenir des clés API valides pour injecter de fausses mesures. Cette limite est reconnue dans le cadre du cours comme une simplification volontaire, mais elle serait inacceptable en production.

L'endpoint `GET /devices` **ne propose pas de pagination**. Pour une bibliothèque avec un nombre modeste de capteurs, ce n'est pas problématique ; à plus grande échelle, une réponse non paginée pourrait saturer la bande passante et le client.

Les **observations qualitatives sont saisies manuellement**, ce qui introduit une subjectivité inhérente et une discontinuité dans la collecte : personne ne saisit d'observations à 3h du matin. Ce canal de données reste donc fragmentaire et dépendant de la présence humaine.

Avec davantage de temps, plusieurs évolutions seraient envisagées. L'introduction de **WebSockets** permettrait de diffuser les mesures en temps réel vers un tableau de bord sans polling. Un système d'**authentification JWT** remplacerait les clés API statiques par des tokens expirables, réduisant les risques en cas de fuite. Enfin, la gestion de **plusieurs lieux** simultanés (plusieurs bibliothèques, différentes salles) nécessiterait une modélisation plus fine de la ressource `location`, actuellement traitée comme une simple chaîne de caractères.

Durant le développement, un **mock Phyphox** (`phyphox-mock.js`) a été utilisé pour simuler les données du capteur sans nécessiter de déplacement physique à la bibliothèque. Ce mock reproduit les profils horaires réalistes (calme le matin, animé le midi, modéré le soir) et a permis de valider l'ensemble du pipeline de bout en bout dans un environnement local contrôlé.
