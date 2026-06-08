/**
 * Définition des fonds de carte (basemaps) disponibles.
 *
 * En Phase 0, seul le fond « Plan IGN v2 » (WMTS public, sans clé) est exposé.
 * Le sélecteur multi-fonds (Ortho, OpenTopoMap, OSM, SCAN25) arrive en Phase 2.
 *
 * Les fonds passent par WMTS (raster) et NON par WFS/WMS-V : une évolution de
 * ces derniers est annoncée pour mi-2026 côté Géoplateforme.
 *
 * Identifiants confirmés via GetCapabilities (data.geopf.fr/wmts) :
 *   - Couche      : GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2
 *   - Style       : normal
 *   - Format      : image/png
 *   - TileMatrixSet: PM (EPSG:3857, tuiles 256 px, niveaux 0 → 19)
 */

/** Description d'un fond de carte raster (tuiles XYZ/WMTS-KVP). */
export interface RasterBasemap {
  /** Identifiant logique stable. */
  id: string;
  /** Libellé affiché à l'utilisateur. */
  label: string;
  /** Modèles d'URL de tuiles (placeholders {z}/{x}/{y}). */
  tiles: string[];
  /** Taille de tuile en pixels. */
  tileSize: number;
  /** Niveau de zoom max fourni par la source. */
  maxzoom: number;
  /** Texte d'attribution (obligatoire — conformité licence). */
  attribution: string;
}

/** Fond « Plan IGN v2 » — WMTS public de la Géoplateforme (sans clé). */
export const PLAN_IGN: RasterBasemap = {
  id: "plan-ign-v2",
  label: "Plan IGN",
  tiles: [
    "https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile" +
      "&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM" +
      "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png",
  ],
  tileSize: 256,
  maxzoom: 19,
  attribution: "© IGN — Géoplateforme",
};

/** Liste ordonnée des fonds disponibles (Phase 0 : Plan IGN seul). */
export const BASEMAPS: readonly RasterBasemap[] = [PLAN_IGN];

/** Fond par défaut au démarrage. */
export const DEFAULT_BASEMAP_ID = PLAN_IGN.id;

/** Retourne un fond par son identifiant, ou `undefined` si inconnu. */
export function getBasemap(id: string): RasterBasemap | undefined {
  return BASEMAPS.find((b) => b.id === id);
}
