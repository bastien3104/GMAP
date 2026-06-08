import type { Project, TrackPoint } from "../model";

/**
 * Opérations d'édition au niveau des points (sommets), pures et immuables.
 *
 * Chaque fonction renvoie un nouveau `Project` (segments/points non touchés partagés).
 * Utilisées par le store via `applyEdit` → annulables (undo/redo).
 */

/**
 * Applique `fn` au segment ciblé d'une trace. Renvoie le **même** projet si `fn`
 * ne change rien (pas d'entrée d'historique inutile).
 */
function mapSegment(
  project: Project,
  trackId: string,
  segmentIndex: number,
  fn: (segment: TrackPoint[]) => TrackPoint[],
): Project {
  let changed = false;
  const tracks = project.tracks.map((track) => {
    if (track.id !== trackId) return track;
    let segmentChanged = false;
    const segments = track.segments.map((segment, index) => {
      if (index !== segmentIndex) return segment;
      const next = fn(segment);
      if (next !== segment) segmentChanged = true;
      return next;
    });
    if (!segmentChanged) return track;
    changed = true;
    return { ...track, segments };
  });
  return changed ? { ...project, tracks } : project;
}

/** Déplace un point (préserve `ele`/`time`). */
export function movePoint(
  project: Project,
  trackId: string,
  segmentIndex: number,
  pointIndex: number,
  lon: number,
  lat: number,
): Project {
  return mapSegment(project, trackId, segmentIndex, (segment) => {
    const point = segment[pointIndex];
    if (point === undefined) return segment;
    const next = [...segment];
    next[pointIndex] = { ...point, lon, lat };
    return next;
  });
}

/** Insère un point à l'index donné dans un segment (index borné). */
export function insertPoint(
  project: Project,
  trackId: string,
  segmentIndex: number,
  pointIndex: number,
  point: TrackPoint,
): Project {
  return mapSegment(project, trackId, segmentIndex, (segment) => {
    const index = Math.max(0, Math.min(pointIndex, segment.length));
    const next = [...segment];
    next.splice(index, 0, point);
    return next;
  });
}

/** Supprime un point d'un segment. */
export function deletePoint(
  project: Project,
  trackId: string,
  segmentIndex: number,
  pointIndex: number,
): Project {
  return mapSegment(project, trackId, segmentIndex, (segment) => {
    if (pointIndex < 0 || pointIndex >= segment.length) return segment;
    return segment.filter((_, index) => index !== pointIndex);
  });
}

/** Point milieu d'une arête (moyenne lon/lat ; `ele` moyenne si connue des deux côtés). */
export function midpoint(a: TrackPoint, b: TrackPoint): TrackPoint {
  const point: TrackPoint = {
    lon: (a.lon + b.lon) / 2,
    lat: (a.lat + b.lat) / 2,
  };
  if (a.ele !== undefined && b.ele !== undefined) {
    point.ele = (a.ele + b.ele) / 2;
  }
  return point;
}
