import type { LineLayerSpecification } from "maplibre-gl";

/**
 * Source GeoJSON et couches MapLibre pour les traces du projet.
 *
 * Les waypoints (POI) sont rendus via des marqueurs DOM (`maplibregl.Marker`) dans
 * `MapView` — glyphe + nom, déplaçables — plutôt que par une couche symbole (qui
 * exigerait une URL `glyphs`, incompatible avec le mode hors-ligne).
 */

export const PROJECT_SOURCE_ID = "project-data";
export const TRACK_LINE_LAYER_ID = "project-track-lines";

/** Couche des segments de trace (couleur portée par la feature). */
export const trackLineLayer: LineLayerSpecification = {
  id: TRACK_LINE_LAYER_ID,
  type: "line",
  source: PROJECT_SOURCE_ID,
  filter: ["==", ["get", "kind"], "track-segment"],
  layout: { "line-join": "round", "line-cap": "round" },
  paint: {
    "line-color": ["get", "color"],
    // Trace sélectionnée plus épaisse (surbrillance).
    "line-width": ["case", ["get", "selected"], 6, 3],
  },
};
