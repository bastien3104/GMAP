import { create } from "zustand";
import type { Bbox } from "../core/tiles/tile-math";

/**
 * Registre persistant des zones téléchargées hors-ligne (façon « cartes hors-ligne »).
 *
 * Les **tuiles** vivent dans les MBTiles de `app_data_dir` (déjà persistants) ; ce store
 * ne garde que les **métadonnées** des zones (nom, fond, emprise, zooms, taille), dans
 * `localStorage`, pour les lister, visualiser et supprimer.
 */

/** Une zone téléchargée. */
export interface OfflineZone {
  id: string;
  name: string;
  /** Identifiant du fond de carte concerné. */
  basemapId: string;
  bbox: Bbox;
  minZoom: number;
  maxZoom: number;
  /** Nombre de tuiles couvertes (estimation au téléchargement). */
  tileCount: number;
  /** Date de création (ISO 8601). */
  createdAt: string;
}

const STORAGE_KEY = "gmap-offline-zones";

function load(): OfflineZone[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? (data as OfflineZone[]) : [];
  } catch {
    return [];
  }
}

function persist(zones: OfflineZone[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(zones));
  } catch {
    /* quota / indisponible : on ignore */
  }
}

interface OfflineState {
  zones: OfflineZone[];
  /** Enregistre une nouvelle zone (en tête de liste). */
  addZone: (zone: OfflineZone) => void;
  /** Renomme une zone. */
  renameZone: (id: string, name: string) => void;
  /** Retire une zone du registre (la suppression des tuiles est gérée à part). */
  removeZone: (id: string) => void;
}

export const useOfflineStore = create<OfflineState>((set, get) => ({
  zones: load(),
  addZone: (zone) => {
    const zones = [zone, ...get().zones];
    persist(zones);
    set({ zones });
  },
  renameZone: (id, name) => {
    const zones = get().zones.map((z) => (z.id === id ? { ...z, name } : z));
    persist(zones);
    set({ zones });
  },
  removeZone: (id) => {
    const zones = get().zones.filter((z) => z.id !== id);
    persist(zones);
    set({ zones });
  },
}));
