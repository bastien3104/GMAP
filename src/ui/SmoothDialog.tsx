import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { useProjectStore } from "../store/project-store";
import { useMapStore } from "../store/map-store";
import { useUiStore } from "../store/ui-store";
import { smoothTrack } from "../core/geo/smooth";
import { projectToGeoJSON } from "../core/geojson/to-geojson";

/** Dialogue : lissage GPS (fenêtre glissante + retrait des aberrants) avec aperçu live. */
export function SmoothDialog(): ReactElement | null {
  const open = useUiStore((s) => s.smoothOpen);
  const setOpen = useUiStore((s) => s.setSmoothOpen);
  const project = useProjectStore((s) => s.project);
  const selectedTrackId = useProjectStore((s) => s.selectedTrackId);
  const applySmooth = useProjectStore((s) => s.smoothTrack);
  const setPreview = useMapStore((s) => s.setPreview);

  const [windowSize, setWindowSize] = useState(5);
  const [maxJumpM, setMaxJumpM] = useState(100);

  const track = project?.tracks.find((t) => t.id === selectedTrackId) ?? null;

  useEffect(() => {
    if (!open || track === null) {
      setPreview(null);
      return;
    }
    const result = smoothTrack(track, { windowSize, maxJumpM });
    setPreview(
      projectToGeoJSON({ id: "preview", name: "", tracks: [result], waypoints: [] }),
    );
    return () => setPreview(null);
  }, [open, windowSize, maxJumpM, track, setPreview]);

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
            <span>Lisser</span>
            <button type="button" onClick={close}>
              ✕
            </button>
          </div>
          <p className="dialog-sub">Sélectionne d'abord une trace.</p>
        </div>
      </div>
    );
  }

  function apply(): void {
    if (track === null) return;
    applySmooth(track.id, { windowSize, maxJumpM });
    close();
  }

  return (
    <div className="dialog-overlay" onClick={close}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span>Lisser (GPS)</span>
          <button type="button" onClick={close}>
            ✕
          </button>
        </div>
        <p className="dialog-sub">Trace : {track.name}</p>
        <div className="dialog-row">
          <span>Fenêtre</span>
          <input
            type="range"
            min={3}
            max={15}
            step={2}
            value={windowSize}
            onChange={(e) => setWindowSize(Number(e.currentTarget.value))}
          />
          <span className="dialog-estimate">{windowSize} pts</span>
        </div>
        <div className="dialog-row">
          <span>Saut max</span>
          <input
            type="number"
            min={0}
            step={10}
            value={maxJumpM}
            onChange={(e) => setMaxJumpM(Number(e.currentTarget.value))}
          />
          <span>m (aberrants)</span>
        </div>
        <p className="dialog-sub">Aperçu en rose pointillé.</p>
        <div className="dialog-actions">
          <button type="button" onClick={apply}>
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}
