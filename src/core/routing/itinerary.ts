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

/** Moteurs interrogés par le profil « à pied ». */
export type RoutingEngine = "ign" | "osm-hiking" | "osm-mtb";

/** Un candidat : le segment routé et le moteur qui l'a produit. */
export interface RoutedCandidate {
  engine: RoutingEngine;
  segment: RoutedSegment;
}

/** Projette `p` en mètres dans un plan local centré sur `origin` ([lon, lat]). */
function localXY(origin: [number, number], p: TrackPoint): [number, number] {
  const kLat = 111_320; // m / degré de latitude
  const kLon = kLat * Math.cos((origin[1] * Math.PI) / 180);
  return [(p.lon - origin[0]) * kLon, (p.lat - origin[1]) * kLat];
}

/** Distance (m) d'un point à la corde ancre→clic (segment, pas droite infinie). */
function distanceToChord(
  anchor: [number, number],
  click: [number, number],
  p: TrackPoint,
): number {
  const [ax, ay] = [0, 0];
  const [bx, by] = localXY(anchor, { lon: click[0], lat: click[1] });
  const [px, py] = localXY(anchor, p);
  const abLen2 = (bx - ax) ** 2 + (by - ay) ** 2;
  const t =
    abLen2 === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / abLen2));
  const cx = ax + t * (bx - ax);
  const cy = ay + t * (by - ay);
  return Math.hypot(px - cx, py - cy);
}

/**
 * Score de cohérence d'un candidat (plus petit = mieux) :
 * - continuité (poids fort) : écart entre l'ancre/le clic demandés et les
 *   extrémités réelles du segment — un moteur qui a raccroché ailleurs est
 *   éliminé d'office ;
 * - corridor : écart moyen du tracé à la corde ancre→clic — les ancres suivent
 *   le sentier de proche en proche, une grande boucle s'en éloigne ;
 * - détour : pénalité douce sur (longueur − corde), simple départage.
 */
export function coherenceScore(
  anchor: [number, number],
  click: [number, number],
  segment: RoutedSegment,
): number {
  const first = segment.points[0]!;
  const last = segment.points[segment.points.length - 1]!;
  const anchorPt: TrackPoint = { lon: anchor[0], lat: anchor[1] };
  const clickPt: TrackPoint = { lon: click[0], lat: click[1] };
  const snap = haversine(anchorPt, first) + haversine(clickPt, last);

  let devSum = 0;
  for (const p of segment.points) devSum += distanceToChord(anchor, click, p);
  const meanDev = devSum / segment.points.length;

  const chord = haversine(anchorPt, clickPt);
  const detour = Math.max(0, segmentLength(segment) - chord);

  return 4 * snap + 2 * meanDev + detour;
}

/**
 * Retient le candidat le plus cohérent avec le geste (ancre → clic). Hystérésis :
 * à score quasi égal (15 % + 10 m), le moteur du segment précédent est conservé
 * pour éviter les raccords en zigzag aux ancres. Lève si aucun candidat.
 */
export function pickCoherentSegment(
  anchor: [number, number],
  click: [number, number],
  candidates: RoutedCandidate[],
  previousEngine: RoutingEngine | null = null,
): RoutedCandidate {
  const valid = candidates.filter((c) => c.segment.points.length > 0);
  if (valid.length === 0) throw new Error("Aucun itinéraire trouvé.");

  let best = valid[0]!;
  let bestScore = coherenceScore(anchor, click, best.segment);
  const scores = new Map<RoutingEngine, number>([[best.engine, bestScore]]);
  for (const candidate of valid.slice(1)) {
    const score = coherenceScore(anchor, click, candidate.segment);
    scores.set(candidate.engine, score);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  if (previousEngine !== null && best.engine !== previousEngine) {
    const previous = valid.find((c) => c.engine === previousEngine);
    const previousScore = previous !== undefined ? scores.get(previousEngine) : undefined;
    if (previous !== undefined && previousScore !== undefined) {
      if (previousScore <= bestScore * 1.15 + 10) return previous;
    }
  }
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

/** Moteur retenu pour le dernier segment « à pied » (hystérésis entre clics). */
let lastFootEngine: RoutingEngine | null = null;

/**
 * Calcule un segment routé entre deux points selon le profil :
 * - à pied : IGN piéton + BRouter rando + BRouter VTT en parallèle, le candidat
 *   le plus cohérent avec le geste l'emporte (continuité aux ancres, corridor,
 *   détour) avec hystérésis sur le moteur précédent ;
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

  const engines: RoutingEngine[] = ["ign", "osm-hiking", "osm-mtb"];
  const settled = await Promise.allSettled([
    routeIgn("pedestrian", start, end),
    routeBrouter("hiking-mountain", start, end),
    routeBrouter("mtb", start, end),
  ]);
  const candidates: RoutedCandidate[] = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value.points.length > 0) {
      candidates.push({ engine: engines[i]!, segment: result.value });
    }
  });
  const picked = pickCoherentSegment(start, end, candidates, lastFootEngine);
  lastFootEngine = picked.engine;
  return picked.segment;
}
