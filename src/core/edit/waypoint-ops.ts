import type { Project, Waypoint } from "../model";

/**
 * Opérations d'édition des waypoints (POI), pures et immuables.
 *
 * Chaque fonction renvoie un nouveau `Project` (waypoints non touchés partagés), ou
 * le **même** projet si rien ne change (pas d'entrée d'historique inutile). Utilisées
 * par le store via `applyEdit` → annulables (undo/redo).
 */

/** Champs d'un waypoint modifiables via l'éditeur. */
export type WaypointPatch = Partial<Pick<Waypoint, "name" | "note" | "symbol" | "ele">>;

/** Ajoute un waypoint au projet. */
export function addWaypoint(project: Project, waypoint: Waypoint): Project {
  return { ...project, waypoints: [...project.waypoints, waypoint] };
}

/**
 * Applique un patch (nom/note/symbole/altitude) à un waypoint.
 * Une valeur `undefined` dans le patch est ignorée ; passer `ele: undefined` ne
 * supprime pas l'altitude (utiliser une valeur ou laisser inchangé).
 */
export function updateWaypoint(
  project: Project,
  id: string,
  patch: WaypointPatch,
): Project {
  let changed = false;
  const waypoints = project.waypoints.map((wpt) => {
    if (wpt.id !== id) return wpt;
    const next: Waypoint = { ...wpt };
    if (patch.name !== undefined) next.name = patch.name;
    if (patch.note !== undefined) next.note = patch.note;
    if (patch.symbol !== undefined) next.symbol = patch.symbol;
    if (patch.ele !== undefined) next.ele = patch.ele;
    changed = true;
    return next;
  });
  return changed ? { ...project, waypoints } : project;
}

/** Déplace un waypoint (préserve les autres champs). */
export function moveWaypoint(
  project: Project,
  id: string,
  lon: number,
  lat: number,
): Project {
  let changed = false;
  const waypoints = project.waypoints.map((wpt) => {
    if (wpt.id !== id) return wpt;
    changed = true;
    return { ...wpt, lon, lat };
  });
  return changed ? { ...project, waypoints } : project;
}

/** Supprime un waypoint. */
export function removeWaypoint(project: Project, id: string): Project {
  const waypoints = project.waypoints.filter((wpt) => wpt.id !== id);
  if (waypoints.length === project.waypoints.length) return project;
  return { ...project, waypoints };
}
