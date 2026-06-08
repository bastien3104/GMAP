/**
 * Définition des fonds de carte (basemaps) disponibles.
 *
 * Phase 2a : Plan IGN, Ortho IGN, OpenTopoMap, OSM (tous libres, sans clé).
 * SCAN25 (clé privée `ign_scan_ws`, licence restrictive) est différé.
 *
 * Les fonds passent par WMTS/XYZ (raster) et NON par WFS/WMS-V : une évolution de
 * ces derniers est annoncée pour mi-2026 côté Géoplateforme.
 *
 * Identifiants IGN confirmés via GetCapabilities (data.geopf.fr/wmts) :
 *   - Plan IGN : GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2, style normal, image/png, z0–19.
 *   - Ortho    : ORTHOIMAGERY.ORTHOPHOTOS,        style normal, image/jpeg, z6–19.
 *   TileMatrixSet `PM` (EPSG:3857, tuiles 256 px) dans les deux cas.
 */

/** Description d'un fond de carte raster (tuiles XYZ/WMTS-KVP). */
export interface RasterBasemap {
  /** Identifiant logique stable. */
  id: string;
  /** Libellé affiché à l'utilisateur. */
  label: string;
  /** Modèles d'URL de tuiles (placeholders {z}/{x}/{y}). Plusieurs = sous-domaines. */
  tiles: string[];
  /** Taille de tuile en pixels. */
  tileSize: number;
  /** Niveau de zoom max fourni par la source. */
  maxzoom: number;
  /** Texte d'attribution (obligatoire — conformité licence/CGU). */
  attribution: string;
}

/** Construit une URL WMTS-KVP GetTile de la Géoplateforme pour une couche/format donnés. */
function geopfWmtsUrl(layer: string, format: string): string {
  return (
    "https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile" +
    `&LAYER=${layer}&STYLE=normal&TILEMATRIXSET=PM` +
    `&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=${format}`
  );
}

/** Fond « Plan IGN v2 » — WMTS public de la Géoplateforme (sans clé). */
export const PLAN_IGN: RasterBasemap = {
  id: "plan-ign-v2",
  label: "Plan IGN",
  tiles: [geopfWmtsUrl("GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2", "image/png")],
  tileSize: 256,
  maxzoom: 19,
  attribution: "© IGN — Géoplateforme",
};

/** Fond « Photographies aériennes » (ortho IGN). */
export const ORTHO_IGN: RasterBasemap = {
  id: "ortho-ign",
  label: "Photo aérienne (IGN)",
  tiles: [geopfWmtsUrl("ORTHOIMAGERY.ORTHOPHOTOS", "image/jpeg")],
  tileSize: 256,
  maxzoom: 19,
  attribution: "© IGN — Géoplateforme",
};

/** Fond « OpenTopoMap » (topo communautaire). */
export const OPENTOPOMAP: RasterBasemap = {
  id: "opentopomap",
  label: "OpenTopoMap",
  tiles: [
    "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
    "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
    "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
  ],
  tileSize: 256,
  maxzoom: 17,
  attribution:
    "© OpenTopoMap (CC-BY-SA) — données © OpenStreetMap (ODbL)",
};

/** Fond « OpenStreetMap » standard. */
export const OSM: RasterBasemap = {
  id: "osm",
  label: "OpenStreetMap",
  tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
  tileSize: 256,
  maxzoom: 19,
  attribution: "© OpenStreetMap contributors",
};

/** Liste ordonnée des fonds disponibles. */
export const BASEMAPS: readonly RasterBasemap[] = [
  PLAN_IGN,
  ORTHO_IGN,
  OPENTOPOMAP,
  OSM,
];

/** Fond par défaut au démarrage. */
export const DEFAULT_BASEMAP_ID = PLAN_IGN.id;

/** Retourne un fond par son identifiant, ou `undefined` si inconnu. */
export function getBasemap(id: string): RasterBasemap | undefined {
  return BASEMAPS.find((b) => b.id === id);
}
