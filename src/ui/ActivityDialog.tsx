import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { ACTIVITY_SPORT_LABELS } from "../core/model";
import { trackStats } from "../core/geo/stats";
import {
  activityStats,
  hrZones,
  kmSplits,
  type HrZone,
  type KmSplit,
} from "../core/geo/activity-stats";
import { trackTimeBounds } from "../core/edit/activity-ops";
import { useProjectStore } from "../store/project-store";
import { useUiStore } from "../store/ui-store";
import { HR_ZONE_COLORS } from "../map/slope-layers";
import { IconPulse } from "./icons";

function fmtDuration(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")}`;
  const sec = s % 60;
  return m >= 10 ? `${m} min` : `${m}:${String(sec).padStart(2, "0")} min`;
}

function fmtSplitTime(seconds: number): string {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function fmtSpeed(ms: number): string {
  return `${(ms * 3.6).toFixed(1)} km/h`;
}

/** Allure (min/km) à partir d'une vitesse m/s. */
function fmtPace(ms: number): string {
  if (ms <= 0) return "—";
  const sPerKm = 1000 / ms;
  const m = Math.floor(sPerKm / 60);
  return `${m}:${String(Math.round(sPerKm % 60)).padStart(2, "0")} /km`;
}

/**
 * Panneau d'analyse d'activité : statistiques complètes, zones cardio,
 * temps de passage au km et recadrage temporel (réversible).
 */
export function ActivityDialog(): ReactElement | null {
  const open = useUiStore((s) => s.activityOpen);
  const setOpen = useUiStore((s) => s.setActivityOpen);
  const hrMax = useUiStore((s) => s.hrMax);
  const setHrMax = useUiStore((s) => s.setHrMax);
  const project = useProjectStore((s) => s.project);
  const selectedTrackId = useProjectStore((s) => s.selectedTrackId);
  const trimTrack = useProjectStore((s) => s.trimTrack);

  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  const track = project?.tracks.find((t) => t.id === selectedTrackId) ?? null;

  const geo = useMemo(() => (track === null ? null : trackStats(track)), [track]);
  const act = useMemo(() => (track === null ? null : activityStats(track)), [track]);
  const zones = useMemo(
    () => (track === null ? [] : hrZones(track, hrMax)),
    [track, hrMax],
  );
  const splits = useMemo(() => (track === null ? [] : kmSplits(track)), [track]);
  const bounds = useMemo(
    () => (track === null ? null : trackTimeBounds(track)),
    [track],
  );

  if (!open) return null;
  if (track === null || geo === null || act === null) {
    return (
      <div className="dialog-overlay" onClick={() => setOpen(false)}>
        <div className="dialog" onClick={(e) => e.stopPropagation()}>
          <div className="dialog-header">
            <span>Analyse d'activité</span>
            <button type="button" onClick={() => setOpen(false)}>✕</button>
          </div>
          <p className="dialog-sub">Sélectionner d'abord une trace.</p>
        </div>
      </div>
    );
  }

  const sportLabel =
    track.activity !== undefined
      ? ACTIVITY_SPORT_LABELS[track.activity.sport]
      : "Trace";
  const startDate =
    track.activity?.startTime !== undefined
      ? new Date(track.activity.startTime).toLocaleString("fr-FR", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : null;
  const zoneTotal = zones.reduce((s, z) => s + z.seconds, 0);
  const maxSplitTime = splits.reduce((m, s) => Math.max(m, s.seconds ?? 0), 0);
  const canTrim = bounds !== null;

  const cards: Array<[string, string]> = [];
  if (act.totalTime !== null) cards.push(["Temps total", fmtDuration(act.totalTime)]);
  if (act.movingTime !== null) cards.push(["En mouvement", fmtDuration(act.movingTime)]);
  cards.push(["Distance", `${(geo.distance / 1000).toFixed(2)} km`]);
  cards.push(["D+ / D−", `${Math.round(geo.ascent)} / ${Math.round(geo.descent)} m`]);
  if (act.avgSpeed !== null) {
    cards.push(["Vitesse moy", fmtSpeed(act.avgSpeed)]);
    cards.push(["Allure moy", fmtPace(act.avgSpeed)]);
  }
  if (act.maxSpeed !== null) cards.push(["Vitesse max", fmtSpeed(act.maxSpeed)]);
  if (act.vam !== null) cards.push(["VAM montée", `${Math.round(act.vam)} m/h`]);
  if (act.hrAvg !== null && act.hrMax !== null) {
    cards.push(["FC moy / max", `${Math.round(act.hrAvg)} / ${Math.round(act.hrMax)}`]);
  }
  if (act.cadenceAvg !== null) {
    cards.push(["Cadence moy", `${Math.round(act.cadenceAvg)} /min`]);
  }
  if (act.powerAvg !== null && act.powerMax !== null) {
    cards.push(["Puissance moy / max", `${Math.round(act.powerAvg)} / ${Math.round(act.powerMax)} W`]);
  }
  if (act.tempAvg !== null) cards.push(["Température moy", `${Math.round(act.tempAvg)} °C`]);

  return (
    <div className="dialog-overlay" onClick={() => setOpen(false)}>
      <div className="dialog activity-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span className="activity-title">
            <IconPulse size={15} /> {track.name}
          </span>
          <button type="button" onClick={() => setOpen(false)}>✕</button>
        </div>
        <p className="dialog-sub">
          {sportLabel}
          {startDate !== null ? ` · ${startDate}` : ""}
          {track.activity?.device !== undefined ? ` · ${track.activity.device}` : ""}
        </p>

        <div className="activity-grid">
          {cards.map(([label, value]) => (
            <div key={label} className="activity-card">
              <span className="activity-card-label">{label}</span>
              <span className="activity-card-value">{value}</span>
            </div>
          ))}
        </div>

        {zoneTotal > 0 && (
          <section className="activity-section">
            <div className="activity-section-head">
              <span>Zones cardio</span>
              <label className="profile-ctrl">
                FC max
                <input
                  type="number"
                  min={120}
                  max={230}
                  value={hrMax}
                  onChange={(e) => setHrMax(Number(e.currentTarget.value))}
                />
              </label>
            </div>
            <div className="hr-zones">
              {[...zones].reverse().map((z: HrZone) => (
                <div key={z.zone} className="hr-zone-row">
                  <span className="hr-zone-label">Z{z.zone}</span>
                  <div className="hr-zone-track">
                    <div
                      className="hr-zone-bar"
                      style={{
                        width: `${zoneTotal > 0 ? (z.seconds / zoneTotal) * 100 : 0}%`,
                        background: HR_ZONE_COLORS[z.zone - 1],
                      }}
                    />
                  </div>
                  <span className="hr-zone-time">
                    {z.seconds > 0 ? fmtDuration(z.seconds) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {splits.length > 1 && (
          <section className="activity-section">
            <div className="activity-section-head">
              <span>Temps de passage</span>
            </div>
            <ul className="splits-list">
              {splits.map((s: KmSplit) => (
                <li key={s.km} className="split-row">
                  <span className="split-km">
                    {s.distance < 1000 ? `${(s.distance / 1000).toFixed(1)}` : s.km}
                  </span>
                  <div className="split-track">
                    {s.seconds !== null && maxSplitTime > 0 && (
                      <div
                        className="split-bar"
                        style={{ width: `${(s.seconds / maxSplitTime) * 100}%` }}
                      />
                    )}
                  </div>
                  <span className="split-time">
                    {s.seconds !== null ? fmtSplitTime((s.seconds / s.distance) * 1000) : "—"}
                  </span>
                  <span className="split-ascent">
                    {s.ascent >= 1 ? `↗ ${Math.round(s.ascent)} m` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {canTrim && (
          <section className="activity-section">
            <div className="activity-section-head">
              <span>Recadrer l'activité</span>
            </div>
            <div className="dialog-row">
              <label className="profile-ctrl">
                Couper au début
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={trimStart}
                  onChange={(e) => setTrimStart(Math.max(0, Number(e.currentTarget.value)))}
                />
                min
              </label>
              <label className="profile-ctrl">
                à la fin
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={trimEnd}
                  onChange={(e) => setTrimEnd(Math.max(0, Number(e.currentTarget.value)))}
                />
                min
              </label>
              <button
                type="button"
                disabled={trimStart <= 0 && trimEnd <= 0}
                onClick={() => {
                  trimTrack(track.id, trimStart * 60, trimEnd * 60);
                  setTrimStart(0);
                  setTrimEnd(0);
                }}
              >
                Recadrer
              </button>
            </div>
            <p className="dialog-sub activity-trim-hint">
              Supprime les points hors fenêtre (réversible avec Ctrl+Z).
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
