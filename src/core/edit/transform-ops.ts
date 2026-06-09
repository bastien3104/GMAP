import {
  createTrack,
  defaultTrackColor,
  type Project,
  type Track,
  type TrackPoint,
} from "../model";
import { haversine } from "../geo/stats";

/**
 * Transformations structurelles de traces, pures et immuables.
 * Utilisées par le store via `applyEdit` → réversibles (undo/redo).
 */

function replaceTrack(
  project: Project,
  id: string,
  fn: (track: Track) => Track,
): Project {
  return {
    ...project,
    tracks: project.tracks.map((t) => (t.id === id ? fn(t) : t)),
  };
}

/** Inverse le sens d'une trace (ordre des segments et des points). */
export function reverseTrack(project: Project, id: string): Project {
  return replaceTrack(project, id, (t) => ({
    ...t,
    segments: [...t.segments].reverse().map((seg) => [...seg].reverse()),
  }));
}

/** Convertit une trace en route (segments aplatis) ou inversement. */
export function convertTrackKind(project: Project, id: string): Project {
  return replaceTrack(project, id, (t) => {
    if (t.kind === "track") {
      return { ...t, kind: "route", segments: [t.segments.flat()] };
    }
    return { ...t, kind: "track" };
  });
}

/** Fusionne plusieurs traces en une seule (garde la 1re, concatène les segments). */
export function mergeTracks(project: Project, ids: string[]): Project {
  if (ids.length < 2) return project;
  const idSet = new Set(ids);
  const targets = project.tracks.filter((t) => idSet.has(t.id));
  if (targets.length < 2) return project;

  const first = targets[0]!;
  const merged: Track = { ...first, segments: targets.flatMap((t) => t.segments) };

  const tracks: Track[] = [];
  let placed = false;
  for (const t of project.tracks) {
    if (idSet.has(t.id)) {
      if (!placed) {
        tracks.push(merged);
        placed = true;
      }
    } else {
      tracks.push(t);
    }
  }
  return { ...project, tracks };
}

/** Découpe une trace en morceaux contigus tous les `intervalM` mètres. */
export function splitTrackByDistance(
  project: Project,
  id: string,
  intervalM: number,
): Project {
  if (intervalM <= 0) return project;
  const index = project.tracks.findIndex((t) => t.id === id);
  if (index < 0) return project;
  const track = project.tracks[index]!;
  const points = track.segments.flat();
  if (points.length < 2) return project;

  const pieces: TrackPoint[][] = [];
  let current: TrackPoint[] = [points[0]!];
  let cumulative = 0;
  let nextBoundary = intervalM;
  for (let i = 1; i < points.length; i++) {
    cumulative += haversine(points[i - 1]!, points[i]!);
    current.push(points[i]!);
    while (cumulative >= nextBoundary && current.length >= 2 && i < points.length - 1) {
      pieces.push(current);
      current = [points[i]!]; // point-frontière partagé
      nextBoundary += intervalM;
    }
  }
  pieces.push(current);
  if (pieces.length < 2) return project;

  const newTracks = pieces.map((segment, k) =>
    createTrack({
      name: `${track.name} (${k + 1})`,
      kind: track.kind,
      segments: [segment],
      color: defaultTrackColor(index + k),
    }),
  );
  return {
    ...project,
    tracks: [
      ...project.tracks.slice(0, index),
      ...newTracks,
      ...project.tracks.slice(index + 1),
    ],
  };
}
