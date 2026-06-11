import { haversine } from "./stats";
import type { Track } from "../model";

/**
 * Données du profil altimétrique et pente par arête, pures et testées.
 * La distance est cumulée le long de la trace (sans pont entre segments disjoints).
 */

/**
 * Un point du profil : distance cumulée (m), altitude (m), position, et
 * métriques optionnelles (vitesse m/s, FC bpm, cadence) pour les activités.
 */
export interface ProfilePoint {
  distance: number;
  ele: number;
  lon: number;
  lat: number;
  /** Vitesse (m/s) : capteur si présent, sinon dérivée des horodatages. */
  speed?: number;
  /** Fréquence cardiaque (bpm), si capteur. */
  hr?: number;
  /** Cadence (rpm/spm), si capteur. */
  cadence?: number;
}

/** Construit le profil (points avec altitude + métriques) d'une trace. */
export function buildProfile(track: Track): ProfilePoint[] {
  const points: ProfilePoint[] = [];
  let cumulative = 0;
  for (const segment of track.segments) {
    for (let i = 0; i < segment.length; i++) {
      const p = segment[i]!;
      let edge = 0;
      if (i > 0) {
        edge = haversine(segment[i - 1]!, p);
        cumulative += edge;
      }
      if (p.ele === undefined) continue;
      const point: ProfilePoint = {
        distance: cumulative,
        ele: p.ele,
        lon: p.lon,
        lat: p.lat,
      };
      if (p.speed !== undefined) {
        point.speed = p.speed;
      } else if (i > 0 && p.time !== undefined && segment[i - 1]!.time !== undefined) {
        const dt = (Date.parse(p.time) - Date.parse(segment[i - 1]!.time!)) / 1000;
        if (Number.isFinite(dt) && dt > 0) point.speed = edge / dt;
      }
      if (p.hr !== undefined) point.hr = p.hr;
      if (p.cadence !== undefined) point.cadence = p.cadence;
      points.push(point);
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
