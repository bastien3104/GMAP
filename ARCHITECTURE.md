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
│  │  ├─ MapView.tsx        # composant carte (init, source projet, fitBounds)
│  │  ├─ basemaps.ts        # définition des fonds (Plan IGN…)
│  │  ├─ map-style.ts       # build d'un style raster (pur)
│  │  ├─ track-layers.ts    # source + couches MapLibre du projet
│  │  └─ basemaps.test.ts
│  ├─ core/                 # logique métier pure (testée, sans UI)
│  │  ├─ model.ts           # types Project / Track / Waypoint / TrackPoint + helpers
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
│  ├─ store/                # Zustand (undo/redo en Phase 3)
│  │  └─ project-store.ts   # projet courant
│  ├─ ui/                   # composants UI
│  │  └─ Toolbar.tsx        # ouvrir / exporter GPX
│  └─ offline/              # MBTiles, téléchargement de zones (Phase 2)
└─ src-tauri/               # backend Rust (minimal)
   ├─ Cargo.toml · build.rs · tauri.conf.json
   ├─ capabilities/ · icons/
   └─ src/{main.rs, lib.rs}
```

## Modèle de données
Source de vérité : `src/core/model.ts`.
- **Project** = `{ id, name, tracks: Track[], waypoints: Waypoint[] }`
- **Track** = `{ id, name, kind: "track"|"route", segments: TrackPoint[][], visible, color }`
  - un `trk` GPX multi-`trkseg` → un Track multi-segments ; un `rte` → Track `kind:"route"`.
- **TrackPoint** = `{ lat, lon, ele?, time? }`
- **Waypoint** = `{ id, lat, lon, name, ele?, time?, note?, symbol? }`

`ele` et `time` sont préservés à l'import comme à l'export.

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
WMTS raster Géoplateforme (pas de WFS/WMS-V — évolution annoncée mi-2026).
- **Plan IGN v2** : `GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2`, style `normal`, `image/png`,
  TileMatrixSet `PM` (EPSG:3857, 256 px, z0–19). Public, sans clé. Attribution affichée.

## Backend Rust (src-tauri)
Minimal (initialise Tauri + plugin opener). Accueillera : protocole custom `tiles://`
(lecture MBTiles), sidecar BRouter, accès FS — sans logique métier.
