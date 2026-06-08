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
