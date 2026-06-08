import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Bbox } from "../core/tiles/tile-math";

/**
 * Pont vers les commandes Rust du cache offline (téléchargement, mode hors-ligne,
 * statistiques) et l'évènement de progression.
 */

export interface DownloadResult {
  total: number;
  fetched: number;
}

export interface DownloadProgress {
  layer: string;
  done: number;
  total: number;
  fetched: number;
}

/** Télécharge une zone (emprise + plage de zooms) dans le cache du fond. */
export function downloadZone(
  layer: string,
  minZoom: number,
  maxZoom: number,
  bbox: Bbox,
): Promise<DownloadResult> {
  return invoke<DownloadResult>("download_zone", {
    layer,
    minZoom,
    maxZoom,
    bbox,
  });
}

/** Active/désactive le mode hors-ligne côté backend (no-op hors Tauri). */
export function setOfflineBackend(offline: boolean): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  return invoke<void>("set_offline", { offline });
}

/** Nombre de tuiles en cache pour un fond. */
export function cacheStats(layer: string): Promise<number> {
  if (!isTauri()) return Promise.resolve(0);
  return invoke<number>("cache_stats", { layer });
}

/** S'abonne aux évènements de progression de téléchargement. */
export function onDownloadProgress(
  callback: (progress: DownloadProgress) => void,
): Promise<UnlistenFn> {
  return listen<DownloadProgress>("download-progress", (event) =>
    callback(event.payload),
  );
}
