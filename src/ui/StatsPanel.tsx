import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { useProjectStore } from "../store/project-store";
import { trackStats } from "../core/geo/stats";
import { naismithDuration } from "../core/geo/naismith";
import { fetchElevations, trackCoords } from "../core/elevation/elevation-client";

/** Statistiques de la trace sélectionnée + durée Naismith + correction d'altitude. */
export function StatsPanel(): ReactElement | null {
  const project = useProjectStore((s) => s.project);
  const selectedTrackId = useProjectStore((s) => s.selectedTrackId);
  const setTrackElevations = useProjectStore((s) => s.setTrackElevations);
  const [baseSpeed, setBaseSpeed] = useState(4);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const track =
    project?.tracks.find((t) => t.id === selectedTrackId) ?? null;
  const stats = useMemo(() => (track === null ? null : trackStats(track)), [track]);

  if (track === null || stats === null) return null;

  const duration = naismithDuration(stats.distance, stats.ascent, stats.descent, {
    baseSpeedKmh: baseSpeed,
    descentCorrection: true,
  });

  async function correctElevation(): Promise<void> {
    if (track === null) return;
    setBusy(true);
    setMessage(null);
    try {
      const elevations = await fetchElevations(trackCoords(track));
      setTrackElevations(track.id, elevations);
      setMessage("Altitudes mises à jour.");
    } catch (cause) {
      setMessage(
        `Erreur : ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stats-panel">
      <div className="stats-title">{track.name}</div>
      <div className="stats-grid">
        <span>Distance</span>
        <strong>{formatDistance(stats.distance)}</strong>
        <span>D+</span>
        <strong>{Math.round(stats.ascent)} m</strong>
        <span>D−</span>
        <strong>{Math.round(stats.descent)} m</strong>
        <span>Alt min/max</span>
        <strong>
          {stats.eleMin === null
            ? "—"
            : `${Math.round(stats.eleMin)} / ${Math.round(stats.eleMax ?? stats.eleMin)} m`}
        </strong>
        <span>Pente moy/max</span>
        <strong>
          {stats.avgSlope.toFixed(1)} / {stats.maxSlope.toFixed(1)} %
        </strong>
        <span>Durée (Naismith)</span>
        <strong>{formatDuration(duration)}</strong>
      </div>
      <div className="stats-controls">
        <label>
          Vitesse{" "}
          <input
            type="number"
            min={1}
            max={12}
            step={0.5}
            value={baseSpeed}
            onChange={(e) => setBaseSpeed(Number(e.currentTarget.value))}
          />{" "}
          km/h
        </label>
        <button type="button" onClick={() => void correctElevation()} disabled={busy}>
          {busy ? "Correction…" : "Corriger l'altitude"}
        </button>
      </div>
      {message !== null && <span className="stats-message">{message}</span>}
    </div>
  );
}

function formatDistance(meters: number): string {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(2)} km`
    : `${Math.round(meters)} m`;
}

function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} h ${String(minutes).padStart(2, "0")}` : `${minutes} min`;
}
