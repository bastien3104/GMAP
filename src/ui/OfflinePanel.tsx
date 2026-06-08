import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { getBasemap } from "../map/basemaps";
import { getVisibleBbox } from "../map/map-ref";
import { tileCount } from "../core/tiles/tile-math";
import { useMapStore } from "../store/map-store";
import {
  downloadZone,
  onDownloadProgress,
  type DownloadProgress,
} from "../offline/tiles-api";

/**
 * Panneau de cache offline : indicateur online/offline, mode hors-ligne forcé,
 * et téléchargement de la zone visible (plage de zooms) dans le MBTiles du fond actif.
 */
export function OfflinePanel(): ReactElement {
  const activeBasemapId = useMapStore((s) => s.activeBasemapId);
  const offline = useMapStore((s) => s.offline);
  const setOffline = useMapStore((s) => s.setOffline);

  const basemapMaxZoom = getBasemap(activeBasemapId)?.maxzoom ?? 19;
  const [minZoom, setMinZoom] = useState(12);
  const [maxZoom, setMaxZoom] = useState(15);
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Connectivité réseau.
  useEffect(() => {
    const up = (): void => setOnline(true);
    const down = (): void => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  // Progression de téléchargement.
  useEffect(() => {
    const unlisten = onDownloadProgress(setProgress);
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  const clampedMin = Math.min(minZoom, maxZoom);
  const clampedMax = Math.min(Math.max(minZoom, maxZoom), basemapMaxZoom);
  // `tick` force la ré-estimation après un déplacement de carte.
  void tick;
  const bbox = getVisibleBbox();
  const estimate = bbox !== null ? tileCount(bbox, clampedMin, clampedMax) : null;

  async function download(): Promise<void> {
    const currentBbox = getVisibleBbox();
    if (currentBbox === null) return;
    setMessage(null);
    setDownloading(true);
    setProgress(null);
    try {
      const result = await downloadZone(
        activeBasemapId,
        clampedMin,
        clampedMax,
        currentBbox,
      );
      setMessage(
        `Téléchargé : ${result.fetched} tuile(s) ajoutée(s) sur ${result.total}.`,
      );
    } catch (cause) {
      setMessage(`Erreur : ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setDownloading(false);
      setProgress(null);
    }
  }

  return (
    <div className="offline-panel">
      <div className="offline-status">
        <span className={online ? "dot dot-online" : "dot dot-offline"} />
        {online ? "En ligne" : "Hors ligne"}
        <label className="offline-toggle">
          <input
            type="checkbox"
            checked={offline}
            onChange={(e) => setOffline(e.currentTarget.checked)}
          />
          Forcer hors-ligne
        </label>
      </div>

      <div className="offline-download">
        <span>Zooms</span>
        <input
          type="number"
          min={0}
          max={basemapMaxZoom}
          value={minZoom}
          onChange={(e) => setMinZoom(Number(e.currentTarget.value))}
          aria-label="Zoom minimum"
        />
        <span>–</span>
        <input
          type="number"
          min={0}
          max={basemapMaxZoom}
          value={maxZoom}
          onChange={(e) => setMaxZoom(Number(e.currentTarget.value))}
          aria-label="Zoom maximum"
        />
        <button type="button" onClick={() => setTick((t) => t + 1)} title="Ré-estimer">
          ↻
        </button>
        {estimate !== null && <span className="offline-estimate">≈ {estimate} tuiles</span>}
        <button type="button" onClick={() => void download()} disabled={downloading}>
          Télécharger cette zone
        </button>
      </div>

      {downloading && progress !== null && (
        <div className="offline-progress">
          <progress value={progress.done} max={progress.total} />
          <span>
            {progress.done}/{progress.total}
          </span>
        </div>
      )}
      {message !== null && <span className="offline-message">{message}</span>}
    </div>
  );
}
