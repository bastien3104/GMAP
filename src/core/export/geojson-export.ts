import type { Feature, FeatureCollection, MultiLineString, Point } from "geojson";
import type { Project, Track, TrackPoint, Waypoint } from "../model";

/**
 * Export GeoJSON d'un projet (distinct de `projectToGeoJSON` qui sert au rendu carte).
 * Chaque trace devient un `MultiLineString` (segments), chaque waypoint un `Point` ;
 * l'altitude est incluse en 3e coordonnée quand elle existe. Pur et testé.
 */

function coord(p: TrackPoint | Waypoint): number[] {
  return p.ele !== undefined ? [p.lon, p.lat, p.ele] : [p.lon, p.lat];
}

function trackFeature(track: Track): Feature<MultiLineString> {
  return {
    type: "Feature",
    geometry: {
      type: "MultiLineString",
      coordinates: track.segments.map((seg) => seg.map(coord)),
    },
    properties: { name: track.name, kind: track.kind, color: track.color },
  };
}

function waypointFeature(wpt: Waypoint): Feature<Point> {
  const properties: Record<string, unknown> = { name: wpt.name };
  if (wpt.ele !== undefined) properties.ele = wpt.ele;
  if (wpt.time !== undefined) properties.time = wpt.time;
  if (wpt.note !== undefined) properties.note = wpt.note;
  if (wpt.symbol !== undefined) properties.symbol = wpt.symbol;
  return { type: "Feature", geometry: { type: "Point", coordinates: coord(wpt) }, properties };
}

/** Convertit un projet en `FeatureCollection` d'export. */
export function projectToGeoJsonExport(project: Project): FeatureCollection {
  const features: Feature[] = [];
  for (const track of project.tracks) features.push(trackFeature(track));
  for (const wpt of project.waypoints) features.push(waypointFeature(wpt));
  return { type: "FeatureCollection", features };
}

/** Sérialise un projet en chaîne GeoJSON (indentée). */
export function buildGeoJson(project: Project): string {
  return JSON.stringify(projectToGeoJsonExport(project), null, 2);
}
