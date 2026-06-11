import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { useProjectStore } from "../store/project-store";
import { useMapStore } from "../store/map-store";
import { useUiStore } from "../store/ui-store";
import { trackStats } from "../core/geo/stats";
import { naismithDuration } from "../core/geo/naismith";
import { buildProfile } from "../core/geo/profile";
import { SLOPE_LEGEND } from "../map/slope-layers";
import { ElevationChart, NO_SERIES, type ChartSeries } from "./ElevationChart";
import { IconChevronDown, IconChevronUp } from "./icons";

/**
 * Dock bas repliable : statistiques de la trace sélectionnée, durée Naismith et profil
 * altimétrique interactif (survol ↔ carte). Coloration & correction d'altitude : menus.
 */
export function ProfilePanel(): ReactElement | null {
  const project = useProjectStore((s) => s.project);
  const selectedTrackId = useProjectStore((s) => s.selectedTrackId);
  const coloring = useMapStore((s) => s.coloring);
  const slopeColoring = coloring === "slope";
  const setHoverPoint = useMapStore((s) => s.setHoverPoint);
  const collapsed = useUiStore((s) => s.profileCollapsed);
  const toggleProfile = useUiStore((s) => s.toggleProfile);

  const [baseSpeed, setBaseSpeed] = useState(4);
  const [series, setSeries] = useState<ChartSeries>(NO_SERIES);
  const [compareId, setCompareId] = useState<string | null>(null);

  const track = project?.tracks.find((t) => t.id === selectedTrackId) ?? null;
  const stats = useMemo(() => (track === null ? null : trackStats(track)), [track]);
  const profile = useMemo(() => (track === null ? [] : buildProfile(track)), [track]);

  // Traces comparables : les autres traces du projet ayant de l'altitude.
  const compareCandidates = useMemo(
    () =>
      (project?.tracks ?? []).filter(
        (t) =>
          t.id !== selectedTrackId &&
          t.segments.some((seg) => seg.some((p) => p.ele !== undefined)),
      ),
    [project, selectedTrackId],
  );
  const compareTrack = compareCandidates.find((t) => t.id === compareId) ?? null;
  const compareProfile = useMemo(
    () => (compareTrack === null ? null : buildProfile(compareTrack)),
    [compareTrack],
  );

  // Métriques disponibles sur la trace sélectionnée (pills affichées si présentes).
  const available = useMemo(
    () => ({
      speed: profile.some((p) => p.speed !== undefined),
      hr: profile.some((p) => p.hr !== undefined),
      cadence: profile.some((p) => p.cadence !== undefined),
    }),
    [profile],
  );

  if (track === null || stats === null) return null;

  const toggleSeries = (key: keyof ChartSeries): void =>
    setSeries((s) => ({ ...s, [key]: !s[key] }));

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
          {collapsed ? <IconChevronUp size={13} /> : <IconChevronDown size={13} />}
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
        {!collapsed && (available.speed || available.hr || available.cadence) && (
          <span className="profile-series">
            {available.speed && (
              <button
                type="button"
                className={series.speed ? "series-pill speed active" : "series-pill speed"}
                onClick={() => toggleSeries("speed")}
                title="Superposer la vitesse au profil"
              >
                Vitesse
              </button>
            )}
            {available.hr && (
              <button
                type="button"
                className={series.hr ? "series-pill hr active" : "series-pill hr"}
                onClick={() => toggleSeries("hr")}
                title="Superposer la fréquence cardiaque au profil"
              >
                FC
              </button>
            )}
            {available.cadence && (
              <button
                type="button"
                className={
                  series.cadence ? "series-pill cadence active" : "series-pill cadence"
                }
                onClick={() => toggleSeries("cadence")}
                title="Superposer la cadence au profil"
              >
                Cadence
              </button>
            )}
          </span>
        )}
        {!collapsed && compareCandidates.length > 0 && (
          <label className="profile-ctrl profile-compare">
            comparer
            <select
              value={compareId ?? ""}
              onChange={(e) => {
                const v = e.currentTarget.value;
                setCompareId(v === "" ? null : v);
              }}
              title="Superposer le profil d'une autre trace"
            >
              <option value="">—</option>
              {compareCandidates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
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
          series={series}
          comparePoints={compareProfile}
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
