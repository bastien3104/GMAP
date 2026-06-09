import { create } from "zustand";
import type { FeatureCollection } from "geojson";
import { DEFAULT_BASEMAP_ID } from "../map/basemaps";
import { setOfflineBackend } from "../offline/tiles-api";
import type { RoutingProfile } from "../core/routing/itinerary";

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
  /** Mode « suivre les sentiers » (snap-to-path entre deux clics). */
  routing: boolean;
  /** Active/désactive le snap-to-path. */
  setRouting: (routing: boolean) => void;
  /** Profil de routage online. */
  routingProfile: RoutingProfile;
  /** Change le profil de routage. */
  setRoutingProfile: (profile: RoutingProfile) => void;
  /** Routage en cours (calcul d'un segment). */
  routingBusy: boolean;
  /** Met à jour l'indicateur d'occupation du routage. */
  setRoutingBusy: (busy: boolean) => void;
  /** Coloration du tracé sélectionné par pente. */
  slopeColoring: boolean;
  /** Active/désactive la coloration par pente. */
  setSlopeColoring: (on: boolean) => void;
  /** Position survolée sur le profil (marqueur carte), ou `null`. */
  hoverPoint: [number, number] | null;
  /** Met à jour le point de survol. */
  setHoverPoint: (point: [number, number] | null) => void;
  /** Aperçu (prévisualisation d'un outil de nettoyage), ou `null`. */
  previewData: FeatureCollection | null;
  /** Met à jour l'aperçu. */
  setPreview: (data: FeatureCollection | null) => void;
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
  routing: false,
  setRouting: (routing) => set({ routing }),
  routingProfile: "pedestrian",
  setRoutingProfile: (routingProfile) => set({ routingProfile }),
  routingBusy: false,
  setRoutingBusy: (routingBusy) => set({ routingBusy }),
  slopeColoring: false,
  setSlopeColoring: (slopeColoring) => set({ slopeColoring }),
  hoverPoint: null,
  setHoverPoint: (hoverPoint) => set({ hoverPoint }),
  previewData: null,
  setPreview: (previewData) => set({ previewData }),
}));
