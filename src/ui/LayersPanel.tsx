import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import type { Track } from "../core/model";
import { useProjectStore } from "../store/project-store";

/**
 * Panneau de calques : gère les traces du projet (visibilité, couleur, nom, ordre,
 * suppression, sélection) avec annuler/rétablir. Masqué tant qu'aucun projet n'est ouvert.
 */
export function LayersPanel(): ReactElement | null {
  const project = useProjectStore((s) => s.project);
  const past = useProjectStore((s) => s.past);
  const future = useProjectStore((s) => s.future);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);

  if (project === null) return null;

  return (
    <div className="layers-panel">
      <div className="layers-header">
        <span>Calques ({project.tracks.length})</span>
        <span className="layers-actions">
          <button
            type="button"
            onClick={undo}
            disabled={past.length === 0}
            title="Annuler (Ctrl+Z)"
          >
            ↶
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={future.length === 0}
            title="Rétablir (Ctrl+Y)"
          >
            ↷
          </button>
        </span>
      </div>
      {project.tracks.length === 0 ? (
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
    </div>
  );
}

interface TrackRowProps {
  track: Track;
  index: number;
  count: number;
}

/** Ligne d'une trace ; nom et couleur sont commités au blur (une entrée d'historique). */
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

  return (
    <li
      className={isSelected ? "layer-row selected" : "layer-row"}
      onClick={() => selectTrack(track.id)}
    >
      <input
        type="checkbox"
        checked={track.visible}
        onChange={() => toggleVisibility(track.id)}
        onClick={(e) => e.stopPropagation()}
        title="Visibilité"
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
      <input
        className="layer-name"
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
      <span className="layer-meta">{track.kind === "route" ? "route" : "trace"}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          move(track.id, "up");
        }}
        disabled={index === 0}
        title="Monter"
      >
        ▲
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
        ▼
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          remove(track.id);
        }}
        title="Supprimer"
      >
        ✕
      </button>
    </li>
  );
}
