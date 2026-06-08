/**
 * Math des tuiles Web Mercator (EPSG:3857, schéma XYZ « slippy map »).
 *
 * Fonctions pures et testées, partagées par l'UI (estimation du nombre de tuiles
 * avant téléchargement). L'énumération réelle au téléchargement est faite côté Rust.
 */

/** Emprise géographique en degrés (WGS84). */
export interface Bbox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

/** Plage de tuiles (indices XYZ) couvrant une emprise à un zoom donné. */
export interface TileRange {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Convertit lon/lat en indices de tuile XYZ (x, y) au zoom `z`. */
export function lonLatToTileXY(
  z: number,
  lon: number,
  lat: number,
): { x: number; y: number } {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n);
  const max = n - 1;
  return { x: clamp(x, 0, max), y: clamp(y, 0, max) };
}

/** Plage de tuiles couvrant `bbox` au zoom `z`. */
export function tileRangeForBbox(bbox: Bbox, z: number): TileRange {
  // Coin haut-gauche = (minLon, maxLat) ; bas-droit = (maxLon, minLat).
  const tl = lonLatToTileXY(z, bbox.minLon, bbox.maxLat);
  const br = lonLatToTileXY(z, bbox.maxLon, bbox.minLat);
  return {
    minX: Math.min(tl.x, br.x),
    maxX: Math.max(tl.x, br.x),
    minY: Math.min(tl.y, br.y),
    maxY: Math.max(tl.y, br.y),
  };
}

/** Nombre de tuiles couvrant `bbox` au zoom `z`. */
export function tileCountForZoom(bbox: Bbox, z: number): number {
  const r = tileRangeForBbox(bbox, z);
  return (r.maxX - r.minX + 1) * (r.maxY - r.minY + 1);
}

/** Nombre total de tuiles couvrant `bbox` sur la plage de zooms [minZoom, maxZoom]. */
export function tileCount(bbox: Bbox, minZoom: number, maxZoom: number): number {
  let total = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    total += tileCountForZoom(bbox, z);
  }
  return total;
}

/** Convertit un `y` XYZ en `tile_row` MBTiles (axe TMS inversé). */
export function tmsRow(z: number, y: number): number {
  return 2 ** z - 1 - y;
}
