import { create } from "zustand";

/**
 * État d'agencement de l'interface (panneaux ancrés, dialogues).
 * Distinct des données (`project-store`) et de l'état carte (`map-store`).
 */
interface UiState {
  /** Panneau Calques replié (gauche). */
  layersCollapsed: boolean;
  toggleLayers: () => void;
  /** Dock profil replié (bas). */
  profileCollapsed: boolean;
  toggleProfile: () => void;
  /** Dialogue de téléchargement de zone ouvert. */
  downloadOpen: boolean;
  setDownloadOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  layersCollapsed: false,
  toggleLayers: () => set((s) => ({ layersCollapsed: !s.layersCollapsed })),
  profileCollapsed: false,
  toggleProfile: () => set((s) => ({ profileCollapsed: !s.profileCollapsed })),
  downloadOpen: false,
  setDownloadOpen: (downloadOpen) => set({ downloadOpen }),
}));
