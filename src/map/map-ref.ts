import type { Map as MapLibreMap } from "maplibre-gl";
import type { Bbox } from "../core/tiles/tile-math";

/**
 * Référence vers l'unique instance de carte, pour permettre à des composants hors
 * de `MapView` (ex. panneau offline) de lire l'emprise/zoom courants sans prop-drilling.
 */
let current: MapLibreMap | null = null;

export function setMapInstance(map: MapLibreMap | null): void {
  current = map;
}

/** Emprise géographique visible, ou `null` si la carte n'est pas prête. */
export function getVisibleBbox(): Bbox | null {
  if (current === null) return null;
  const b = current.getBounds();
  return {
    minLon: b.getWest(),
    minLat: b.getSouth(),
    maxLon: b.getEast(),
    maxLat: b.getNorth(),
  };
}

/** Zoom courant arrondi, ou `null`. */
export function getCurrentZoom(): number | null {
  return current === null ? null : Math.round(current.getZoom());
}
