import { haversine } from "./stats";
import type { Track } from "../model";

/**
 * Données du profil altimétrique et pente par arête, pures et testées.
 * La distance est cumulée le long de la trace (sans pont entre segments disjoints).
 */

/** Un point du profil : distance cumulée (m), altitude (m), position. */
export interface ProfilePoint {
  distance: number;
  ele: number;
  lon: number;
  lat: number;
}

/** Construit le profil (points avec altitude) d'une trace. */
export function buildProfile(track: Track): ProfilePoint[] {
  const points: ProfilePoint[] = [];
  let cumulative = 0;
  for (const segment of track.segments) {
    for (let i = 0; i < segment.length; i++) {
      const p = segment[i]!;
      if (i > 0) cumulative += haversine(segment[i - 1]!, p);
      if (p.ele !== undefined) {
        points.push({ distance: cumulative, ele: p.ele, lon: p.lon, lat: p.lat });
      }
    }
  }
  return points;
}

/** Une arête colorable par sa pente (% signé : positif = montée). */
export interface SlopeEdge {
  from: [number, number];
  to: [number, number];
  slope: number;
}

/** Calcule la pente (% signé) de chaque arête d'une trace. */
export function slopeEdges(track: Track): SlopeEdge[] {
  const edges: SlopeEdge[] = [];
  for (const segment of track.segments) {
    for (let i = 1; i < segment.length; i++) {
      const a = segment[i - 1]!;
      const b = segment[i]!;
      const d = haversine(a, b);
      const slope =
        a.ele !== undefined && b.ele !== undefined && d >= 1
          ? ((b.ele - a.ele) / d) * 100
          : 0;
      edges.push({ from: [a.lon, a.lat], to: [b.lon, b.lat], slope });
    }
  }
  return edges;
}
