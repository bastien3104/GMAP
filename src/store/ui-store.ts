import { create } from "zustand";

/** Thème d'affichage : clair, sombre, ou automatique (suit l'OS). */
export type Theme = "light" | "dark" | "auto";

const THEME_KEY = "gmap-theme";

/** Lit le thème persisté (repli « auto »). */
function loadTheme(): Theme {
  if (typeof localStorage === "undefined") return "auto";
  const value = localStorage.getItem(THEME_KEY);
  return value === "light" || value === "dark" || value === "auto" ? value : "auto";
}

/**
 * État d'agencement de l'interface (panneaux ancrés, dialogues, thème).
 * Distinct des données (`project-store`) et de l'état carte (`map-store`).
 */
interface UiState {
  /** Thème d'affichage choisi (clair/sombre/auto). */
  theme: Theme;
  /** Change le thème et le persiste. */
  setTheme: (theme: Theme) => void;
  /** Panneau Calques replié (gauche). */
  layersCollapsed: boolean;
  toggleLayers: () => void;
  /** Dock profil replié (bas). */
  profileCollapsed: boolean;
  toggleProfile: () => void;
  /** Dialogue de téléchargement de zone ouvert. */
  downloadOpen: boolean;
  setDownloadOpen: (open: boolean) => void;
  /** Dialogue de découpe par distance ouvert. */
  splitOpen: boolean;
  setSplitOpen: (open: boolean) => void;
  /** Dialogue de simplification ouvert. */
  simplifyOpen: boolean;
  setSimplifyOpen: (open: boolean) => void;
  /** Dialogue de lissage ouvert. */
  smoothOpen: boolean;
  setSmoothOpen: (open: boolean) => void;
  /** Aide des raccourcis clavier ouverte. */
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  /** Barre de recherche (géocodage) visible. */
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  /** Dialogue d'export sélectif ouvert. */
  exportOpen: boolean;
  setExportOpen: (open: boolean) => void;
  /** Gestionnaire des cartes hors-ligne ouvert. */
  offlineZonesOpen: boolean;
  setOfflineZonesOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  theme: loadTheme(),
  setTheme: (theme) => {
    if (typeof localStorage !== "undefined") localStorage.setItem(THEME_KEY, theme);
    set({ theme });
  },
  layersCollapsed: false,
  toggleLayers: () => set((s) => ({ layersCollapsed: !s.layersCollapsed })),
  profileCollapsed: false,
  toggleProfile: () => set((s) => ({ profileCollapsed: !s.profileCollapsed })),
  downloadOpen: false,
  setDownloadOpen: (downloadOpen) => set({ downloadOpen }),
  splitOpen: false,
  setSplitOpen: (splitOpen) => set({ splitOpen }),
  simplifyOpen: false,
  setSimplifyOpen: (simplifyOpen) => set({ simplifyOpen }),
  smoothOpen: false,
  setSmoothOpen: (smoothOpen) => set({ smoothOpen }),
  helpOpen: false,
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  searchOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  exportOpen: false,
  setExportOpen: (exportOpen) => set({ exportOpen }),
  offlineZonesOpen: false,
  setOfflineZonesOpen: (offlineZonesOpen) => set({ offlineZonesOpen }),
}));
