import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { useProjectStore } from "../store/project-store";
import { useMapStore } from "../store/map-store";
import { useUiStore } from "../store/ui-store";
import { simplifyTrack } from "../core/geo/simplify";
import { trackPointCount } from "../core/model";
import { projectToGeoJSON } from "../core/geojson/to-geojson";

/** Dialogue : simplification Douglas-Peucker avec aperçu live et compteur de points. */
export function SimplifyDialog(): ReactElement | null {
  const open = useUiStore((s) => s.simplifyOpen);
  const setOpen = useUiStore((s) => s.setSimplifyOpen);
  const project = useProjectStore((s) => s.project);
  const selectedTrackId = useProjectStore((s) => s.selectedTrackId);
  const applySimplify = useProjectStore((s) => s.simplifyTrack);
  const setPreview = useMapStore((s) => s.setPreview);

  const [tolerance, setTolerance] = useState(10);

  const track = project?.tracks.find((t) => t.id === selectedTrackId) ?? null;

  // Aperçu live (et nettoyage à la fermeture).
  useEffect(() => {
    if (!open || track === null) {
      setPreview(null);
      return;
    }
    const result = simplifyTrack(track, tolerance);
    setPreview(
      projectToGeoJSON({ id: "preview", name: "", tracks: [result], waypoints: [] }),
    );
    return () => setPreview(null);
  }, [open, tolerance, track, setPreview]);

  if (!open) return null;

  function close(): void {
    setPreview(null);
    setOpen(false);
  }

  if (track === null) {
    return (
      <div className="dialog-overlay" onClick={close}>
        <div className="dialog" onClick={(e) => e.stopPropagation()}>
          <div className="dialog-header">
            <span>Simplifier</span>
            <button type="button" onClick={close}>
              ✕
            </button>
          </div>
          <p className="dialog-sub">Sélectionne d'abord une trace.</p>
        </div>
      </div>
    );
  }

  const before = trackPointCount(track);
  const after = trackPointCount(simplifyTrack(track, tolerance));
  const removed = before - after;

  function apply(): void {
    if (track === null) return;
    applySimplify(track.id, tolerance);
    close();
  }

  return (
    <div className="dialog-overlay" onClick={close}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span>Simplifier (Douglas-Peucker)</span>
          <button type="button" onClick={close}>
            ✕
          </button>
        </div>
        <p className="dialog-sub">Trace : {track.name}</p>
        <div className="dialog-row">
          <span>Tolérance</span>
          <input
            type="range"
            min={1}
            max={50}
            step={1}
            value={tolerance}
            onChange={(e) => setTolerance(Number(e.currentTarget.value))}
          />
          <span className="dialog-estimate">{tolerance} m</span>
        </div>
        <p className="dialog-sub">
          {before} → {after} points{" "}
          <strong>(−{removed})</strong> · aperçu en rose pointillé
        </p>
        <div className="dialog-actions">
          <button type="button" onClick={apply} disabled={removed <= 0}>
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}
