# ARCHITECTURE.md — app GPX « GMAP »

> Document vivant, mis à jour à chaque phase. État : **Phase 0 (Bootstrap)**.

## Vue d'ensemble
Application desktop **Tauri 2** (backend Rust minimal) + frontend **React + TypeScript
+ Vite**. Carte **MapLibre GL JS**. Format pivot interne de travail : **GeoJSON** ;
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
│  │  ├─ App.tsx
│  │  └─ app.css
│  ├─ map/                  # MapLibre : init, fonds, style, interactions
│  │  ├─ MapView.tsx        # composant carte (effets, cleanup)
│  │  ├─ basemaps.ts        # définition des fonds (Plan IGN…)
│  │  ├─ map-style.ts       # build d'un style MapLibre (pur)
│  │  └─ basemaps.test.ts
│  ├─ core/                 # logique métier pure (testée, sans UI)
│  │  ├─ model.ts           # types Project / Track / Waypoint / TrackPoint
│  │  ├─ gpx/               # import/export GPX (Phase 1)
│  │  ├─ geo/               # stats, simplification, lissage (Phase 5/6)
│  │  ├─ routing/           # BRouter offline + Géoplateforme (Phase 4)
│  │  └─ elevation/         # altitude API + MNT (Phase 5)
│  ├─ store/                # Zustand + undo/redo (Phase 3)
│  ├─ ui/                   # composants UI (panneaux, profil…) (Phase 5+)
│  └─ offline/              # MBTiles, téléchargement de zones (Phase 2)
└─ src-tauri/               # backend Rust
   ├─ Cargo.toml · build.rs · tauri.conf.json
   ├─ capabilities/ · icons/
   └─ src/{main.rs, lib.rs}
```
Les dossiers encore vides contiennent un `.gitkeep` ; ils seront peuplés selon les
phases indiquées.

## Modèle de données
Source de vérité : `src/core/model.ts`.
- **Project** = `{ id, name, tracks: Track[], waypoints: Waypoint[] }`
- **Track** = `{ id, name, points: TrackPoint[], visible, color }`
- **TrackPoint** = `{ lat, lon, ele?, time? }`
- **Waypoint** = `{ id, lat, lon, name, ele?, note?, symbol? }`

`ele` et `time` sont préservés lorsqu'ils existent (import GPX, Phase 1).

## Flux de données (cible)
```
Fichier GPX ──import──▶ GeoJSON ──▶ Modèle (core/model) ──▶ Store (Zustand)
                                                              │
                                       ┌──────────────────────┤
                                       ▼                      ▼
                                  MapLibre (carte)        UI (panneaux, profil)
                                       │                      │
                                       └─── interactions ◀────┘
                                          (toute mutation = action undo/redo)
Modèle ──export──▶ GeoJSON ──▶ GPX / KML / TCX / FIT
```
En Phase 0, seul le chemin « carte » est actif (affichage du fond Plan IGN) ; le
store, l'import/export et l'UI d'édition arrivent aux phases suivantes.

## Fonds de carte
WMTS raster Géoplateforme (pas de WFS/WMS-V — évolution annoncée mi-2026).
- **Plan IGN v2** : couche `GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2`, style `normal`,
  format `image/png`, TileMatrixSet `PM` (EPSG:3857, 256 px, z0–19). Public, sans clé.
- Attribution affichée en permanence (contrôle MapLibre) — conformité licence.

## Backend Rust (src-tauri)
Minimal en Phase 0 (initialise Tauri + plugin opener). Accueillera : protocole
custom `tiles://` (lecture MBTiles), sidecar BRouter, accès FS — sans logique métier.
