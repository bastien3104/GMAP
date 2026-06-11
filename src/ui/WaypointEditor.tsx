import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { useProjectStore } from "../store/project-store";
import {
  DEFAULT_WAYPOINT_SYMBOL,
  WAYPOINT_SYMBOLS,
} from "../core/model";
import type { WaypointPatch } from "../core/edit/waypoint-ops";

/**
 * Éditeur d'un point d'intérêt sélectionné (panneau ancré sur la carte).
 *
 * Édition d'un brouillon local validé via « Enregistrer » → une seule entrée
 * d'historique par session d'édition. L'altitude est pré-remplie (auto online) et
 * reste modifiable à la main.
 */
export function WaypointEditor(): ReactElement | null {
  const selectedId = useProjectStore((s) => s.selectedWaypointId);
  const waypoint = useProjectStore(
    (s) => s.project?.waypoints.find((w) => w.id === s.selectedWaypointId) ?? null,
  );
  const updateWaypoint = useProjectStore((s) => s.updateWaypoint);
  const deleteWaypoint = useProjectStore((s) => s.deleteWaypoint);
  const selectWaypoint = useProjectStore((s) => s.selectWaypoint);

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState(DEFAULT_WAYPOINT_SYMBOL);
  const [note, setNote] = useState("");
  const [ele, setEle] = useState("");

  // Recharge le brouillon à chaque changement de sélection.
  useEffect(() => {
    if (waypoint === null) return;
    setName(waypoint.name);
    setSymbol(waypoint.symbol ?? DEFAULT_WAYPOINT_SYMBOL);
    setNote(waypoint.note ?? "");
    setEle(waypoint.ele !== undefined ? String(Math.round(waypoint.ele)) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Reflète l'altitude renseignée en différé (enrichissement online post-pose).
  const wptEle = waypoint?.ele;
  useEffect(() => {
    if (wptEle !== undefined) setEle(String(Math.round(wptEle)));
  }, [wptEle]);

  if (selectedId === null || waypoint === null) return null;

  function save(): void {
    if (selectedId === null) return;
    const patch: WaypointPatch = {
      name: name.trim() || "Point d'intérêt",
      symbol,
      note: note.trim(),
    };
    const eleNum = Number(ele);
    if (ele.trim() !== "" && Number.isFinite(eleNum)) patch.ele = eleNum;
    updateWaypoint(selectedId, patch);
    selectWaypoint(null);
  }

  function remove(): void {
    if (selectedId !== null) deleteWaypoint(selectedId);
  }

  return (
    <div className="wpt-editor" onClick={(e) => e.stopPropagation()}>
      <div className="dialog-header">
        <span>Point d'intérêt</span>
        <button type="button" title="Fermer sans enregistrer" onClick={() => selectWaypoint(null)}>
          ✕
        </button>
      </div>

      <label className="wpt-field">
        <span>Nom</span>
        <input
          type="text"
          value={name}
          autoFocus
          onChange={(e) => setName(e.currentTarget.value)}
        />
      </label>

      <label className="wpt-field">
        <span>Symbole</span>
        <select value={symbol} onChange={(e) => setSymbol(e.currentTarget.value)}>
          {WAYPOINT_SYMBOLS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.glyph}  {s.label}
            </option>
          ))}
        </select>
      </label>

      <label className="wpt-field">
        <span>Altitude (m)</span>
        <input
          type="number"
          value={ele}
          placeholder="—"
          onChange={(e) => setEle(e.currentTarget.value)}
        />
      </label>

      <label className="wpt-field">
        <span>Note</span>
        <textarea value={note} onChange={(e) => setNote(e.currentTarget.value)} />
      </label>

      <div className="wpt-editor-actions">
        <button type="button" className="wpt-delete" onClick={remove}>
          Supprimer
        </button>
        <button type="button" onClick={save}>
          Enregistrer
        </button>
      </div>
    </div>
  );
}
