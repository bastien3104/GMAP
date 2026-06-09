import type { Feature, FeatureCollection, LineString } from "geojson";
import { slopeEdges } from "../geo/profile";
import type { Track } from "../model";

/** Propriétés d'une arête colorée par pente. */
export interface SlopeFeatureProperties {
  slope: number;
}

/** FeatureCollection d'arêtes (`LineString`) portant leur pente, pour la coloration. */
export function slopeFeatureCollection(track: Track): FeatureCollection {
  const features: Feature<LineString, SlopeFeatureProperties>[] = slopeEdges(track).map(
    (edge) => ({
      type: "Feature",
      geometry: { type: "LineString", coordinates: [edge.from, edge.to] },
      properties: { slope: edge.slope },
    }),
  );
  return { type: "FeatureCollection", features };
}
