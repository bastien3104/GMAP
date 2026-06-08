import { create } from "zustand";
import { DEFAULT_BASEMAP_ID } from "../map/basemaps";
import { setOfflineBackend } from "../offline/tiles-api";

/**
 * Store de l'état de la carte (distinct du projet) : fond actif et mode hors-ligne.
 */
interface MapState {
  /** Identifiant du fond de carte actif. */
  activeBasemapId: string;
  /** Change le fond de carte actif. */
  setBasemap: (basemapId: string) => void;
  /** Mode hors-ligne forcé (le backend ne tente plus le réseau). */
  offline: boolean;
  /** Active/désactive le mode hors-ligne (propagé au backend). */
  setOffline: (offline: boolean) => void;
}

export const useMapStore = create<MapState>((set) => ({
  activeBasemapId: DEFAULT_BASEMAP_ID,
  setBasemap: (basemapId) => set({ activeBasemapId: basemapId }),
  offline: false,
  setOffline: (offline) => {
    set({ offline });
    void setOfflineBackend(offline).catch(() => {
      /* hors Tauri ou backend indisponible : on ignore */
    });
  },
}));
