import { createTrack, type Project, type Track, type TrackPoint } from "../model";

/**
 * Opérations de dessin (création d'une trace par ajout de points), pures et immuables.
 * Utilisées par le store via `applyEdit` → réversibles (undo/redo).
 */

/** Crée une trace de dessin vide (un segment, prête à recevoir des points). */
export function createDrawingTrack(name = "Nouveau tracé"): Track {
  return createTrack({ name, segments: [[]] });
}

/** Ajoute une trace au projet. */
export function addTrack(project: Project, track: Track): Project {
  return { ...project, tracks: [...project.tracks, track] };
}

/** Ajoute des points à la fin du dernier segment d'une trace (en crée un si besoin). */
function appendToLastSegment(
  project: Project,
  trackId: string,
  points: TrackPoint[],
): Project {
  if (points.length === 0) return project;
  return {
    ...project,
    tracks: project.tracks.map((track) => {
      if (track.id !== trackId) return track;
      const segments =
        track.segments.length > 0 ? [...track.segments] : [[] as TrackPoint[]];
      const lastIndex = segments.length - 1;
      segments[lastIndex] = [...(segments[lastIndex] ?? []), ...points];
      return { ...track, segments };
    }),
  };
}

/** Ajoute un point à la fin du dernier segment d'une trace. */
export function appendPoint(
  project: Project,
  trackId: string,
  point: TrackPoint,
): Project {
  return appendToLastSegment(project, trackId, [point]);
}

/** Ajoute plusieurs points (tracé freehand) en une opération. */
export function appendPoints(
  project: Project,
  trackId: string,
  points: TrackPoint[],
): Project {
  return appendToLastSegment(project, trackId, points);
}
