import { invoke, isTauri } from "@tauri-apps/api/core";
import type { TrackPoint } from "../model";
import { buildBrouterUrl, parseBrouterResponse, type BrouterProfile } from "./brouter";

/**
 * Client du service d'itinéraire online de la Géoplateforme (snap-to-path).
 *
 * L'appel réseau passe par la commande Rust `route_online` sous Tauri (évite le CORS) ;
 * en dev navigateur, `fetch` direct. Le parsing de la réponse est pur et testé.
 */

/**
 * Profils de routage online supportés : graphe IGN BD TOPO (`pedestrian`/`car`)
 * ou graphe OSM via BRouter (`osm-*`), plus riche en sentiers.
 */
export type RoutingProfile =
  | "pedestrian"
  | "car"
  | "osm-hiking"
  | "osm-mtb"
  | "osm-bike";

/** Profil app → profil du serveur BRouter (`null` = profil IGN). */
export const BROUTER_PROFILE_BY_ROUTING: Record<RoutingProfile, BrouterProfile | null> = {
  pedestrian: null,
  car: null,
  "osm-hiking": "hiking-mountain",
  "osm-mtb": "mtb",
  "osm-bike": "trekking",
};

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

/**
 * Calcule un segment routé entre deux points, sur le graphe choisi par le
 * profil : IGN BD TOPO ou OSM (BRouter). Sous Tauri, l'appel HTTP passe par la
 * commande Rust correspondante (évite le CORS) ; en dev navigateur, fetch direct.
 */
export async function routeSegment(
  profile: RoutingProfile,
  start: [number, number],
  end: [number, number],
): Promise<RoutedSegment> {
  const brouterProfile = BROUTER_PROFILE_BY_ROUTING[profile];
  let jsonText: string;
  if (brouterProfile !== null) {
    if (isTauri()) {
      jsonText = await invoke<string>("route_brouter", {
        profile: brouterProfile,
        start,
        end,
      });
    } else {
      const response = await fetch(buildBrouterUrl(brouterProfile, start, end));
      if (!response.ok) throw new Error(`Serveur BRouter : HTTP ${response.status}`);
      jsonText = await response.text();
    }
    return parseBrouterResponse(jsonText);
  }

  const ignProfile = profile === "car" ? "car" : "pedestrian";
  if (isTauri()) {
    jsonText = await invoke<string>("route_online", { profile: ignProfile, start, end });
  } else {
    const response = await fetch(buildItineraryUrl(ignProfile, start, end));
    if (!response.ok) throw new Error(`Service d'itinéraire : HTTP ${response.status}`);
    jsonText = await response.text();
  }
  return parseItineraryResponse(jsonText);
}
