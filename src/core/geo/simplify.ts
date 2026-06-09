import type { Track, TrackPoint } from "../model";

/**
 * Simplification Douglas-Peucker, pure et testée.
 * La distance perpendiculaire est calculée en mètres (projection équirectangulaire
 * locale) pour une tolérance cohérente quelle que soit la latitude.
 */

const EARTH_RADIUS_M = 6_371_000;

function toLocalXY(p: TrackPoint, lat0Rad: number): [number, number] {
  const x = (p.lon * Math.PI) / 180 * Math.cos(lat0Rad) * EARTH_RADIUS_M;
  const y = ((p.lat * Math.PI) / 180) * EARTH_RADIUS_M;
  return [x, y];
}

/** Distance perpendiculaire (m) de `p` à la droite (a, b). */
function perpDistanceM(p: TrackPoint, a: TrackPoint, b: TrackPoint): number {
  const lat0 = (a.lat * Math.PI) / 180;
  const [px, py] = toLocalXY(p, lat0);
  const [ax, ay] = toLocalXY(a, lat0);
  const [bx, by] = toLocalXY(b, lat0);
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = ((px - ax) * dx + (py - ay) * dy) / len2;
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return Math.hypot(px - projX, py - projY);
}

/** Douglas-Peucker (itératif) sur une liste de points. */
function rdp(points: TrackPoint[], toleranceM: number): TrackPoint[] {
  if (points.length < 3) return [...points];
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let maxDist = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = perpDistanceM(points[i]!, points[start]!, points[end]!);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (maxDist > toleranceM && index !== -1) {
      keep[index] = true;
      stack.push([start, index]);
      stack.push([index, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Simplifie chaque segment d'une trace (Douglas-Peucker, tolérance en mètres). */
export function simplifyTrack(track: Track, toleranceM: number): Track {
  if (toleranceM <= 0) return track;
  return {
    ...track,
    segments: track.segments.map((seg) =>
      seg.length > 2 ? rdp(seg, toleranceM) : seg,
    ),
  };
}
