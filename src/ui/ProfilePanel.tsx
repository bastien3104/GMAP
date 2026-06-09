import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { useProjectStore } from "../store/project-store";
import { useMapStore } from "../store/map-store";
import { useUiStore } from "../store/ui-store";
import { trackStats } from "../core/geo/stats";
import { naismithDuration } from "../core/geo/naismith";
import { buildProfile } from "../core/geo/profile";
import { SLOPE_LEGEND } from "../map/slope-layers";
import { ElevationChart } from "./ElevationChart";

/**
 * Dock bas repliable : statistiques de la trace sélectionnée, durée Naismith et profil
 * altimétrique interactif (survol ↔ carte). Coloration & correction d'altitude : menus.
 */
export function ProfilePanel(): ReactElement | null {
  const project = useProjectStore((s) => s.project);
  const selectedTrackId = useProjectStore((s) => s.selectedTrackId);
  const slopeColoring = useMapStore((s) => s.slopeColoring);
  const setHoverPoint = useMapStore((s) => s.setHoverPoint);
  const collapsed = useUiStore((s) => s.profileCollapsed);
  const toggleProfile = useUiStore((s) => s.toggleProfile);

  const [baseSpeed, setBaseSpeed] = useState(4);

  const track = project?.tracks.find((t) => t.id === selectedTrackId) ?? null;
  const stats = useMemo(() => (track === null ? null : trackStats(track)), [track]);
  const profile = useMemo(() => (track === null ? [] : buildProfile(track)), [track]);

  if (track === null || stats === null) return null;

  const duration = naismithDuration(stats.distance, stats.ascent, stats.descent, {
    baseSpeedKmh: baseSpeed,
    descentCorrection: true,
  });

  return (
    <div className={collapsed ? "profile-panel collapsed" : "profile-panel"}>
      <div className="profile-header">
        <button
          type="button"
          className="profile-collapse"
          onClick={toggleProfile}
          title={collapsed ? "Déplier le profil" : "Replier le profil"}
        >
          {collapsed ? "▴" : "▾"}
        </button>
        <span className="profile-title">{track.name}</span>
        <span className="profile-stat">{formatDistance(stats.distance)}</span>
        <span className="profile-stat ascent">↗ {Math.round(stats.ascent)} m</span>
        <span className="profile-stat descent">↘ {Math.round(stats.descent)} m</span>
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
        {!collapsed && slopeColoring && (
          <span className="slope-legend">
            {SLOPE_LEGEND.map((l) => (
              <span key={l.label}>
                <i style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </span>
        )}
      </div>

      {!collapsed && (
        <ElevationChart
          points={profile}
          colorBySlope={slopeColoring}
          onHover={(p) => setHoverPoint(p === null ? null : [p.lon, p.lat])}
        />
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
