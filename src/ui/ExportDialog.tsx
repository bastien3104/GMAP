import { useState } from "react";
import type { ReactElement } from "react";
import { useProjectStore } from "../store/project-store";
import { useUiStore } from "../store/ui-store";
import { buildGpx } from "../core/gpx/build-gpx";
import { buildGeoJson } from "../core/export/geojson-export";
import { buildKml } from "../core/export/kml";
import { buildTcx } from "../core/export/tcx";
import { buildFit } from "../core/export/fit";
import { subsetProject } from "../core/export/subset";
import type { Project } from "../core/model";
import { saveBinaryExport, saveTextExport } from "./export-save";

/** Formats d'export disponibles (texte sauf FIT, binaire). */
interface ExportFormat {
  id: string;
  label: string;
  ext: string;
  binary: boolean;
  build: (project: Project) => string | Uint8Array;
}

const FORMATS: readonly ExportFormat[] = [
  { id: "gpx", label: "GPX", ext: "gpx", binary: false, build: buildGpx },
  { id: "geojson", label: "GeoJSON", ext: "geojson", binary: false, build: buildGeoJson },
  { id: "kml", label: "KML", ext: "kml", binary: false, build: buildKml },
  { id: "tcx", label: "TCX", ext: "tcx", binary: false, build: buildTcx },
  { id: "fit", label: "FIT", ext: "fit", binary: true, build: buildFit },
];

/** Dialogue d'export sélectif : choix du format, des traces et des points d'intérêt. */
export function ExportDialog(): ReactElement | null {
  const open = useUiStore((s) => s.exportOpen);
  const setOpen = useUiStore((s) => s.setExportOpen);
  const project = useProjectStore((s) => s.project);

  const [formatId, setFormatId] = useState("gpx");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [includeWaypoints, setIncludeWaypoints] = useState(true);
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!open || project === null) return null;

  // (Ré)initialise la sélection (toutes les traces cochées) au changement de projet.
  if (seededFor !== project.id) {
    setSeededFor(project.id);
    setSelected(new Set(project.tracks.map((t) => t.id)));
    setMessage(null);
  }

  const format = FORMATS.find((f) => f.id === formatId) ?? FORMATS[0]!;
  const hasWaypoints = project.waypoints.length > 0;
  const nothingSelected = selected.size === 0 && !(includeWaypoints && hasWaypoints);

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setAll(value: boolean): void {
    setSelected(value ? new Set(project!.tracks.map((t) => t.id)) : new Set());
  }

  async function doExport(): Promise<void> {
    if (project === null) return;
    const subset = subsetProject(project, selected, includeWaypoints);
    const filename = `${project.name.trim() || "export"}.${format.ext}`;
    setMessage(null);
    try {
      const content = format.build(subset);
      const path = format.binary
        ? await saveBinaryExport(content as Uint8Array, filename, format.ext)
        : await saveTextExport(content as string, filename, format.ext);
      if (path !== null) {
        setMessage(`Exporté : ${path}`);
      }
    } catch (cause) {
      setMessage(`Échec de l'export : ${cause instanceof Error ? cause.message : ""}`);
    }
  }

  return (
    <div className="dialog-overlay" onClick={() => setOpen(false)}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span>Exporter (sélection)</span>
          <button type="button" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>

        <div className="wpt-field">
          <span>Format</span>
          <select value={formatId} onChange={(e) => setFormatId(e.currentTarget.value)}>
            {FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div className="export-tracks">
          <div className="export-tracks-head">
            <span>Traces ({selected.size}/{project.tracks.length})</span>
            <span>
              <button type="button" onClick={() => setAll(true)}>Tout</button>
              <button type="button" onClick={() => setAll(false)}>Rien</button>
            </span>
          </div>
          {project.tracks.length === 0 ? (
            <p className="dialog-sub">Aucune trace.</p>
          ) : (
            <ul className="export-track-list">
              {project.tracks.map((t) => (
                <li key={t.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.has(t.id)}
                      onChange={() => toggle(t.id)}
                    />
                    <span style={{ color: t.color }}>●</span> {t.name}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {hasWaypoints && (
          <label className="export-wpt">
            <input
              type="checkbox"
              checked={includeWaypoints}
              onChange={(e) => setIncludeWaypoints(e.currentTarget.checked)}
            />
            Inclure les points d'intérêt ({project.waypoints.length})
          </label>
        )}

        <div className="dialog-actions">
          <button type="button" onClick={() => void doExport()} disabled={nothingSelected}>
            Exporter
          </button>
        </div>
        {message !== null && <p className="dialog-message">{message}</p>}
      </div>
    </div>
  );
}
