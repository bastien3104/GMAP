import type { Track } from "../model";

/**
 * Suppression des pics d'altitude aberrants, pure et testée.
 * Une altitude isolée trop éloignée de l'interpolation de ses voisins est remplacée
 * par cette interpolation (les coordonnées ne changent pas).
 */

/** Seuil par défaut (m) au-delà duquel un point est considéré comme un pic. */
export const DEFAULT_SPIKE_THRESHOLD_M = 25;

/** Remplace les altitudes en pic par l'interpolation de leurs voisins. */
export function removeElevationSpikes(
  track: Track,
  thresholdM: number = DEFAULT_SPIKE_THRESHOLD_M,
): Track {
  if (thresholdM <= 0) return track;
  return {
    ...track,
    segments: track.segments.map((seg) => {
      if (seg.length < 3) return seg;
      return seg.map((p, i) => {
        if (i === 0 || i === seg.length - 1) return p;
        const prev = seg[i - 1]!;
        const next = seg[i + 1]!;
        if (p.ele === undefined || prev.ele === undefined || next.ele === undefined) {
          return p;
        }
        const interpolated = (prev.ele + next.ele) / 2;
        if (Math.abs(p.ele - interpolated) > thresholdM) {
          return { ...p, ele: Math.round(interpolated * 10) / 10 };
        }
        return p;
      });
    }),
  };
}
