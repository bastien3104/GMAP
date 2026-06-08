import type { CircleLayerSpecification } from "maplibre-gl";
import type { Feature, FeatureCollection, Point } from "geojson";
import { midpoint } from "../core/edit/point-ops";
import type { Track } from "../core/model";

/** Sources et couches MapLibre des poignées d'édition (sommets + milieux d'arête). */

export const VERTICES_SOURCE_ID = "edit-vertices";
export const MIDPOINTS_SOURCE_ID = "edit-midpoints";
export const VERTICES_LAYER_ID = "edit-vertices-layer";
export const MIDPOINTS_LAYER_ID = "edit-midpoints-layer";

/** Poignées de sommets (déplaçables ; surbrillance du sommet sélectionné). */
export const verticesLayer: CircleLayerSpecification = {
  id: VERTICES_LAYER_ID,
  type: "circle",
  source: VERTICES_SOURCE_ID,
  paint: {
    "circle-radius": ["case", ["get", "selected"], 7, 5],
    "circle-color": ["case", ["get", "selected"], "#ffcc00", "#ffffff"],
    "circle-stroke-color": "#0077b6",
    "circle-stroke-width": 2,
  },
};

/** Poignées de milieu d'arête (clic = insérer un point). */
export const midpointsLayer: CircleLayerSpecification = {
  id: MIDPOINTS_LAYER_ID,
  type: "circle",
  source: MIDPOINTS_SOURCE_ID,
  paint: {
    "circle-radius": 4,
    "circle-color": "#0077b6",
    "circle-opacity": 0.6,
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 1,
  },
};

/** Sommet sélectionné (pour la surbrillance / suppression). */
export interface SelectedVertex {
  segmentIndex: number;
  pointIndex: number;
}

interface VertexProps {
  segmentIndex: number;
  pointIndex: number;
  selected: boolean;
}

interface MidpointProps {
  segmentIndex: number;
  insertIndex: number;
}

/** Construit les features de poignées (sommets + milieux) pour une trace. */
export function buildEditFeatures(
  track: Track,
  selected: SelectedVertex | null,
): { vertices: FeatureCollection; midpoints: FeatureCollection } {
  const vertices: Feature<Point, VertexProps>[] = [];
  const midpoints: Feature<Point, MidpointProps>[] = [];

  track.segments.forEach((segment, segmentIndex) => {
    segment.forEach((point, pointIndex) => {
      vertices.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [point.lon, point.lat] },
        properties: {
          segmentIndex,
          pointIndex,
          selected:
            selected !== null &&
            selected.segmentIndex === segmentIndex &&
            selected.pointIndex === pointIndex,
        },
      });
    });
    for (let i = 0; i < segment.length - 1; i++) {
      const m = midpoint(segment[i]!, segment[i + 1]!);
      midpoints.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [m.lon, m.lat] },
        properties: { segmentIndex, insertIndex: i + 1 },
      });
    }
  });

  return {
    vertices: { type: "FeatureCollection", features: vertices },
    midpoints: { type: "FeatureCollection", features: midpoints },
  };
}
