import { useMemo, useState } from "react";
import type { PointerEvent, ReactElement } from "react";
import { useProjectStore } from "../store/project-store";
import { useMapStore } from "../store/map-store";
import { trackStats } from "../core/geo/stats";
import { naismithDuration } from "../core/geo/naismith";
import { buildProfile, type ProfilePoint } from "../core/geo/profile";
import { fetchElevations, trackCoords } from "../core/elevation/elevation-client";
import { SLOPE_LEGEND } from "../map/slope-layers";

/** Dimensions du graphe SVG (espace viewBox). */
const W = 800;
const H = 120;
const PAD = { top: 8, right: 10, bottom: 18, left: 42 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

/**
 * Dock bas : statistiques de la trace sélectionnée, durée Naismith, correction
 * d'altitude, coloration par pente, et profil altimétrique interactif (survol ↔ carte).
 */
export function ProfilePanel(): ReactElement | null {
  const project = useProjectStore((s) => s.project);
  const selectedTrackId = useProjectStore((s) => s.selectedTrackId);
  const setTrackElevations = useProjectStore((s) => s.setTrackElevations);
  const slopeColoring = useMapStore((s) => s.slopeColoring);
  const setSlopeColoring = useMapStore((s) => s.setSlopeColoring);
  const setHoverPoint = useMapStore((s) => s.setHoverPoint);

  const [baseSpeed, setBaseSpeed] = useState(4);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; pt: ProfilePoint } | null>(null);

  const track = project?.tracks.find((t) => t.id === selectedTrackId) ?? null;
  const stats = useMemo(() => (track === null ? null : trackStats(track)), [track]);
  const profile = useMemo(() => (track === null ? [] : buildProfile(track)), [track]);

  if (track === null || stats === null) return null;

  const duration = naismithDuration(stats.distance, stats.ascent, stats.descent, {
    baseSpeedKmh: baseSpeed,
    descentCorrection: true,
  });

  const hasProfile = profile.length >= 2;
  const last = profile[profile.length - 1];
  const maxDist = hasProfile && last !== undefined ? last.distance : 1;
  let minEle = Infinity;
  let maxEle = -Infinity;
  for (const p of profile) {
    if (p.ele < minEle) minEle = p.ele;
    if (p.ele > maxEle) maxEle = p.ele;
  }
  const eleRange = Math.max(1, maxEle - minEle);

  const xOf = (d: number): number => PAD.left + (d / maxDist) * INNER_W;
  const yOf = (e: number): number =>
    PAD.top + INNER_H - ((e - minEle) / eleRange) * INNER_H;
  const polyline = profile
    .map((p) => `${xOf(p.distance).toFixed(1)},${yOf(p.ele).toFixed(1)}`)
    .join(" ");

  function onPointerMove(ev: PointerEvent<SVGSVGElement>): void {
    if (!hasProfile) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    const svgX = ((ev.clientX - rect.left) / rect.width) * W;
    const d = ((svgX - PAD.left) / INNER_W) * maxDist;
    let nearest = profile[0]!;
    for (const p of profile) {
      if (Math.abs(p.distance - d) < Math.abs(nearest.distance - d)) nearest = p;
    }
    setHover({ x: xOf(nearest.distance), pt: nearest });
    setHoverPoint([nearest.lon, nearest.lat]);
  }

  function onPointerLeave(): void {
    setHover(null);
    setHoverPoint(null);
  }

  async function correctElevation(): Promise<void> {
    if (track === null) return;
    setBusy(true);
    setMessage(null);
    try {
      const elevations = await fetchElevations(trackCoords(track));
      setTrackElevations(track.id, elevations);
      setMessage("Altitudes mises à jour.");
    } catch (cause) {
      setMessage(`Erreur : ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="profile-panel">
      <div className="profile-header">
        <span className="profile-title">{track.name}</span>
        <span className="profile-stat">{formatDistance(stats.distance)}</span>
        <span className="profile-stat">D+ {Math.round(stats.ascent)} m</span>
        <span className="profile-stat">D− {Math.round(stats.descent)} m</span>
        <span className="profile-stat">
          {stats.eleMin === null
            ? "alt —"
            : `${Math.round(stats.eleMin)}–${Math.round(stats.eleMax ?? stats.eleMin)} m`}
        </span>
        <span className="profile-stat">
          pente {stats.avgSlope.toFixed(0)}/{stats.maxSlope.toFixed(0)} %
        </span>
        <span className="profile-stat">⏱ {formatDuration(duration)}</span>
        <label className="profile-ctrl">
          v
          <input
            type="number"
            min={1}
            max={12}
            step={0.5}
            value={baseSpeed}
            onChange={(e) => setBaseSpeed(Number(e.currentTarget.value))}
          />
          km/h
        </label>
        <label className="profile-ctrl">
          <input
            type="checkbox"
            checked={slopeColoring}
            onChange={(e) => setSlopeColoring(e.currentTarget.checked)}
          />
          pente
        </label>
        <button type="button" onClick={() => void correctElevation()} disabled={busy}>
          {busy ? "…" : "Corriger alt."}
        </button>
        {hover !== null && (
          <span className="profile-hover">
            {Math.round(hover.pt.ele)} m @ {(hover.pt.distance / 1000).toFixed(2)} km
          </span>
        )}
        {message !== null && <span className="profile-msg">{message}</span>}
      </div>

      {slopeColoring && (
        <div className="slope-legend">
          {SLOPE_LEGEND.map((l) => (
            <span key={l.label}>
              <i style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      )}

      {hasProfile ? (
        <svg
          className="profile-svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
        >
          <polyline points={polyline} fill="none" stroke="#0077b6" strokeWidth={1.5} />
          {hover !== null && (
            <g>
              <line
                x1={hover.x}
                x2={hover.x}
                y1={PAD.top}
                y2={H - PAD.bottom}
                stroke="#888"
                strokeWidth={1}
              />
              <circle cx={hover.x} cy={yOf(hover.pt.ele)} r={3.5} fill="#0077b6" />
            </g>
          )}
          <text x={4} y={PAD.top + 8} className="profile-axis">
            {Math.round(maxEle)}
          </text>
          <text x={4} y={H - PAD.bottom} className="profile-axis">
            {Math.round(minEle)}
          </text>
          <text x={W - PAD.right} y={H - 4} textAnchor="end" className="profile-axis">
            {(maxDist / 1000).toFixed(1)} km
          </text>
        </svg>
      ) : (
        <p className="profile-empty">
          Pas d'altitude sur cette trace — clique « Corriger alt. » pour les récupérer.
        </p>
      )}
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
