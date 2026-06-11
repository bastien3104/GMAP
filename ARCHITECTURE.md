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
│  │  └─ app.css            # design system (tokens clair/sombre, animations, identité)
│  ├─ map/                  # MapLibre : init, fonds, style, couches
│  │  ├─ MapView.tsx        # composant carte (init, fonds, source projet, fitBounds)
│  │  ├─ basemaps.ts        # définition des fonds + URL proxy tiles://
│  │  ├─ map-style.ts       # build de style/source raster (pur)
│  │  ├─ track-layers.ts    # source + couche ligne du projet (POI = marqueurs DOM)
│  │  ├─ edit-layers.ts     # poignées d'édition (sommets/milieux)
│  │  ├─ slope-layers.ts    # couche coloration pente + marqueur de survol
│  │  ├─ preview-layer.ts   # couche d'aperçu (outils de nettoyage)
│  │  ├─ map-ref.ts         # référence carte (emprise/zoom courants)
│  │  └─ basemaps.test.ts
│  ├─ core/                 # logique métier pure (testée, sans UI)
│  │  ├─ model.ts           # types Project / Track / Waypoint / TrackPoint + helpers
│  │  ├─ tiles/             # math de tuiles Web Mercator (+ tests)
│  │  ├─ edit/              # opérations pures (track-ops, point-ops, draw-ops, transform-ops,
│  │  │  │                  #   waypoint-ops, activity-ops : recadrage temporel)
│  │  ├─ geo/               # stats, Naismith, profil, simplify (RDP), smooth, elevation-clean,
│  │  │  │                  #   activity-stats (temps/vitesses/VAM/zones cardio/splits) (+ tests)
│  │  ├─ import/            # parse-fit : décodeur FIT pur et tolérant (+ tests)
│  │  ├─ elevation/         # client altimétrique online (+ tests)
│  │  ├─ geocode/           # client de géocodage Géoplateforme (+ tests)
│  │  ├─ exif/              # lecture EXIF GPS/date + import photos→POI (purs, + tests)
│  │  ├─ gpx/               # import/export GPX
│  │  │  ├─ parse-gpx.ts    # GPX → modèle (tolérant)
│  │  │  ├─ build-gpx.ts    # modèle → GPX 1.1
│  │  │  ├─ gpx.test.ts     # parse / build / round-trip / robustesse
│  │  │  └─ __fixtures__/   # GPX d'exemple pour les tests
│  │  ├─ geojson/           # modèle → GeoJSON (pivot d'affichage)
│  │  │  ├─ to-geojson.ts
│  │  │  ├─ slope-geojson.ts   # arêtes + pente (coloration)
│  │  │  ├─ metric-geojson.ts  # arêtes + vitesse/FC (coloration par métrique)
│  │  │  └─ to-geojson.test.ts
│  │  ├─ export/            # exports GeoJSON / KML / TCX / FIT (+ tests)
│  │  └─ routing/           # client itinéraire (Géoplateforme online) (+ BRouter en 4b-ii)
│  ├─ store/                # Zustand
│  │  ├─ project-store.ts   # projet courant + historique undo/redo + sélection
│  │  ├─ map-store.ts       # état carte (fond, hors-ligne, modes, coloration, survol)
│  │  ├─ offline-store.ts   # registre persistant des zones téléchargées (localStorage)
│  │  └─ ui-store.ts        # agencement UI (calques repliés, profil replié, dialogues)
│  ├─ ui/                   # composants UI
│  │  ├─ Menu.tsx           # primitive de menu déroulant
│  │  ├─ MenuBar.tsx        # barre Fichier/Édition/Carte/Outils + indicateur réseau
│  │  ├─ ContextBar.tsx     # sous-barre contextuelle (Dessin / Édition / POI)
│  │  ├─ LayersPanel.tsx    # dock gauche rétractable : calques + points d'intérêt
│  │  ├─ ProfilePanel.tsx   # dock bas repliable : stats + Naismith + profil SVG interactif
│  │  ├─ WaypointEditor.tsx # éditeur d'un POI (nom/symbole/altitude/note)
│  │  ├─ SearchBox.tsx      # recherche flottante (géocodage) : recentrer / poser un POI
│  │  ├─ ShortcutsHelp.tsx  # overlay d'aide des raccourcis clavier
│  │  ├─ ExportDialog.tsx   # export sélectif (format + traces + POI)
│  │  ├─ OfflineZonesPanel.tsx # gestionnaire des cartes hors-ligne (façon Apple Plans)
│  │  ├─ ActivityDialog.tsx # analyse d'activité (stats, zones cardio, splits, recadrage)
│  │  ├─ icons.tsx          # jeu d'icônes SVG maison (motif « trace », currentColor)
│  │  ├─ useTheme.ts        # applique le thème clair/sombre/auto (data-theme)
│  │  ├─ DownloadDialog.tsx # dialogue de téléchargement de zone offline
│  │  └─ useEditorShortcuts.ts  # raccourcis Ctrl+Z / Ctrl+Y
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
      ├─ download.rs        # téléchargement de zone
      ├─ routing.rs         # commande route_online (Géoplateforme)
      └─ elevation.rs       # commande elevation_online (altimétrie)
```

## Interface (régions ancrées)
Layout en colonnes flex (plus d'encarts flottants) : **barre de menus** (Fichier ▾ ·
Édition · Carte ▾ · Outils ▾ + indicateur réseau), **sous-barre contextuelle** (visible
en mode Dessin/Édition), rangée **[Calques (gauche, rétractable) | carte]**, **dock profil**
(bas, repliable). Trois types de boutons : ① persistant (barre), ② contextuel (sous-barre /
panneaux selon mode/sélection), ③ menu Outils (actions ponctuelles : corriger l'altitude,
télécharger une zone…). `MapView` redimensionne la carte (`ResizeObserver`) quand les
panneaux se replient. État d'agencement dans `ui-store`.

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
dans `core/edit/` (`track-ops` : renommer/couleur/visibilité/ordre/suppression ;
`point-ops` : déplacer/insérer/supprimer un point ; `waypoint-ops` : ajouter/modifier/
déplacer/supprimer un POI). `selectedTrackId` pilote la surbrillance et la cible d'édition.

**Points d'intérêt (POI)** (`map-store.poiMode`, exclusif des modes dessin/édition,
Phase 7b) : en mode POI, clic sur la carte pose un waypoint (sélectionné, éditeur ouvert) ;
l'altitude est pré-remplie via le client altimétrique online (enrichissement **hors
historique** : `enrichWaypointElevation`, repli vide si hors-ligne). Les POI sont rendus en
**marqueurs DOM** (`maplibregl.Marker`, glyphe + nom) — déplaçables en mode POI (commit
unique au `dragend`) ; clic = sélection. `WaypointEditor` (nom/symbole/altitude/note),
`LayersPanel` liste les POI (clic = recadrer/sélectionner). `selectedWaypointId` pilote la
surbrillance et l'éditeur ; Suppr supprime, Échap désélectionne.

**Mode édition des points** (`map-store.editMode`) : sur la trace sélectionnée, `MapView`
affiche des poignées (sources `edit-vertices`/`edit-midpoints`). Glisser un sommet met à
jour la géométrie en direct (sans toucher au store) et commite **une** entrée d'historique
au relâchement ; clic sur un milieu insère un point ; sommet sélectionné + Suppr supprime ;
Échap quitte le mode.

**Mode dessin** (`map-store.drawMode`, exclusif de l'édition) : « Dessiner » crée une
nouvelle trace (via `core/edit/draw-ops`) et la sélectionne ; clic = ajout d'un point
(point par point), ou **freehand** = glisser (échantillonné, preview live, commit unique).
Une trace restée vide est retirée à la sortie. Échap termine.

**Snap-to-path online** (`map-store.routing`, Phase 4b-i) : en mode dessin + « suivre les
sentiers », chaque clic est une ancre ; le segment ancre→clic est routé par l'API
itinéraire Géoplateforme. L'appel HTTP passe par la commande Rust `route_online` (réutilise
`reqwest`, évite le CORS) ; le parsing est en TS pur testé (`core/routing/itinerary.ts`).
Échec réseau → segment droit (dégradation gracieuse). Le moteur offline **BRouter**
(prioritaire) viendra en 4b-ii.

**Recherche / géocodage** (Phase 7c) : `SearchBox` interroge le géocodage Géoplateforme
(`core/geocode`, débouncé) via la commande Rust `geocode_online` (évite le CORS) ; un
résultat recentre la carte (`map-ref.flyTo`) ou pose un POI à sa position. Hors-ligne →
message discret, jamais de crash.

**Photos EXIF → POI** (Phase 7d) : `core/exif` lit *sans dépendance* la position GPS et la
date d'une photo JPEG (`parseExifGps` : APP1→TIFF→IFD GPS/Exif). `photoToWaypoint` crée un
POI à la position GPS ; à défaut, si la photo est horodatée et qu'une trace porte des
`time`, la position est **interpolée par corrélation temporelle** (`trackPointAtTime`).
L'import (Fichier ▸ Importer des photos…) ajoute le lot en une seule entrée d'historique
(`addWaypoints`) et affiche un bilan (géolocalisées / corrélées / ignorées).

**Export sélectif** (Phase 9a) : `Fichier ▸ Exporter (sélection)…` ouvre `ExportDialog`
(format GPX/GeoJSON/KML/TCX/FIT + cases par trace + inclure les POI). `subsetProject`
(pur, testé) filtre le projet avant sérialisation ; sauvegarde factorisée dans `export-save`.

**Cartes hors-ligne** (Phase 9b, façon Apple Plans) : le téléchargement nomme et enregistre
une **zone** (`offline-store`, persistée `localStorage` ; nom par défaut = lieu via géocodage
inverse). `OfflineZonesPanel` (`Carte ▸ Cartes hors-ligne…`) liste les zones (fond, zooms,
nb tuiles, taille estimée, date) et permet **voir / renommer / supprimer**. La suppression
libère l'espace via la commande Rust `delete_zone_tiles` (efface les tuiles de l'emprise).
Les emprises s'affichent sur la carte (couche `offline-zones`, bascule dans le menu Carte).
Les **tuiles** restent dans les MBTiles de `app_data_dir` ; le registre ne stocke que les
métadonnées.

**Thème, raccourcis, perf, empaquetage** (Phase 8) : thème **clair/sombre/auto** persistant
(`ui-store.theme` + `useTheme` qui pose `data-theme` sur `<html>` ; auto résolu via
`matchMedia`, pré-appliqué dans `index.html` pour éviter le flash ; CSS sombre en
`[data-theme="dark"]`). **Raccourcis** globaux (`Ctrl+O/E`, `Ctrl+F`, `d/e/p`, `?`) + overlay
`ShortcutsHelp` (menu Aide). **Build** découpé (`vite.config` `manualChunks` : MapLibre /
vendors / app). **Empaquetage Windows** : `tauri.conf.json` bundle **NSIS** en mode
`currentUser` (installation **sans droits admin**, conforme à la contrainte poste) ;
`pnpm tauri build` produit l'installeur.

**Statistiques & altitude** (Phase 5a) : `core/geo` calcule distance/D+/D-/pente
(`stats.ts`) et la durée (`naismith.ts`) ; `StatsPanel` les affiche pour la trace
sélectionnée. La **correction d'altitude** récupère les `z` via la commande Rust
`elevation_online` (Géoplateforme, lots de points), parse en TS (`core/elevation`), et
applique via `applyEdit` (réversible). MNT offline + suppression des pics aberrants à venir
(Phases ultérieures).

**Profil & coloration par pente** (Phase 5b) : `ProfilePanel` (dock bas) trace un profil
SVG (`core/geo/profile.ts`) ; le survol publie `map-store.hoverPoint`, que `MapView` rend en
marqueur sur la carte. La bascule « pente » alimente une source d'arêtes
(`core/geojson/slope-geojson.ts`) colorée par `slope` (couche `slope-layers.ts`, gradient
configurable + légende). Attribution déplacée en haut-droite (compacte) pour rester visible
au-dessus du dock.

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
  `project-data` (couche `track-lines`) et recadre la vue (`fitBounds`) ; les waypoints sont
  rendus séparément en marqueurs DOM.
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
