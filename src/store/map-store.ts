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
  /** Mode édition des points de la trace sélectionnée. */
  editMode: boolean;
  /** Active/désactive le mode édition (exclusif du mode dessin). */
  setEditMode: (editMode: boolean) => void;
  /** Mode dessin d'une nouvelle trace. */
  drawMode: boolean;
  /** Active/désactive le mode dessin (exclusif du mode édition). */
  setDrawMode: (drawMode: boolean) => void;
  /** Tracé continu à la souris (freehand) plutôt que point par point. */
  freehand: boolean;
  /** Active/désactive le freehand. */
  setFreehand: (freehand: boolean) => void;
}

export const useMapStore = create<MapState>((set, get) => ({
  activeBasemapId: DEFAULT_BASEMAP_ID,
  setBasemap: (basemapId) => set({ activeBasemapId: basemapId }),
  offline: false,
  setOffline: (offline) => {
    set({ offline });
    void setOfflineBackend(offline).catch(() => {
      /* hors Tauri ou backend indisponible : on ignore */
    });
  },
  editMode: false,
  setEditMode: (editMode) => set({ editMode, drawMode: editMode ? false : get().drawMode }),
  drawMode: false,
  setDrawMode: (drawMode) => set({ drawMode, editMode: drawMode ? false : get().editMode }),
  freehand: false,
  setFreehand: (freehand) => set({ freehand }),
}));
