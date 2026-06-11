import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { getBasemap } from "../map/basemaps";
import { getVisibleBbox } from "../map/map-ref";
import { tileCount } from "../core/tiles/tile-math";
import { reverseGeocode } from "../core/geocode/geocode";
import { useMapStore } from "../store/map-store";
import { useUiStore } from "../store/ui-store";
import { useOfflineStore } from "../store/offline-store";
import {
  downloadZone,
  onDownloadProgress,
  type DownloadProgress,
} from "../offline/tiles-api";

/** Nom de zone par défaut (date du jour) si le géocodage inverse échoue. */
function defaultZoneName(): string {
  return `Zone ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}`;
}

/** Dialogue modal : téléchargement hors-ligne de la zone visible (plage de zooms). */
export function DownloadDialog(): ReactElement | null {
  const open = useUiStore((s) => s.downloadOpen);
  const setOpen = useUiStore((s) => s.setDownloadOpen);
  const activeBasemapId = useMapStore((s) => s.activeBasemapId);
  const addZone = useOfflineStore((s) => s.addZone);
  const basemap = getBasemap(activeBasemapId);
  const basemapMaxZoom = basemap?.maxzoom ?? 19;

  const [name, setName] = useState("");
  const [minZoom, setMinZoom] = useState(12);
  const [maxZoom, setMaxZoom] = useState(15);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const unlisten = onDownloadProgress(setProgress);
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  // À l'ouverture : nom par défaut = lieu au centre de la zone (géocodage inverse).
  useEffect(() => {
    if (!open) return;
    setName(defaultZoneName());
    const bbox = getVisibleBbox();
    if (bbox === null) return;
    const lon = (bbox.minLon + bbox.maxLon) / 2;
    const lat = (bbox.minLat + bbox.maxLat) / 2;
    let cancelled = false;
    void reverseGeocode(lon, lat).then((label) => {
      if (!cancelled && label !== null) setName(label);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const clampedMin = Math.min(minZoom, maxZoom);
  const clampedMax = Math.min(Math.max(minZoom, maxZoom), basemapMaxZoom);
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
      addZone({
        id: crypto.randomUUID(),
        name: name.trim() || defaultZoneName(),
        basemapId: activeBasemapId,
        bbox: currentBbox,
        minZoom: clampedMin,
        maxZoom: clampedMax,
        tileCount: result.total,
        createdAt: new Date().toISOString(),
      });
      setMessage(
        `Téléchargé : ${result.fetched} tuile(s) ajoutée(s) sur ${result.total}. Zone enregistrée.`,
      );
    } catch (cause) {
      setMessage(`Erreur : ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setDownloading(false);
      setProgress(null);
    }
  }

  return (
    <div
      className="dialog-overlay"
      onClick={() => {
        if (!downloading) setOpen(false);
      }}
    >
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span>Télécharger la zone visible</span>
          <button type="button" onClick={() => setOpen(false)} disabled={downloading}>
            ✕
          </button>
        </div>
        <p className="dialog-sub">Fond : {basemap?.label ?? activeBasemapId}</p>
        <div className="wpt-field">
          <span>Nom de la zone</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder={defaultZoneName()}
          />
        </div>
        <div className="dialog-row">
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
          {estimate !== null && <span className="dialog-estimate">≈ {estimate} tuiles</span>}
        </div>
        <div className="dialog-actions">
          <button type="button" onClick={() => void download()} disabled={downloading}>
            {downloading ? "Téléchargement…" : "Télécharger"}
          </button>
        </div>
        {downloading && progress !== null && (
          <div className="dialog-progress">
            <progress value={progress.done} max={progress.total} />
            <span>
              {progress.done}/{progress.total}
            </span>
          </div>
        )}
        {message !== null && <p className="dialog-message">{message}</p>}
      </div>
    </div>
  );
}
