import { create } from "zustand";
import type { Project } from "../core/model";
import {
  moveTrack as opMoveTrack,
  removeTrack as opRemoveTrack,
  renameTrack as opRenameTrack,
  setTrackColor as opSetTrackColor,
  setTrackVisibility as opSetTrackVisibility,
} from "../core/edit/track-ops";

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

  /** Charge un projet et réinitialise l'historique. */
  loadProject: (project: Project) => void;
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

  renameTrack: (id: string, name: string) => void;
  setTrackColor: (id: string, color: string) => void;
  toggleTrackVisibility: (id: string) => void;
  moveTrack: (id: string, direction: "up" | "down") => void;
  deleteTrack: (id: string) => void;
}

/** Profondeur maximale de l'historique. */
const HISTORY_LIMIT = 100;

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  past: [],
  future: [],
  selectedTrackId: null,

  loadProject: (project) =>
    set({ project, past: [], future: [], selectedTrackId: null }),

  clearProject: () =>
    set({ project: null, past: [], future: [], selectedTrackId: null }),

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
}));
