import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import { iterateTrackPoints, type Project, type Track, type Waypoint } from "../model";

/**
 * Conversion modèle → GeoJSON, format pivot d'affichage pour MapLibre.
 *
 * Chaque segment de trace devient une `LineString` ; chaque waypoint un `Point`.
 * Les propriétés portent les métadonnées utiles au rendu (couleur, nom, type).
 */

/** Propriétés attachées aux features de trace. */
export interface TrackFeatureProperties {
  kind: "track-segment";
  trackId: string;
  trackKind: Track["kind"];
  name: string;
  color: string;
  segmentIndex: number;
}

/** Propriétés attachées aux features de waypoint. */
export interface WaypointFeatureProperties {
  kind: "waypoint";
  waypointId: string;
  name: string;
}

function segmentFeature(
  track: Track,
  segmentIndex: number,
  coordinates: number[][],
): Feature<LineString, TrackFeatureProperties> {
  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates },
    properties: {
      kind: "track-segment",
      trackId: track.id,
      trackKind: track.kind,
      name: track.name,
      color: track.color,
      segmentIndex,
    },
  };
}

function waypointFeature(wpt: Waypoint): Feature<Point, WaypointFeatureProperties> {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [wpt.lon, wpt.lat] },
    properties: { kind: "waypoint", waypointId: wpt.id, name: wpt.name },
  };
}

/** Convertit un `Project` en `FeatureCollection` (traces visibles + waypoints). */
export function projectToGeoJSON(project: Project): FeatureCollection {
  const features: Feature[] = [];

  for (const track of project.tracks) {
    if (!track.visible) continue;
    track.segments.forEach((segment, segmentIndex) => {
      if (segment.length < 2) return; // une LineString a besoin d'au moins 2 points
      const coordinates = segment.map((p) => [p.lon, p.lat]);
      features.push(segmentFeature(track, segmentIndex, coordinates));
    });
  }

  for (const wpt of project.waypoints) {
    features.push(waypointFeature(wpt));
  }

  return { type: "FeatureCollection", features };
}

/** Bornes géographiques [minLon, minLat, maxLon, maxLat] d'un projet, ou `null` si vide. */
export function projectBounds(
  project: Project,
): [number, number, number, number] | null {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  let has = false;

  const consider = (lon: number, lat: number): void => {
    has = true;
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  };

  for (const track of project.tracks) {
    for (const point of iterateTrackPoints(track)) consider(point.lon, point.lat);
  }
  for (const wpt of project.waypoints) consider(wpt.lon, wpt.lat);

  return has ? [minLon, minLat, maxLon, maxLat] : null;
}
