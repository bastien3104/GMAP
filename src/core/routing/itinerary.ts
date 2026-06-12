import { invoke, isTauri } from "@tauri-apps/api/core";
import type { TrackPoint } from "../model";
import { haversine } from "../geo/stats";
import { buildBrouterUrl, parseBrouterResponse, type BrouterProfile } from "./brouter";

/**
 * Client du service d'itinéraire online de la Géoplateforme (snap-to-path).
 *
 * L'appel réseau passe par la commande Rust `route_online` sous Tauri (évite le CORS) ;
 * en dev navigateur, `fetch` direct. Le parsing de la réponse est pur et testé.
 */

/**
 * Profils de routage online :
 * - `pedestrian` (à pied) : combiné — IGN piéton + BRouter rando montagne +
 *   BRouter VTT interrogés en parallèle, le segment le plus court gagne ;
 * - `car` (voiture) : IGN BD TOPO ;
 * - `bike` (vélo de route) : BRouter trekking (graphe OSM).
 */
export type RoutingProfile = "pedestrian" | "car" | "bike";

/** Segment routé : géométrie + métriques. */
export interface RoutedSegment {
  points: TrackPoint[];
  distance: number; // mètres
  duration: number; // secondes
}

const ENDPOINT = "https://data.geopf.fr/navigation/itineraire";

/** Construit l'URL de requête d'itinéraire IGN (`start`/`end` = [lon, lat]). */
export function buildItineraryUrl(
  profile: "pedestrian" | "car",
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

/** Longueur effective d'un segment : distance annoncée, sinon somme des arêtes. */
export function segmentLength(segment: RoutedSegment): number {
  if (segment.distance > 0) return segment.distance;
  let sum = 0;
  for (let i = 1; i < segment.points.length; i++) {
    sum += haversine(segment.points[i - 1]!, segment.points[i]!);
  }
  return sum;
}

/**
 * Retient le plus court des segments candidats (réponses des différents
 * graphes) ; lève si aucun candidat n'a abouti.
 */
export function pickShortestSegment(
  results: Array<PromiseSettledResult<RoutedSegment>>,
): RoutedSegment {
  let best: RoutedSegment | null = null;
  let bestLength = Infinity;
  for (const result of results) {
    if (result.status !== "fulfilled" || result.value.points.length === 0) continue;
    const length = segmentLength(result.value);
    if (length < bestLength) {
      best = result.value;
      bestLength = length;
    }
  }
  if (best === null) throw new Error("Aucun itinéraire trouvé.");
  return best;
}

/** Route un segment sur le graphe IGN BD TOPO. */
async function routeIgn(
  profile: "pedestrian" | "car",
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

/** Route un segment sur le graphe OSM via BRouter. */
async function routeBrouter(
  profile: BrouterProfile,
  start: [number, number],
  end: [number, number],
): Promise<RoutedSegment> {
  let jsonText: string;
  if (isTauri()) {
    jsonText = await invoke<string>("route_brouter", { profile, start, end });
  } else {
    const response = await fetch(buildBrouterUrl(profile, start, end));
    if (!response.ok) throw new Error(`Serveur BRouter : HTTP ${response.status}`);
    jsonText = await response.text();
  }
  return parseBrouterResponse(jsonText);
}

/**
 * Calcule un segment routé entre deux points selon le profil :
 * - à pied : IGN piéton + BRouter rando + BRouter VTT en parallèle, le plus
 *   court l'emporte (c'est par définition le tracé voulu) ;
 * - voiture : IGN ; vélo : BRouter trekking.
 * Sous Tauri, les appels HTTP passent par les commandes Rust (évite le CORS).
 */
export async function routeSegment(
  profile: RoutingProfile,
  start: [number, number],
  end: [number, number],
): Promise<RoutedSegment> {
  if (profile === "car") return routeIgn("car", start, end);
  if (profile === "bike") return routeBrouter("trekking", start, end);
  const results = await Promise.allSettled([
    routeIgn("pedestrian", start, end),
    routeBrouter("hiking-mountain", start, end),
    routeBrouter("mtb", start, end),
  ]);
  return pickShortestSegment(results);
}
