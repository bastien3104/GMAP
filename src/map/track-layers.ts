import type {
  CircleLayerSpecification,
  LineLayerSpecification,
} from "maplibre-gl";

/** Source GeoJSON et couches MapLibre pour les données du projet (traces + waypoints). */

export const PROJECT_SOURCE_ID = "project-data";
export const TRACK_LINE_LAYER_ID = "project-track-lines";
export const WAYPOINT_CIRCLE_LAYER_ID = "project-waypoints";

/** Couche des segments de trace (couleur portée par la feature). */
export const trackLineLayer: LineLayerSpecification = {
  id: TRACK_LINE_LAYER_ID,
  type: "line",
  source: PROJECT_SOURCE_ID,
  filter: ["==", ["get", "kind"], "track-segment"],
  layout: { "line-join": "round", "line-cap": "round" },
  paint: {
    "line-color": ["get", "color"],
    "line-width": 3,
  },
};

/** Couche des waypoints (petits cercles). */
export const waypointCircleLayer: CircleLayerSpecification = {
  id: WAYPOINT_CIRCLE_LAYER_ID,
  type: "circle",
  source: PROJECT_SOURCE_ID,
  filter: ["==", ["get", "kind"], "waypoint"],
  paint: {
    "circle-radius": 5,
    "circle-color": "#ffffff",
    "circle-stroke-color": "#d62828",
    "circle-stroke-width": 2,
  },
};
