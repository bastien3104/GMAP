import type { TrackPoint } from "../model";
import type { RoutedSegment } from "./itinerary";

/**
 * Client du serveur public BRouter (brouter.de) — routage sur le graphe OSM,
 * beaucoup plus riche en sentiers que la BD TOPO (singles, sentes, traces).
 *
 * Réponse : GeoJSON FeatureCollection ; les coordonnées portent l'altitude en
 * 3e composante (bonus : les segments routés OSM arrivent avec `ele`). Les
 * propriétés `track-length` et `total-time` sont des chaînes.
 */

/** Profils BRouter proposés dans l'app. */
export type BrouterProfile = "hiking-mountain" | "mtb" | "trekking";

const ENDPOINT = "https://brouter.de/brouter";

/** Construit l'URL de requête BRouter (`start`/`end` = [lon, lat]). */
export function buildBrouterUrl(
  profile: BrouterProfile,
  start: [number, number],
  end: [number, number],
): string {
  const params = new URLSearchParams({
    lonlats: `${start[0]},${start[1]}|${end[0]},${end[1]}`,
    profile,
    alternativeidx: "0",
    format: "geojson",
  });
  return `${ENDPOINT}?${params.toString()}`;
}

/** Extrait le segment routé d'une réponse GeoJSON BRouter. */
export function parseBrouterResponse(jsonText: string): RoutedSegment {
  const data: unknown = JSON.parse(jsonText);
  if (typeof data !== "object" || data === null) {
    throw new Error("Réponse BRouter invalide.");
  }
  const feature = (data as { features?: unknown[] }).features?.[0] as
    | {
        geometry?: { coordinates?: number[][] };
        properties?: Record<string, unknown>;
      }
    | undefined;
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length === 0) {
    throw new Error("Itinéraire BRouter sans géométrie.");
  }
  const points: TrackPoint[] = coords.map((c) => {
    const point: TrackPoint = { lon: Number(c[0]), lat: Number(c[1]) };
    if (typeof c[2] === "number" && Number.isFinite(c[2])) point.ele = c[2];
    return point;
  });
  const props = feature?.properties ?? {};
  const distance = Number(props["track-length"]);
  const duration = Number(props["total-time"]);
  return {
    points,
    distance: Number.isFinite(distance) ? distance : 0,
    duration: Number.isFinite(duration) ? duration : 0,
  };
}
