# ARCHITECTURE.md — app GPX « GMAP »

> Document vivant, mis à jour à chaque phase. État : **Phase 1 (Modèle & GPX I/O)**.

## Vue d'ensemble
Application desktop **Tauri 2** (backend Rust minimal) + frontend **React + TypeScript
+ Vite**. Carte **MapLibre GL JS**. Format pivot interne d'affichage : **GeoJSON** ;
modèle canonique : `src/core/model.ts`. Fonctionnement online **et** offline.

## Arborescence (réelle)
```
GMAP/
├─ CLAUDE.md · ARCHITECTURE.md · DECISIONS.md
├─ package.json · pnpm-workspace.yaml · .npmrc
├─ tsconfig.json · tsconfig.node.json · vite.config.ts · vitest.config.ts
├─ index.html
├─ public/                  # assets statiques
├─ src/
│  ├─ main.tsx              # point d'entrée React
│  ├─ app/                  # composition / layout
│  │  ├─ App.tsx            # carte + barre d'outils
│  │  └─ app.css
│  ├─ map/                  # MapLibre : init, fonds, style, couches
│  │  ├─ MapView.tsx        # composant carte (init, fonds, source projet, fitBounds)
│  │  ├─ basemaps.ts        # définition des fonds + URL proxy tiles://
│  │  ├─ map-style.ts       # build de style/source raster (pur)
│  │  ├─ track-layers.ts    # source + couches MapLibre du projet
│  │  ├─ map-ref.ts         # référence carte (emprise/zoom courants)
│  │  └─ basemaps.test.ts
│  ├─ core/                 # logique métier pure (testée, sans UI)
│  │  ├─ model.ts           # types Project / Track / Waypoint / TrackPoint + helpers
│  │  ├─ tiles/             # math de tuiles Web Mercator (+ tests)
│  │  ├─ edit/              # opérations d'édition pures (track-ops…) (+ tests)
│  │  ├─ gpx/               # import/export GPX
│  │  │  ├─ parse-gpx.ts    # GPX → modèle (tolérant)
│  │  │  ├─ build-gpx.ts    # modèle → GPX 1.1
│  │  │  ├─ gpx.test.ts     # parse / build / round-trip / robustesse
│  │  │  └─ __fixtures__/   # GPX d'exemple pour les tests
│  │  ├─ geojson/           # modèle → GeoJSON (pivot d'affichage)
│  │  │  ├─ to-geojson.ts
│  │  │  └─ to-geojson.test.ts
│  │  ├─ geo/               # stats, simplification, lissage (Phase 5/6)
│  │  ├─ routing/           # BRouter offline + Géoplateforme (Phase 4)
│  │  └─ elevation/         # altitude API + MNT (Phase 5)
│  ├─ store/                # Zustand
│  │  ├─ project-store.ts   # projet courant + historique undo/redo + sélection
│  │  └─ map-store.ts       # état carte (fond actif, hors-ligne)
│  ├─ ui/                   # composants UI
│  │  ├─ Toolbar.tsx        # ouvrir / exporter GPX + sélecteur de fond
│  │  ├─ BasemapSelector.tsx
│  │  ├─ LayersPanel.tsx    # calques : visibilité/couleur/nom/ordre/suppr + annuler/rétablir
│  │  ├─ useEditorShortcuts.ts  # raccourcis Ctrl+Z / Ctrl+Y
│  │  └─ OfflinePanel.tsx   # téléchargement de zone + indicateur online/offline
│  └─ offline/              # cache offline
│     └─ tiles-api.ts       # pont vers les commandes Rust (download/offline/stats)
└─ src-tauri/               # backend Rust (capacités natives)
   ├─ Cargo.toml · build.rs · tauri.conf.json
   ├─ capabilities/ · icons/
   └─ src/
      ├─ lib.rs             # commandes + protocole tiles:// + état partagé
      ├─ providers.rs       # table fournisseurs (URL/format)
      ├─ mbtiles.rs         # cache SQLite (rusqlite)
      ├─ tiles_protocol.rs  # handler tiles:// (MBTiles puis réseau)
      └─ download.rs        # téléchargement de zone
```

## Modèle de données
Source de vérité : `src/core/model.ts`.
- **Project** = `{ id, name, tracks: Track[], waypoints: Waypoint[] }`
- **Track** = `{ id, name, kind: "track"|"route", segments: TrackPoint[][], visible, color }`
  - un `trk` GPX multi-`trkseg` → un Track multi-segments ; un `rte` → Track `kind:"route"`.
- **TrackPoint** = `{ lat, lon, ele?, time? }`
- **Waypoint** = `{ id, lat, lon, name, ele?, time?, note?, symbol? }`

`ele` et `time` sont préservés à l'import comme à l'export.

### Édition & undo/redo (Phase 3a)
Le `project-store` historise l'état : `past[] / project (présent) / future[]`. Toute
mutation passe par `applyEdit(updater)` (instantanés immuables à partage de structure),
ce qui la rend annulable (`undo`/`redo`, Ctrl+Z / Ctrl+Y). Les opérations pures vivent
dans `core/edit/` (ex. `track-ops` : renommer, couleur, visibilité, réordonner, supprimer).
`selectedTrackId` pilote la surbrillance (et, en 3b, la cible d'édition des points).

## Flux de données
```
Fichier GPX ──parseGpx──▶ Modèle (core/model) ──▶ Store Zustand (project-store)
                                                        │
                                  ┌─────────────────────┤
                                  ▼                     ▼
                       projectToGeoJSON ──▶ MapLibre   UI (Toolbar, panneaux…)
                       (core/geojson)        (source "project-data")

Modèle ──buildGpx──▶ GPX 1.1   (export ; KML/TCX/FIT en Phase 7)
```
- **Import** : `Toolbar` lit le fichier (FileReader) → `parseGpx` → `loadProject` (store).
- **Affichage** : `MapView` observe le store, convertit en GeoJSON, met à jour la source
  `project-data` (couches `track-lines` + `waypoints`) et recadre la vue (`fitBounds`).
- **Export** : `Toolbar` → `buildGpx(project)` → `Blob` téléchargé.
- I/O fichier 100 % frontend (offline). Le plugin Tauri `dialog`/`fs` (UX native) viendra
  en Phase 7/8.

## Fonds de carte
Raster, sélectionnables via un menu (`BasemapSelector` → `map-store.activeBasemapId`).
Tous ajoutés à la carte au chargement (une source/couche chacun) ; la bascule se fait
par **visibilité de couche** (pas de `setStyle`, les couches projet restent en place).
Attribution du fond actif affichée en permanence (conformité licence/CGU).
- **Plan IGN v2** : `GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2`, `image/png`, z0–19 (Géoplateforme).
- **Ortho IGN** : `ORTHOIMAGERY.ORTHOPHOTOS`, `image/jpeg`, z6–19 (Géoplateforme).
- **OpenTopoMap** : tuiles XYZ `a/b/c`, z0–17 (CC-BY-SA, données OSM).
- **OSM** standard : `tile.openstreetmap.org`, z0–19.
- IGN via WMTS-KVP, TileMatrixSet `PM` (EPSG:3857, 256 px). Pas de WFS/WMS-V (évolution
  annoncée mi-2026). **SCAN25 différé** (clé privée, licence restrictive).

## Cache offline & flux des tuiles (Phase 2b)
Sous Tauri, tous les fonds passent par le protocole custom
`tiles://localhost/{layer}/{z}/{x}/{y}` (en dev navigateur : URLs directes).
```
MapLibre ─tiles://{layer}/{z}/{x}/{y}→ handler Rust (tiles_protocol)
                                         │
                       MBTiles présent ? ─oui→ tuile servie (offline OK)
                                         └non→ mode hors-ligne ? ─oui→ tuile transparente
                                                                  └non→ réseau (provider) → tuile
Téléchargement : OfflinePanel → cmd Rust download_zone(layer, zooms, bbox)
   → reqwest (throttlé, plafonné) → MBTiles ({appData}/tiles/{layer}.mbtiles)
   → évènement download-progress → barre de progression.
```
- **Cache = téléchargements explicites uniquement** (la navigation ne remplit pas le cache).
- **Mode hors-ligne** : drapeau `AtomicBool` côté Rust (cmd `set_offline`) ; le handler
  ne tente plus le réseau. Indicateur UI = `navigator.onLine` + bascule manuelle.
- Schéma MBTiles standard (SQLite), axe `y` en convention TMS (inversé).
- **SCAN25** et un CSP strict restent pour plus tard (Phase 8).

## Backend Rust (src-tauri)
Minimal (initialise Tauri + plugin opener). Accueillera : protocole custom `tiles://`
(lecture MBTiles), sidecar BRouter, accès FS — sans logique métier.
