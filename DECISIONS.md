# DECISIONS.md — journal des décisions techniques

> Chaque décision non triviale, datée, en 1-2 lignes.

## 2026-06-08 — Phase 0 (Bootstrap)
- **Stack conforme au prompt** : Tauri 2 + React + TS + Vite + MapLibre GL JS,
  gestionnaire `pnpm`, toolchain Rust MSVC. Aucun écart de stack.
- **Toolchain Windows** : Rust installé via rustup (`stable-x86_64-pc-windows-msvc`),
  VS Build Tools 2022 (workload C++ + Windows 11 SDK) requis pour lier. Chaîne validée
  par un `cargo build` témoin (compile + lien + exécution OK).
- **pnpm** : installé en global npm (`Roaming\npm`) — `corepack` indisponible (pas de
  droits admin pour écrire dans `Program Files\nodejs`).
- **Scaffolding** : `create-tauri-app` (template `react-ts`) puis restructuration vers
  l'architecture cible (`src/app`, `src/map`, `src/core`, …).
- **Identité app** : productName `GMAP`, identifier `com.gmap.app`, fenêtre 1280×800.
- **Fonds de carte en WMTS raster** (pas WFS/WMS-V) : évolution Géoplateforme annoncée
  mi-2026 ; le WMTS reste stable. Plan IGN = `GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2`,
  TileMatrixSet `PM`, identifiants confirmés via `GetCapabilities`.
- **TypeScript** : `strict` + `noUncheckedIndexedAccess` activés.
- **Tests** : Vitest, environnement `node`, ciblant les fonctions pures
  `src/**/*.test.ts` (model, basemaps, map-style).
- **Réglages pnpm 10/11** : `onlyBuiltDependencies: [esbuild]` + `verifyDepsBeforeRun:
  false` + `dangerouslyAllowAllBuilds: true` dans `pnpm-workspace.yaml`. Nécessaire car
  le garde-fou « ignored build scripts » de pnpm faisait échouer `install` et tous les
  scripts (binaire natif esbuild requis par Vite). À resserrer si pnpm corrige le
  respect de `onlyBuiltDependencies` seul.

## 2026-06-08 — Phase 1 (Modèle & GPX I/O)
- **Parsing GPX = `fast-xml-parser`** (et non `@tmcw/togeojson` suggéré au prompt).
  Écart assumé : lecture GPX → **modèle direct** (fidélité ele/time/multi-segments/
  routes/waypoints) et **testable en Node** sans DOM. togeojson cible GeoJSON (pivot
  lossy pour la structure) et exige un DOM.
- **GeoJSON = pivot d'affichage uniquement** (`core/geojson/to-geojson.ts`) ; le modèle
  reste la source de vérité.
- **Modèle étendu** : `Track.segments: TrackPoint[][]` + `Track.kind: "track"|"route"`,
  `Waypoint.time?`. Préserve la structure GPX et prépare track↔route (Phase 6).
- **Round-trip = fidélité structurelle** (pas octet-à-octet) : test
  `parse(build(parse(x)))` == `parse(x)` (hors identifiants aléatoires). Nombres écrits
  tels quels pour un round-trip exact des coordonnées/altitudes.
- **I/O fichier = frontend pur** (FileReader + Blob), fonctionnel offline. Plugin Tauri
  `dialog`/`fs` repoussé en Phase 7/8.
- **État = store Zustand minimal** (`store/project-store.ts`) sans undo/redo (Phase 3).
- **tsconfig en ES2022** (était ES2020) : pour `Error(message, { cause })` et cibler le
  webview moderne. Ajout `@types/node` (lecture fixtures dans les tests) et
  `@types/geojson` (types GeoJSON).
- **Export via dialogue natif + FS Rust** (correctif) : l'export « frontend pur »
  (`<a download>` + Blob) est traité silencieusement par WebView2 (fichier déposé dans
  Téléchargements sans dialogue ni retour) → mauvaise UX. Devancement de la décision
  « dialog/fs en Phase 7/8 » : plugin Tauri `dialog` (boîte « Enregistrer sous ») +
  commande Rust `save_text_file` (accès FS, prévu par CLAUDE.md) + message de
  confirmation. Repli Blob conservé hors Tauri (dev navigateur).

## 2026-06-08 — Phase 2a (Sélecteur de fonds)
- **Fonds inclus** : Plan IGN, Ortho IGN (`ORTHOIMAGERY.ORTHOPHOTOS`, `image/jpeg`,
  confirmé GetCapabilities), OpenTopoMap, OSM — tous libres, sans clé. **SCAN25 différé**
  (clé privée `ign_scan_ws`, licence restrictive ; sera ajouté via champ clé optionnel).
- **Bascule de fond = visibilité de couches** (et non `setStyle`) : tous les fonds sont
  des sources/couches ajoutées au chargement, seule l'active est visible. Évite de
  perdre/re-créer les couches projet à chaque changement.
- **Sous-domaines OpenTopoMap** : plusieurs URLs `a/b/c` dans `tiles` (MapLibre ne gère
  pas `{s}`).
- **État carte séparé** : nouveau store `map-store` (fond actif), distinct de
  `project-store`. Le cache offline (MBTiles + `tiles://`) est la Phase 2b.

## 2026-06-08 — Phase 2b (Cache offline MBTiles + tiles://)
- **Routage proxy `tiles://`** : sous Tauri, tous les fonds passent par
  `tiles://localhost/{layer}/{z}/{x}/{y}`. Handler Rust : MBTiles d'abord, sinon réseau
  (si non hors-ligne), sinon PNG transparent. Repli URLs directes hors Tauri.
- **Cache = téléchargements explicites uniquement** (respect CGU ; pas de cache
  opportuniste de navigation).
- **Stack Rust** : `rusqlite` (feature `bundled`, SQLite embarqué) pour le MBTiles ;
  `reqwest` (`rustls-tls`, `blocking`) pour le réseau. I/O réseau+SQLite exécutées dans
  `spawn_blocking` (évite de tenir une `Connection` !Send à travers un `await`).
- **Téléchargement séquentiel** (naturellement throttlé) avec **plafond 50 000 tuiles**
  (anti-abus) + évènement `download-progress`. Concurrence = optimisation future.
- **Mode hors-ligne** = `AtomicBool` partagé (`set_offline`) respecté par le handler.
- **URL custom scheme** : `http://tiles.localhost/...` sous Windows, `tiles://localhost/...`
  ailleurs (le handler ignore l'hôte, parse le chemin).
- **Régression toolchain** (2026-06-08) : les binaires C++ MSVC (`link.exe`/`cl.exe`) ont
  disparu (nettoyage disque auto sous pression d'espace) → réparés via VS Installer. Garder
  ≥ 20-25 Go libres ; `cargo clean` libère ~5 Go.

## 2026-06-08 — Phase 3a (Calques + undo/redo)
- **Undo/redo par instantanés immuables** (`past/present/future` dans `project-store`),
  toute mutation via `applyEdit` (CLAUDE.md : historique centralisé, mutations
  enregistrables). Partage de structure → coût mémoire faible ; limite d'historique 100.
- **Opérations de trace pures** dans `core/edit/track-ops.ts` (testées) ; le store ne fait
  qu'orchestrer/empiler.
- **Recadrage carte uniquement au chargement** d'un projet (suivi par `project.id`), plus
  à chaque édition (sinon la carte sautait à chaque renommage).
- **Nom/couleur commités au blur** (une entrée d'historique, pas une par frappe).
- **Sélection de trace** (`selectedTrackId`) + surbrillance via propriété GeoJSON `selected`
  et `line-width` conditionnelle.
- Phase 3b (édition des points sur la carte) réutilisera `applyEdit`/undo-redo.

## 2026-06-08 — Phase 3b (Édition des points)
- **Mode édition explicite** (`map-store.editMode`) sur la trace sélectionnée : poignées
  de sommets déplaçables, **insertion par poignées de milieu** (pas de projection sur
  segment), suppression du sommet sélectionné (Suppr), Échap pour quitter.
- **Drag = mise à jour visuelle directe des sources** (pas d'écriture store) ; **commit
  unique** au relâchement via `applyEdit` → une seule entrée d'historique par déplacement.
- **Sélection/drag unifiés** dans le cycle mousedown/move/up (pas de handler `click`
  séparé) pour éviter l'ambiguïté clic vs glissement.
- **Opérations de points pures** (`core/edit/point-ops.ts`), `mapSegment` renvoie le même
  projet si rien ne change (pas d'entrée d'historique vide).
- Table des points éditable + sélection multiple repoussées en **Phase 3c**.

## 2026-06-08 — Phase 4a (Mode dessin)
- **Mode dessin explicite** (`map-store.drawMode`), exclusif du mode édition. « Dessiner »
  crée une nouvelle trace (et un projet si aucun) et la sélectionne.
- **Point par point** = 1 clic → 1 point → 1 entrée d'historique ; **freehand** = glisser
  échantillonné (seuil écran) avec preview live et **commit unique** au relâchement.
- **Opérations pures** `core/edit/draw-ops.ts` (`createDrawingTrack`, `addTrack`,
  `appendPoint`/`appendPoints`).
- **Trace vide retirée** à la sortie du mode (évite les calques fantômes).
- Routing (snap-to-path BRouter + Géoplateforme) = **Phase 4b**.

## 2026-06-08 — Phase 4b-i (Routing online Géoplateforme)
- **Routing scindé** : 4b-i online (Géoplateforme, sans installation) puis 4b-ii offline
  (BRouter prioritaire). Résultat final conforme au prompt (BRouter d'abord), livré dans
  l'ordre inverse pour la testabilité.
- **Appel HTTP côté Rust** (`route_online`, réutilise `reqwest`) → évite le CORS webview ;
  repli `fetch` direct hors Tauri.
- **Parsing en TS pur testé** (`core/routing/itinerary.ts`) : la commande Rust renvoie le
  JSON brut, `parseItineraryResponse` en extrait points/distance/durée.
- **Snap-to-path** = segments routés entre clics (ancres), ajoutés via `applyEdit`
  (réversibles) ; échec → segment droit. Profils online : pedestrian/car.
- **Recalcul au déplacement d'ancre** et profils hiking/trekking/vélo = **4b-ii** (BRouter).

## 2026-06-08 — Phase 5a (Stats + altitude online + Naismith)
- **Calculs purs et testés** (`core/geo/stats.ts`, `core/geo/naismith.ts`) : distance
  haversine, D+/D- (seuil paramétrable, défaut 0), alt min/max, pente moy/max ; durée
  Naismith (vitesse de base réglable, défaut 4 km/h ; 6 s/m de montée ; correction descente
  Langmuir optionnelle).
- **Altimétrie online** : commande Rust `elevation_online` (réutilise `reqwest`, batch de
  points, évite le CORS) ; parsing TS pur testé (`core/elevation`) ; application via
  `applyEdit` (réversible). Sentinelle no-data (`z ≤ -1000`) ignorée. Lots ≤ 200 points.
- **MNT offline** et **détection/suppression des pics aberrants** différés (MNT = phase
  ultérieure ; pics = Phase 6 nettoyage).
- Profil altimétrique interactif + coloration par pente = **Phase 5b**.

## 2026-06-08 — Phase 5b (Profil interactif + coloration pente)
- **Profil SVG maison** (pas de dépendance de graphes) ; données pures testées
  (`core/geo/profile.ts`). Survol → `map-store.hoverPoint` → marqueur carte (synchro).
- **Coloration par pente** : une `LineString` par arête avec sa pente
  (`core/geojson/slope-geojson.ts`), couche `step` (gradient configurable en un point :
  `SLOPE_LEGEND` dans `slope-layers.ts`) + légende. Activée pour la trace sélectionnée.
- **Consolidation UI** : `StatsPanel` (5a) **remplacé** par `ProfilePanel` (dock bas
  pleine largeur) regroupant stats + Naismith + correction d'altitude + coloration + profil.
- **Conformité attribution** : déplacée en haut-droite (compacte) pour rester visible
  au-dessus du dock profil.

## 2026-06-08 — Refonte UI (barre de menus + interface ancrée)
- **Interface ancrée** (fin des encarts flottants qui se chevauchaient) : barre de menus
  déroulants style Word (Fichier/Édition/Carte/Outils), sous-barre contextuelle, Calques
  ancré à gauche (rétractable), profil ancré en bas (repliable).
- **3 types de boutons** : ① persistant (barre) · ② contextuel (sous-barre/panneaux) ·
  ③ menu Outils (actions ponctuelles : corriger l'altitude, télécharger une zone…).
- **Primitive `Menu`** (popover, fermeture clic-dehors/Échap). Nouveau **`ui-store`**
  (calques/profil repliés, dialogue de téléchargement). `MapView` : `ResizeObserver` pour
  `map.resize()` au repli des panneaux.
- Composants supprimés (répartis) : `Toolbar`, `OfflinePanel` (→ `DownloadDialog`),
  `BasemapSelector` (→ menu Carte). Aucun changement du cœur métier ni du Rust.

## 2026-06-08 — Phase 6a (Transformations de traces)
- **Opérations pures** `core/edit/transform-ops.ts` (testées) : `reverseTrack`,
  `convertTrackKind` (track↔route, route = un segment aplati), `mergeTracks`,
  `splitTrackByDistance` (morceaux contigus, point-frontière partagé). Toutes via
  `applyEdit` → réversibles.
- **Accès via menu Outils** : Inverser · Convertir en route/trace (libellé selon le kind) ·
  Fusionner les traces visibles (< 2 visibles = désactivé) · Découper par distance…
  (dialogue `SplitDialog`).
- **Sélection** : fusion → trace fusionnée ; découpe → 1er morceau (repéré par l'index).
- Nettoyage (Douglas-Peucker, lissage, pics d'altitude, découpe au point) = **Phase 6b**.

## 2026-06-08 — Phase 6b (Nettoyage)
- **Algos purs testés** (`core/geo/`) : `simplifyTrack` (Douglas-Peucker, distance
  perpendiculaire en mètres via projection locale, par segment) ; `smoothTrack` (retrait
  des aberrants > maxJump + moyenne glissante, extrémités fixes) ; `removeElevationSpikes`
  (altitude isolée remplacée par interpolation des voisins).
- **Aperçu live** : `map-store.previewData` + couche `preview-layer` (ligne rose
  pointillée) ; les dialogues Simplifier/Lisser recalculent et publient l'aperçu, nettoyé
  à la fermeture. Simplifier affiche « N → M points (−K) ».
- **Pics d'altitude = action directe** (seuil par défaut 25 m, `DEFAULT_SPIKE_THRESHOLD_M`).
- Tout via `applyEdit` (réversible). Découpe au point cliqué = petit ajout différé.

## 2026-06-10 — Phase 7a (Exports GeoJSON / KML / TCX)
- **Sérialiseurs purs testés** (`core/export/`) : `buildGeoJson` (MultiLineString +
  Points, altitudes incluses), `buildKml` (KML 2.2), `buildTcx` (Courses, `Time`
  synthétisé si absent, nom de Course tronqué à 15 car.).
- **Menu Fichier** : Exporter GPX / GeoJSON / KML / TCX via un helper générique `saveAs`
  (réutilise le dialogue natif + `save_text_file`). Pas de changement Rust/store.
- **FIT** (binaire) = **7a-bis** (encodeur + `save_binary_file`). Puis waypoints,
  géocodage, photos EXIF.

## 2026-06-11 — Phases 7c (Géocodage) & 7d (Photos EXIF)
- **Géocodage = Géoplateforme** (`/geocodage/search`, index `address,poi`), cohérent avec
  la stack IGN. Appel via commande Rust `geocode_online` (mirroir d'`elevation_online`,
  évite le CORS) ; parsing GeoJSON pur et testé. Hors-ligne = dégradation gracieuse.
- **Recherche** flottante (haut-centre carte), suggestions débouncées (300 ms) ; un résultat
  recentre (`flyTo`) ou pose un POI.
- **EXIF = parseur pur maison, zéro dépendance** (pas d'ajout de lib) : lecture ciblée
  JPEG APP1 → TIFF → IFD GPS (0x8825) + sous-IFD Exif (0x8769, DateTimeOriginal). Robuste
  aux fichiers non conformes (try/catch → résultat partiel). Testé via un JPEG/EXIF
  construit à la main.
- **Photo → POI** : position GPS si présente ; sinon **corrélation temporelle** sur une
  trace horodatée (`trackPointAtTime`, interpolation linéaire). Les temps « nus » (EXIF sans
  fuseau) sont lus comme UTC pour rester comparables aux temps GPX. Import groupé en une
  seule entrée d'historique (`addWaypoints`). Symbole « photo ».

## 2026-06-11 — Phase 7b (Waypoints / POI)
- **Ops pures** `core/edit/waypoint-ops.ts` (add/update/move/remove, immuables, testées) ;
  `createWaypoint` + `WAYPOINT_SYMBOLS` (jeu logique rando/canoë : sommet, eau, bivouac…)
  dans le modèle.
- **Rendu en marqueurs DOM** (`maplibregl.Marker`, glyphe + nom) plutôt qu'une couche
  symbole : afficher du texte/emoji exigerait une URL `glyphs` (police PBF), incompatible
  avec le mode hors-ligne. Les marqueurs gèrent nativement le glisser et le clic.
- **Mode POI** (`map-store.poiMode`) exclusif des modes dessin/édition ; déplacement d'un
  POI **uniquement** en mode POI (évite les déplacements accidentels).
- **Altitude auto à la pose** : récupérée via le client altimétrique online, appliquée par
  `enrichWaypointElevation` **hors historique** (la pose reste une seule entrée undo ;
  l'enrichissement asynchrone ne pollue pas la pile). Repli vide si hors-ligne/échec.
- **Édition** via brouillon local (`WaypointEditor`) commité sur « Enregistrer » → une
  entrée d'historique par session d'édition (cf. motif nom/couleur des traces).

## 2026-06-10 — Phase 7a-bis (Export FIT)
- **Encodeur FIT pur** (`core/export/fit.ts`) : fichier « course » (file_id type=course +
  course + lap + records), en-tête 14 octets, semicercles, altitude (m+500)×5, temps époque
  FIT, **CRC-16 FIT** (en-tête + fichier). Tests structurels (signature .FIT, taille de
  données, CRC). → tous les formats du prompt sont couverts (GPX/GeoJSON/KML/TCX/FIT).
- **Sauvegarde binaire** : commande Rust `save_binary_file(path, Vec<u8>)` ; le frontend
  envoie `Array.from(bytes)`. Menu Fichier ▸ Exporter FIT…

## 2026-06-10 — Import GPX multiple (ajout aux calques)
- « Ouvrir des GPX… » accepte **plusieurs fichiers** et **ajoute** les traces/waypoints au
  projet courant (action `importProject`) au lieu de remplacer : 1er fichier crée le projet
  (réinitialise l'historique), les suivants s'ajoutent via `applyEdit` (réversible) avec
  recoloration pour continuer la palette. Tous les GPX ouverts apparaissent dans les calques.
