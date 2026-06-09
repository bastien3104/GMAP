import { useState } from "react";
import type { ReactElement } from "react";
import { useProjectStore } from "../store/project-store";
import { useUiStore } from "../store/ui-store";
import { trackStats } from "../core/geo/stats";

/** Dialogue : découpe de la trace sélectionnée tous les X km. */
export function SplitDialog(): ReactElement | null {
  const open = useUiStore((s) => s.splitOpen);
  const setOpen = useUiStore((s) => s.setSplitOpen);
  const project = useProjectStore((s) => s.project);
  const selectedTrackId = useProjectStore((s) => s.selectedTrackId);
  const splitTrack = useProjectStore((s) => s.splitTrack);

  const [km, setKm] = useState(2);

  if (!open) return null;

  const track = project?.tracks.find((t) => t.id === selectedTrackId) ?? null;
  const distance = track !== null ? trackStats(track).distance : 0;
  const intervalM = Math.max(1, km * 1000);
  const estimate = Math.max(1, Math.ceil(distance / intervalM));

  function apply(): void {
    if (track === null) return;
    splitTrack(track.id, intervalM);
    setOpen(false);
  }

  return (
    <div className="dialog-overlay" onClick={() => setOpen(false)}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span>Découper par distance</span>
          <button type="button" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>
        {track === null ? (
          <p className="dialog-sub">Sélectionne d'abord une trace dans les calques.</p>
        ) : (
          <>
            <p className="dialog-sub">
              Trace : {track.name} ({(distance / 1000).toFixed(2)} km)
            </p>
            <div className="dialog-row">
              <span>Tous les</span>
              <input
                type="number"
                min={0.1}
                step={0.5}
                value={km}
                onChange={(e) => setKm(Number(e.currentTarget.value))}
                aria-label="Intervalle en kilomètres"
              />
              <span>km</span>
              <span className="dialog-estimate">≈ {estimate} morceaux</span>
            </div>
            <div className="dialog-actions">
              <button type="button" onClick={apply}>
                Découper
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
