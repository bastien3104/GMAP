import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { getBasemap } from "../map/basemaps";
import { flyToBounds } from "../map/map-ref";
import { cacheSize, cacheStats, deleteZoneTiles } from "../offline/tiles-api";
import { useUiStore } from "../store/ui-store";
import { useMapStore } from "../store/map-store";
import { useOfflineStore, type OfflineZone } from "../store/offline-store";
import { IconRename, IconTarget, IconTrash } from "./icons";

/** Formate un nombre d'octets en taille lisible. */
function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 Ko";
  const mo = bytes / (1024 * 1024);
  if (mo >= 1) return `${mo.toFixed(1)} Mo`;
  return `${Math.round(bytes / 1024)} Ko`;
}

/**
 * Gestionnaire des cartes hors-ligne (façon Apple Plans) : liste des zones
 * téléchargées, visualisation, renommage et suppression (libère l'espace disque).
 */
export function OfflineZonesPanel(): ReactElement | null {
  const open = useUiStore((s) => s.offlineZonesOpen);
  const setOpen = useUiStore((s) => s.setOfflineZonesOpen);
  const zones = useOfflineStore((s) => s.zones);
  const showZones = useMapStore((s) => s.showOfflineZones);
  const setShowZones = useMapStore((s) => s.setShowOfflineZones);

  // Octets moyens par tuile, par fond (pour estimer la taille d'une zone).
  const [avgBytes, setAvgBytes] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;
    const ids = [...new Set(zones.map((z) => z.basemapId))];
    let cancelled = false;
    void Promise.all(
      ids.map(async (id) => {
        const [bytes, count] = await Promise.all([cacheSize(id), cacheStats(id)]);
        return [id, count > 0 ? bytes / count : 0] as const;
      }),
    ).then((pairs) => {
      if (!cancelled) setAvgBytes(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [open, zones]);

  if (!open) return null;

  return (
    <div className="dialog-overlay" onClick={() => setOpen(false)}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span>Cartes hors-ligne ({zones.length})</span>
          <button type="button" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>

        <label className="export-wpt">
          <input
            type="checkbox"
            checked={showZones}
            onChange={(e) => setShowZones(e.currentTarget.checked)}
          />
          Afficher les emprises sur la carte
        </label>

        {zones.length === 0 ? (
          <p className="dialog-sub">
            Aucune zone téléchargée. Utilise « Outils ▸ Télécharger la zone… ».
          </p>
        ) : (
          <ul className="zones-list">
            {zones.map((z) => (
              <ZoneRow key={z.id} zone={z} avgBytes={avgBytes[z.basemapId] ?? 0} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ZoneRow({ zone, avgBytes }: { zone: OfflineZone; avgBytes: number }): ReactElement {
  const renameZone = useOfflineStore((s) => s.renameZone);
  const removeZone = useOfflineStore((s) => s.removeZone);
  const setOpen = useUiStore((s) => s.setOfflineZonesOpen);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(zone.name);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const basemap = getBasemap(zone.basemapId);
  const sizeLabel = formatBytes(Math.round(zone.tileCount * avgBytes));
  const date = new Date(zone.createdAt).toLocaleDateString("fr-FR");

  function commitRename(): void {
    const name = draft.trim();
    if (name !== "" && name !== zone.name) renameZone(zone.id, name);
    setEditing(false);
  }

  async function remove(): Promise<void> {
    setBusy(true);
    try {
      await deleteZoneTiles(zone.basemapId, zone.minZoom, zone.maxZoom, zone.bbox);
    } catch {
      /* suppression best-effort : on retire quand même du registre */
    } finally {
      removeZone(zone.id);
    }
  }

  return (
    <li className="zone-row">
      <div className="zone-main">
        {editing ? (
          <input
            className="layer-name"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.currentTarget.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              else if (e.key === "Escape") {
                setDraft(zone.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <span className="zone-name">{zone.name}</span>
        )}
        <span className="zone-meta">
          {basemap?.label ?? zone.basemapId} · z{zone.minZoom}–{zone.maxZoom} ·{" "}
          {zone.tileCount} tuiles · ~{sizeLabel} · {date}
        </span>
      </div>
      <div className="zone-actions">
        {confirming ? (
          <>
            <span className="zone-confirm">Supprimer ?</span>
            <button type="button" disabled={busy} onClick={() => void remove()}>
              Oui
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirming(false)}>
              Non
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              title="Voir sur la carte"
              onClick={() => {
                flyToBounds(zone.bbox);
                setOpen(false);
              }}
            >
              <IconTarget size={14} />
            </button>
            <button type="button" title="Renommer" onClick={() => setEditing(true)}>
              <IconRename size={14} />
            </button>
            <button type="button" title="Supprimer" onClick={() => setConfirming(true)}>
              <IconTrash size={14} />
            </button>
          </>
        )}
      </div>
    </li>
  );
}
