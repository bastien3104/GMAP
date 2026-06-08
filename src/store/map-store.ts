import { create } from "zustand";
import { DEFAULT_BASEMAP_ID } from "../map/basemaps";

/**
 * Store de l'état de la carte (distinct du projet).
 *
 * Phase 2a : fond de carte actif. S'étoffera (état hors-ligne, zone téléchargée…)
 * en Phase 2b.
 */
interface MapState {
  /** Identifiant du fond de carte actif. */
  activeBasemapId: string;
  /** Change le fond de carte actif. */
  setBasemap: (basemapId: string) => void;
}

export const useMapStore = create<MapState>((set) => ({
  activeBasemapId: DEFAULT_BASEMAP_ID,
  setBasemap: (basemapId) => set({ activeBasemapId: basemapId }),
}));
