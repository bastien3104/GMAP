import { haversine } from "./stats";
import type { Track, TrackPoint } from "../model";

/**
 * Lissage GPS, pur et testé : retrait des points aberrants (sauts > maxJump) puis
 * moyenne glissante (lon/lat/ele). Les extrémités sont conservées.
 */

export interface SmoothOptions {
  /** Taille de la fenêtre glissante (rendue impaire). */
  windowSize: number;
  /** Saut maximal toléré entre deux points (m) ; au-delà = point aberrant retiré. */
  maxJumpM: number;
}

function removeOutliers(points: TrackPoint[], maxJumpM: number): TrackPoint[] {
  if (maxJumpM <= 0 || points.length < 2) return points;
  const out: TrackPoint[] = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    if (haversine(out[out.length - 1]!, points[i]!) <= maxJumpM) {
      out.push(points[i]!);
    }
  }
  return out;
}

function movingAverage(points: TrackPoint[], windowSize: number): TrackPoint[] {
  const w = windowSize % 2 === 0 ? windowSize + 1 : windowSize;
  const k = (Math.max(1, w) - 1) / 2;
  if (k === 0 || points.length < 3) return points;
  return points.map((p, i) => {
    if (i === 0 || i === points.length - 1) return p; // extrémités fixes
    let lon = 0;
    let lat = 0;
    let count = 0;
    let eleSum = 0;
    let eleCount = 0;
    for (let j = Math.max(0, i - k); j <= Math.min(points.length - 1, i + k); j++) {
      const q = points[j]!;
      lon += q.lon;
      lat += q.lat;
      count += 1;
      if (q.ele !== undefined) {
        eleSum += q.ele;
        eleCount += 1;
      }
    }
    const next: TrackPoint = { ...p, lon: lon / count, lat: lat / count };
    if (p.ele !== undefined && eleCount > 0) next.ele = eleSum / eleCount;
    return next;
  });
}

/** Lisse chaque segment d'une trace. */
export function smoothTrack(track: Track, options: SmoothOptions): Track {
  return {
    ...track,
    segments: track.segments.map((seg) =>
      movingAverage(removeOutliers(seg, options.maxJumpM), options.windowSize),
    ),
  };
}
