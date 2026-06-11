import type { Project, Track } from "../model";

/**
 * Opérations d'édition propres aux activités (traces horodatées), pures et
 * immuables : recadrage temporel (suppression des minutes de parking au début
 * et/ou à la fin). L'historique undo/redo est géré par le store (applyEdit).
 */

/** Bornes temporelles (epoch s) d'une trace horodatée, ou `null`. */
export function trackTimeBounds(
  track: Track,
): { start: number; end: number } | null {
  let start: number | null = null;
  let end: number | null = null;
  for (const segment of track.segments) {
    for (const p of segment) {
      if (p.time === undefined) continue;
      const t = Date.parse(p.time) / 1000;
      if (Number.isNaN(t)) continue;
      if (start === null || t < start) start = t;
      if (end === null || t > end) end = t;
    }
  }
  return start !== null && end !== null && end > start ? { start, end } : null;
}

/**
 * Recadre une trace dans le temps : supprime les points antérieurs à
 * `début + trimStartS` et postérieurs à `fin − trimEndS`. Les points sans
 * horodatage sont conservés. Renvoie le projet inchangé si la trace n'est pas
 * horodatée ou si le recadrage viderait la trace.
 */
export function trimTrackTime(
  project: Project,
  trackId: string,
  trimStartS: number,
  trimEndS: number,
): Project {
  if (trimStartS <= 0 && trimEndS <= 0) return project;
  const track = project.tracks.find((t) => t.id === trackId);
  if (track === undefined) return project;
  const bounds = trackTimeBounds(track);
  if (bounds === null) return project;

  const from = bounds.start + Math.max(0, trimStartS);
  const to = bounds.end - Math.max(0, trimEndS);
  if (to <= from) return project;

  const segments = track.segments
    .map((segment) =>
      segment.filter((p) => {
        if (p.time === undefined) return true;
        const t = Date.parse(p.time) / 1000;
        if (Number.isNaN(t)) return true;
        return t >= from && t <= to;
      }),
    )
    .filter((segment) => segment.length > 0);

  const kept = segments.reduce((sum, s) => sum + s.length, 0);
  if (kept < 2) return project;
  const before = track.segments.reduce((sum, s) => sum + s.length, 0);
  if (kept === before) return project;

  return {
    ...project,
    tracks: project.tracks.map((t) =>
      t.id === trackId ? { ...t, segments } : t,
    ),
  };
}
