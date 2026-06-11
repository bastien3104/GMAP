import type { Project } from "../model";

/**
 * Construit un sous-projet pur ne contenant que les traces sélectionnées (et,
 * optionnellement, les waypoints). Utilisé par l'export sélectif. Ne mute pas
 * l'original ; les traces conservées sont partagées (immuables).
 */
export function subsetProject(
  project: Project,
  trackIds: Iterable<string>,
  includeWaypoints: boolean,
): Project {
  const keep = new Set(trackIds);
  return {
    ...project,
    tracks: project.tracks.filter((t) => keep.has(t.id)),
    waypoints: includeWaypoints ? project.waypoints : [],
  };
}
