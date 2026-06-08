import { create } from "zustand";
import type { Project } from "../core/model";

/**
 * Store global du projet courant (Zustand).
 *
 * Phase 1 : conteneur d'état minimal (projet chargé). L'historique undo/redo et les
 * actions d'édition enregistrables arrivent en Phase 3 ; toute mutation passera alors
 * par des actions centralisées.
 */
interface ProjectState {
  /** Projet actuellement ouvert, ou `null` si aucun. */
  project: Project | null;
  /** Remplace le projet courant. */
  loadProject: (project: Project) => void;
  /** Ferme le projet courant. */
  clearProject: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  project: null,
  loadProject: (project) => set({ project }),
  clearProject: () => set({ project: null }),
}));
