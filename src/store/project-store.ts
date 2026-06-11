import { create } from "zustand";
import {
  createEmptyProject,
  defaultTrackColor,
  type Project,
  type Track,
  type Waypoint,
} from "../core/model";
import {
  moveTrack as opMoveTrack,
  removeTrack as opRemoveTrack,
  renameTrack as opRenameTrack,
  setTrackColor as opSetTrackColor,
  setTrackVisibility as opSetTrackVisibility,
} from "../core/edit/track-ops";
import { addTrack as opAddTrack } from "../core/edit/draw-ops";
import {
  convertTrackKind as opConvertKind,
  mergeTracks as opMergeTracks,
  reverseTrack as opReverseTrack,
  splitTrackByDistance as opSplitTrack,
} from "../core/edit/transform-ops";
import {
  addWaypoint as opAddWaypoint,
  moveWaypoint as opMoveWaypoint,
  removeWaypoint as opRemoveWaypoint,
  updateWaypoint as opUpdateWaypoint,
  type WaypointPatch,
} from "../core/edit/waypoint-ops";
import { simplifyTrack as opSimplifyTrack } from "../core/geo/simplify";
import { smoothTrack as opSmoothTrack, type SmoothOptions } from "../core/geo/smooth";
import { removeElevationSpikes as opCleanElevation } from "../core/geo/elevation-clean";
import { withElevations } from "../core/elevation/elevation-client";

/**
 * Store du projet courant avec historique undo/redo centralisé.
 *
 * `project` est l'état « présent » ; `past`/`future` empilent les instantanés
 * (immuables, à partage de structure). Toute mutation passe par `applyEdit`, ce qui
 * la rend annulable — conformément à CLAUDE.md.
 */
interface ProjectState {
  /** Projet courant (présent), ou `null`. */
  project: Project | null;
  /** Instantanés antérieurs (du plus ancien au plus récent). */
  past: Project[];
  /** Instantanés rétablissables. */
  future: Project[];
  /** Trace sélectionnée (édition/surbrillance), ou `null`. */
  selectedTrackId: string | null;
  /** Waypoint sélectionné (éditeur ouvert / surbrillance), ou `null`. */
  selectedWaypointId: string | null;

  /** Charge un projet et réinitialise l'historique. */
  loadProject: (project: Project) => void;
  /** Importe (ajoute) les traces/waypoints d'un projet dans le projet courant. */
  importProject: (imported: Project) => void;
  /** Ferme le projet courant. */
  clearProject: () => void;
  /** Applique une mutation immuable et l'enregistre dans l'historique. */
  applyEdit: (updater: (project: Project) => Project) => void;
  /** Annule la dernière opération. */
  undo: () => void;
  /** Rétablit l'opération annulée. */
  redo: () => void;
  /** Sélectionne une trace (ou désélectionne avec `null`). */
  selectTrack: (id: string | null) => void;
  /** Ajoute une trace (crée un projet si aucun) et la sélectionne. */
  addTrack: (track: Track) => void;
  /** Remplace les altitudes des points d'une trace (ordre aplati). */
  setTrackElevations: (trackId: string, elevations: number[]) => void;

  renameTrack: (id: string, name: string) => void;
  setTrackColor: (id: string, color: string) => void;
  toggleTrackVisibility: (id: string) => void;
  moveTrack: (id: string, direction: "up" | "down") => void;
  deleteTrack: (id: string) => void;
  /** Inverse le sens d'une trace. */
  reverseTrack: (id: string) => void;
  /** Convertit une trace en route ou inversement. */
  convertTrackKind: (id: string) => void;
  /** Fusionne les traces visibles en une seule. */
  mergeVisibleTracks: () => void;
  /** Découpe une trace en morceaux tous les `intervalM` mètres. */
  splitTrack: (id: string, intervalM: number) => void;
  /** Simplifie une trace (Douglas-Peucker, tolérance en m). */
  simplifyTrack: (id: string, toleranceM: number) => void;
  /** Lisse une trace (fenêtre glissante + retrait des aberrants). */
  smoothTrack: (id: string, options: SmoothOptions) => void;
  /** Supprime les pics d'altitude d'une trace. */
  cleanElevationSpikes: (id: string, thresholdM: number) => void;

  /** Sélectionne un waypoint (ou désélectionne avec `null`). */
  selectWaypoint: (id: string | null) => void;
  /** Ajoute un waypoint et le sélectionne. */
  addWaypoint: (waypoint: Waypoint) => void;
  /** Modifie un waypoint (nom/note/symbole/altitude). */
  updateWaypoint: (id: string, patch: WaypointPatch) => void;
  /** Déplace un waypoint. */
  moveWaypoint: (id: string, lon: number, lat: number) => void;
  /** Supprime un waypoint. */
  deleteWaypoint: (id: string) => void;
  /**
   * Renseigne l'altitude d'un waypoint sans entrée d'historique (enrichissement
   * asynchrone post-pose). Reste lié à l'instantané « présent » (cf. redo).
   */
  enrichWaypointElevation: (id: string, ele: number) => void;
}

/** Profondeur maximale de l'historique. */
const HISTORY_LIMIT = 100;

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  past: [],
  future: [],
  selectedTrackId: null,
  selectedWaypointId: null,

  loadProject: (project) =>
    set({ project, past: [], future: [], selectedTrackId: null, selectedWaypointId: null }),

  importProject: (imported) => {
    const current = get().project;
    if (current === null) {
      set({ project: imported, past: [], future: [], selectedTrackId: imported.tracks[0]?.id ?? null, selectedWaypointId: null });
      return;
    }
    // Recolore les traces ajoutées pour continuer la palette.
    const base = current.tracks.length;
    const added = imported.tracks.map((t, i) => ({
      ...t,
      color: defaultTrackColor(base + i),
    }));
    get().applyEdit((p) => ({
      ...p,
      tracks: [...p.tracks, ...added],
      waypoints: [...p.waypoints, ...imported.waypoints],
    }));
    if (added[0] !== undefined) set({ selectedTrackId: added[0].id });
  },

  clearProject: () =>
    set({ project: null, past: [], future: [], selectedTrackId: null, selectedWaypointId: null }),

  applyEdit: (updater) => {
    const { project, past } = get();
    if (project === null) return;
    const next = updater(project);
    if (next === project) return; // aucune modification
    const overflow = past.length - (HISTORY_LIMIT - 1);
    const trimmedPast = overflow > 0 ? past.slice(overflow) : past;
    set({ project: next, past: [...trimmedPast, project], future: [] });
  },

  undo: () => {
    const { project, past, future } = get();
    if (project === null || past.length === 0) return;
    const previous = past[past.length - 1]!;
    set({ project: previous, past: past.slice(0, -1), future: [project, ...future] });
  },

  redo: () => {
    const { project, past, future } = get();
    if (project === null || future.length === 0) return;
    const next = future[0]!;
    set({ project: next, past: [...past, project], future: future.slice(1) });
  },

  selectTrack: (id) => set({ selectedTrackId: id }),

  addTrack: (track) => {
    const { project } = get();
    if (project === null) {
      const base = createEmptyProject();
      set({
        project: { ...base, tracks: [track] },
        past: [],
        future: [],
        selectedTrackId: track.id,
      });
      return;
    }
    get().applyEdit((p) => opAddTrack(p, track));
    set({ selectedTrackId: track.id });
  },

  setTrackElevations: (trackId, elevations) =>
    get().applyEdit((p) => ({
      ...p,
      tracks: p.tracks.map((t) =>
        t.id === trackId ? withElevations(t, elevations) : t,
      ),
    })),

  renameTrack: (id, name) => get().applyEdit((p) => opRenameTrack(p, id, name)),
  setTrackColor: (id, color) => get().applyEdit((p) => opSetTrackColor(p, id, color)),
  toggleTrackVisibility: (id) =>
    get().applyEdit((p) => {
      const track = p.tracks.find((t) => t.id === id);
      return track ? opSetTrackVisibility(p, id, !track.visible) : p;
    }),
  moveTrack: (id, direction) => get().applyEdit((p) => opMoveTrack(p, id, direction)),
  deleteTrack: (id) => {
    get().applyEdit((p) => opRemoveTrack(p, id));
    if (get().selectedTrackId === id) set({ selectedTrackId: null });
  },

  reverseTrack: (id) => get().applyEdit((p) => opReverseTrack(p, id)),
  convertTrackKind: (id) => get().applyEdit((p) => opConvertKind(p, id)),
  mergeVisibleTracks: () => {
    const proj = get().project;
    if (proj === null) return;
    const ids = proj.tracks.filter((t) => t.visible).map((t) => t.id);
    if (ids.length < 2) return;
    get().applyEdit((p) => opMergeTracks(p, ids));
    set({ selectedTrackId: ids[0] ?? null });
  },
  splitTrack: (id, intervalM) => {
    const before = get().project;
    if (before === null) return;
    const index = before.tracks.findIndex((t) => t.id === id);
    get().applyEdit((p) => opSplitTrack(p, id, intervalM));
    const after = get().project;
    if (after !== null && index >= 0) {
      const piece = after.tracks[index];
      if (piece !== undefined) set({ selectedTrackId: piece.id });
    }
  },

  simplifyTrack: (id, toleranceM) =>
    get().applyEdit((p) => ({
      ...p,
      tracks: p.tracks.map((t) => (t.id === id ? opSimplifyTrack(t, toleranceM) : t)),
    })),
  smoothTrack: (id, options) =>
    get().applyEdit((p) => ({
      ...p,
      tracks: p.tracks.map((t) => (t.id === id ? opSmoothTrack(t, options) : t)),
    })),
  cleanElevationSpikes: (id, thresholdM) =>
    get().applyEdit((p) => ({
      ...p,
      tracks: p.tracks.map((t) => (t.id === id ? opCleanElevation(t, thresholdM) : t)),
    })),

  selectWaypoint: (id) => set({ selectedWaypointId: id }),
  addWaypoint: (waypoint) => {
    const { project } = get();
    if (project === null) {
      const base = createEmptyProject();
      set({
        project: { ...base, waypoints: [waypoint] },
        past: [],
        future: [],
        selectedWaypointId: waypoint.id,
      });
      return;
    }
    get().applyEdit((p) => opAddWaypoint(p, waypoint));
    set({ selectedWaypointId: waypoint.id });
  },
  updateWaypoint: (id, patch) => get().applyEdit((p) => opUpdateWaypoint(p, id, patch)),
  moveWaypoint: (id, lon, lat) => get().applyEdit((p) => opMoveWaypoint(p, id, lon, lat)),
  deleteWaypoint: (id) => {
    get().applyEdit((p) => opRemoveWaypoint(p, id));
    if (get().selectedWaypointId === id) set({ selectedWaypointId: null });
  },
  enrichWaypointElevation: (id, ele) => {
    const { project } = get();
    if (project === null) return;
    const next = opUpdateWaypoint(project, id, { ele });
    if (next !== project) set({ project: next });
  },
}));
