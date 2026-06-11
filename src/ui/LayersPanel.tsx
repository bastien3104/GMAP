import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import {
  ACTIVITY_SPORT_LABELS,
  waypointSymbol,
  type Track,
  type Waypoint,
} from "../core/model";
import { trackStats } from "../core/geo/stats";
import { activityStats, type ActivityStats } from "../core/geo/activity-stats";
import { useProjectStore } from "../store/project-store";
import { useUiStore } from "../store/ui-store";
import { flyTo } from "../map/map-ref";
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconPulse,
} from "./icons";

/**
 * Panneau de calques ancré à gauche (rétractable) : gestion des traces
 * (visibilité, couleur, nom, ordre, suppression, sélection). Les actions globales
 * (annuler/rétablir, éditer) sont dans la barre de menus.
 */
export function LayersPanel(): ReactElement {
  const project = useProjectStore((s) => s.project);
  const collapsed = useUiStore((s) => s.layersCollapsed);
  const toggle = useUiStore((s) => s.toggleLayers);

  if (collapsed) {
    return (
      <aside className="layers-panel collapsed">
        <button
          type="button"
          className="layers-collapse"
          onClick={toggle}
          title="Afficher les calques"
        >
          <IconChevronRight size={13} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="layers-panel">
      <div className="layers-header">
        <span>Calques{project !== null ? ` (${project.tracks.length})` : ""}</span>
        <button
          type="button"
          className="layers-collapse"
          onClick={toggle}
          title="Masquer les calques"
        >
          <IconChevronLeft size={13} />
        </button>
      </div>
      {project === null ? (
        <p className="layers-empty">Aucun projet ouvert.</p>
      ) : project.tracks.length === 0 ? (
        <p className="layers-empty">Aucune trace.</p>
      ) : (
        <ul className="layers-list">
          {project.tracks.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index}
              count={project.tracks.length}
            />
          ))}
        </ul>
      )}

      {project !== null && project.waypoints.length > 0 && (
        <>
          <div className="layers-header">
            <span>Points d'intérêt ({project.waypoints.length})</span>
          </div>
          <ul className="layers-list">
            {project.waypoints.map((wpt) => (
              <WaypointRow key={wpt.id} waypoint={wpt} />
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}

/** Ligne d'un point d'intérêt : sélection + recadrage, suppression. */
function WaypointRow({ waypoint }: { waypoint: Waypoint }): ReactElement {
  const selectedWaypointId = useProjectStore((s) => s.selectedWaypointId);
  const selectWaypoint = useProjectStore((s) => s.selectWaypoint);
  const remove = useProjectStore((s) => s.deleteWaypoint);

  const isSelected = waypoint.id === selectedWaypointId;
  const sym = waypointSymbol(waypoint.symbol);

  return (
    <li
      className={isSelected ? "layer-row selected" : "layer-row"}
      onClick={() => {
        selectWaypoint(waypoint.id);
        flyTo(waypoint.lon, waypoint.lat);
      }}
    >
      <span className="layer-meta" title={sym.label}>
        {sym.glyph}
      </span>
      <span className="layer-name">{waypoint.name}</span>
      {waypoint.ele !== undefined && (
        <span className="layer-meta">{Math.round(waypoint.ele)} m</span>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          remove(waypoint.id);
        }}
        title="Supprimer"
      >
        <IconClose size={13} />
      </button>
    </li>
  );
}

interface TrackRowProps {
  track: Track;
  index: number;
  count: number;
}

/** Formate une distance en mètres (UI). */
function formatDistance(meters: number): string {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} km`
    : `${Math.round(meters)} m`;
}

/** Formate une durée en secondes (UI) : « 2 h 34 » ou « 48 min ». */
function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} h ${String(minutes).padStart(2, "0")}` : `${minutes} min`;
}

/** Carte d'une trace (nom, distance, D+) ; nom et couleur commités au blur. */
function TrackRow({ track, index, count }: TrackRowProps): ReactElement {
  const selectedTrackId = useProjectStore((s) => s.selectedTrackId);
  const selectTrack = useProjectStore((s) => s.selectTrack);
  const toggleVisibility = useProjectStore((s) => s.toggleTrackVisibility);
  const setColor = useProjectStore((s) => s.setTrackColor);
  const rename = useProjectStore((s) => s.renameTrack);
  const move = useProjectStore((s) => s.moveTrack);
  const remove = useProjectStore((s) => s.deleteTrack);

  const [name, setName] = useState(track.name);
  const [color, setColorDraft] = useState(track.color);
  useEffect(() => setName(track.name), [track.name]);
  useEffect(() => setColorDraft(track.color), [track.color]);

  const isSelected = track.id === selectedTrackId;
  const stats = useMemo(() => trackStats(track), [track]);
  const activity = track.activity;
  const aStats: ActivityStats | null = useMemo(
    () => (activity === undefined ? null : activityStats(track)),
    [track, activity],
  );

  const cardClass = [
    "track-card",
    isSelected ? "selected" : "",
    track.visible ? "" : "muted",
  ]
    .filter((c) => c !== "")
    .join(" ");

  return (
    <li className={cardClass} onClick={() => selectTrack(track.id)}>
      <span className="track-card-edge" style={{ background: track.color }} />
      <div className="track-card-body">
        <div className="track-card-top">
          <input
            type="checkbox"
            checked={track.visible}
            onChange={() => toggleVisibility(track.id)}
            onClick={(e) => e.stopPropagation()}
            title="Visibilité"
          />
          <input
            className="track-card-name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            onBlur={() => {
              if (name !== track.name) rename(track.id, name);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColorDraft(e.currentTarget.value)}
            onBlur={() => {
              if (color !== track.color) setColor(track.id, color);
            }}
            onClick={(e) => e.stopPropagation()}
            title="Couleur"
          />
        </div>
        <div className="track-card-stats">
          <span className="track-stat" title="Distance">
            {formatDistance(stats.distance)}
          </span>
          <span className="track-stat ascent" title="Dénivelé positif">
            ↗ {Math.round(stats.ascent)} m
          </span>
          {aStats?.movingTime != null && (
            <span className="track-stat" title="Temps en mouvement">
              ⏱ {formatDuration(aStats.movingTime)}
            </span>
          )}
          {aStats?.hrAvg != null && (
            <span className="track-stat hr" title="Fréquence cardiaque moyenne">
              ♥ {Math.round(aStats.hrAvg)}
            </span>
          )}
          {activity !== undefined ? (
            <span className="track-badge-activity" title={activity.device ?? "Activité"}>
              <IconPulse size={11} /> {ACTIVITY_SPORT_LABELS[activity.sport]}
            </span>
          ) : (
            <span className="track-kind">
              {track.kind === "route" ? "route" : "trace"}
            </span>
          )}
        </div>
      </div>
      <div className="track-card-actions">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            move(track.id, "up");
          }}
          disabled={index === 0}
          title="Monter"
        >
          <IconArrowUp size={12} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            remove(track.id);
          }}
          title="Supprimer"
        >
          <IconClose size={12} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            move(track.id, "down");
          }}
          disabled={index === count - 1}
          title="Descendre"
        >
          <IconArrowDown size={12} />
        </button>
      </div>
    </li>
  );
}
