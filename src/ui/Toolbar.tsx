import { useRef, useState } from "react";
import type { ChangeEvent, ReactElement } from "react";
import { GpxParseError, parseGpx } from "../core/gpx/parse-gpx";
import { buildGpx } from "../core/gpx/build-gpx";
import { trackPointCount } from "../core/model";
import { useProjectStore } from "../store/project-store";

/**
 * Barre d'outils principale (Phase 1) : ouverture et export de fichiers GPX.
 *
 * I/O fichier purement frontend (FileReader / Blob), donc fonctionnelle offline.
 * Aucune logique métier ici : le parsing/sérialisation vit dans `core/gpx`.
 */
export function Toolbar(): ReactElement {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const project = useProjectStore((s) => s.project);
  const loadProject = useProjectStore((s) => s.loadProject);
  const [error, setError] = useState<string | null>(null);

  async function importFile(file: File): Promise<void> {
    setError(null);
    try {
      const text = await file.text();
      const name = file.name.replace(/\.gpx$/i, "");
      loadProject(parseGpx(text, name));
    } catch (cause) {
      setError(
        cause instanceof GpxParseError
          ? cause.message
          : "Échec de l'import du fichier GPX.",
      );
    }
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.currentTarget.files?.[0];
    if (file !== undefined) void importFile(file);
    event.currentTarget.value = ""; // autorise le ré-import du même fichier
  }

  function exportGpx(): void {
    if (project === null) return;
    const xml = buildGpx(project);
    const blob = new Blob([xml], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.name.trim() || "export"}.gpx`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const pointTotal =
    project === null
      ? 0
      : project.tracks.reduce((sum, t) => sum + trackPointCount(t), 0);

  return (
    <div className="toolbar">
      <input
        ref={fileInputRef}
        type="file"
        accept=".gpx,application/gpx+xml"
        onChange={onInputChange}
        hidden
      />
      <button type="button" onClick={() => fileInputRef.current?.click()}>
        Ouvrir GPX
      </button>
      <button type="button" onClick={exportGpx} disabled={project === null}>
        Exporter GPX
      </button>

      {project !== null && (
        <span className="toolbar-info">
          {project.name} — {project.tracks.length} trace(s), {pointTotal} point(s),{" "}
          {project.waypoints.length} waypoint(s)
        </span>
      )}
      {error !== null && <span className="toolbar-error">⚠ {error}</span>}
    </div>
  );
}
