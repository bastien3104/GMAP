import type { Project, Track } from "../model";

/**
 * Opérations d'édition au niveau des traces (calques), pures et immuables.
 *
 * Chaque fonction renvoie un nouveau `Project` (les traces non modifiées sont
 * partagées par référence → coût mémoire faible). Utilisées par le store via
 * `applyEdit`, ce qui les rend annulables (undo/redo).
 */

/** Applique `fn` à la trace d'identifiant `id`, renvoie un nouveau projet. */
function mapTrack(
  project: Project,
  id: string,
  fn: (track: Track) => Track,
): Project {
  return {
    ...project,
    tracks: project.tracks.map((track) => (track.id === id ? fn(track) : track)),
  };
}

/** Renomme une trace. */
export function renameTrack(project: Project, id: string, name: string): Project {
  return mapTrack(project, id, (track) => ({ ...track, name }));
}

/** Change la couleur d'affichage d'une trace. */
export function setTrackColor(project: Project, id: string, color: string): Project {
  return mapTrack(project, id, (track) => ({ ...track, color }));
}

/** Change la visibilité d'une trace. */
export function setTrackVisibility(
  project: Project,
  id: string,
  visible: boolean,
): Project {
  return mapTrack(project, id, (track) => ({ ...track, visible }));
}

/** Supprime une trace. */
export function removeTrack(project: Project, id: string): Project {
  return { ...project, tracks: project.tracks.filter((track) => track.id !== id) };
}

/** Déplace une trace dans l'ordre (haut = vers le début, bas = vers la fin). */
export function moveTrack(
  project: Project,
  id: string,
  direction: "up" | "down",
): Project {
  const index = project.tracks.findIndex((track) => track.id === id);
  if (index < 0) return project;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= project.tracks.length) return project;

  const tracks = [...project.tracks];
  const current = tracks[index];
  const swap = tracks[target];
  if (current === undefined || swap === undefined) return project;
  tracks[index] = swap;
  tracks[target] = current;
  return { ...project, tracks };
}
