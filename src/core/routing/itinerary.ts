import { invoke, isTauri } from "@tauri-apps/api/core";
import type { TrackPoint } from "../model";

/**
 * Client du service d'itinéraire online de la Géoplateforme (snap-to-path).
 *
 * L'appel réseau passe par la commande Rust `route_online` sous Tauri (évite le CORS) ;
 * en dev navigateur, `fetch` direct. Le parsing de la réponse est pur et testé.
 */

/** Profils de routage online supportés. */
export type RoutingProfile = "pedestrian" | "car";

/** Segment routé : géométrie + métriques. */
export interface RoutedSegment {
  points: TrackPoint[];
  distance: number; // mètres
  duration: number; // secondes
}

const ENDPOINT = "https://data.geopf.fr/navigation/itineraire";

/** Construit l'URL de requête d'itinéraire (`start`/`end` = [lon, lat]). */
export function buildItineraryUrl(
  profile: RoutingProfile,
  start: [number, number],
  end: [number, number],
): string {
  const params = new URLSearchParams({
    resource: "bdtopo-osrm",
    profile,
    optimization: "shortest",
    start: `${start[0]},${start[1]}`,
    end: `${end[0]},${end[1]}`,
    geometryFormat: "geojson",
  });
  return `${ENDPOINT}?${params.toString()}`;
}

/** Extrait le segment routé de la réponse JSON de la Géoplateforme. */
export function parseItineraryResponse(jsonText: string): RoutedSegment {
  const data: unknown = JSON.parse(jsonText);
  if (typeof data !== "object" || data === null) {
    throw new Error("Réponse d'itinéraire invalide.");
  }
  const obj = data as {
    geometry?: { coordinates?: number[][] };
    distance?: unknown;
    duration?: unknown;
  };
  const coords = obj.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length === 0) {
    throw new Error("Itinéraire sans géométrie.");
  }
  const points: TrackPoint[] = coords.map((c) => ({
    lon: Number(c[0]),
    lat: Number(c[1]),
  }));
  return {
    points,
    distance: typeof obj.distance === "number" ? obj.distance : 0,
    duration: typeof obj.duration === "number" ? obj.duration : 0,
  };
}

/** Calcule un segment routé entre deux points (sous Tauri : commande Rust ; sinon fetch). */
export async function routeSegment(
  profile: RoutingProfile,
  start: [number, number],
  end: [number, number],
): Promise<RoutedSegment> {
  let jsonText: string;
  if (isTauri()) {
    jsonText = await invoke<string>("route_online", { profile, start, end });
  } else {
    const response = await fetch(buildItineraryUrl(profile, start, end));
    if (!response.ok) throw new Error(`Service d'itinéraire : HTTP ${response.status}`);
    jsonText = await response.text();
  }
  return parseItineraryResponse(jsonText);
}
