import type { Track, TrackPoint } from "../model";

/**
 * Statistiques géométriques d'une trace, pures et testées (sans UI).
 * Distances en mètres, dénivelés en mètres, pentes en pourcentage.
 */

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Distance haversine (m) entre deux points. */
export function haversine(a: TrackPoint, b: TrackPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Statistiques agrégées d'une trace. */
export interface TrackStats {
  /** Distance totale (m). */
  distance: number;
  /** Dénivelé positif cumulé D+ (m). */
  ascent: number;
  /** Dénivelé négatif cumulé D- (m). */
  descent: number;
  /** Altitude minimale (m), ou `null` si aucune altitude. */
  eleMin: number | null;
  /** Altitude maximale (m), ou `null`. */
  eleMax: number | null;
  /** Pente moyenne (%) — dénivelé absolu cumulé / distance. */
  avgSlope: number;
  /** Pente maximale absolue (%). */
  maxSlope: number;
  /** Nombre total de points. */
  pointCount: number;
}

/**
 * Calcule les statistiques d'une trace.
 * @param gainThreshold seuil (m) sous lequel une variation d'altitude est ignorée
 *        pour D+/D- (réduction du bruit ; défaut 0). Le lissage complet arrive en Phase 6.
 */
export function trackStats(track: Track, gainThreshold = 0): TrackStats {
  let distance = 0;
  let ascent = 0;
  let descent = 0;
  let eleMin: number | null = null;
  let eleMax: number | null = null;
  let maxSlope = 0;
  let absEleSum = 0;
  let pointCount = 0;

  for (const segment of track.segments) {
    pointCount += segment.length;
    for (let i = 0; i < segment.length; i++) {
      const point = segment[i]!;
      if (point.ele !== undefined) {
        eleMin = eleMin === null ? point.ele : Math.min(eleMin, point.ele);
        eleMax = eleMax === null ? point.ele : Math.max(eleMax, point.ele);
      }
      if (i === 0) continue;
      const prev = segment[i - 1]!;
      const d = haversine(prev, point);
      distance += d;
      if (prev.ele !== undefined && point.ele !== undefined) {
        const dz = point.ele - prev.ele;
        if (dz > gainThreshold) ascent += dz;
        else if (dz < -gainThreshold) descent += -dz;
        absEleSum += Math.abs(dz);
        if (d >= 1) {
          const slope = Math.abs(dz / d) * 100;
          if (slope > maxSlope) maxSlope = slope;
        }
      }
    }
  }

  const avgSlope = distance > 0 ? (absEleSum / distance) * 100 : 0;
  return { distance, ascent, descent, eleMin, eleMax, avgSlope, maxSlope, pointCount };
}
