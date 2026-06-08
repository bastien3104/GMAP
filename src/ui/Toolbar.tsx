import { useRef, useState } from "react";
import type { ChangeEvent, ReactElement } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { GpxParseError, parseGpx } from "../core/gpx/parse-gpx";
import { buildGpx } from "../core/gpx/build-gpx";
import { trackPointCount } from "../core/model";
import { useProjectStore } from "../store/project-store";
import { BasemapSelector } from "./BasemapSelector";

/**
 * Barre d'outils principale (Phase 1) : ouverture et export de fichiers GPX.
 *
 * Import : lecture frontend (FileReader). Export : sous Tauri, boîte de dialogue
 * native « Enregistrer sous » (plugin dialog) + écriture FS côté Rust (commande
 * `save_text_file`) ; repli téléchargement Blob hors Tauri (dev navigateur).
 * Aucune logique métier ici : parsing/sérialisation vivent dans `core/gpx`.
 */
export function Toolbar(): ReactElement {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const project = useProjectStore((s) => s.project);
  const loadProject = useProjectStore((s) => s.loadProject);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function importFile(file: File): Promise<void> {
    setError(null);
    setStatus(null);
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

  async function exportGpx(): Promise<void> {
    if (project === null) return;
    setError(null);
    setStatus(null);
    const xml = buildGpx(project);
    const filename = `${project.name.trim() || "export"}.gpx`;

    try {
      if (isTauri()) {
        const path = await save({
          defaultPath: filename,
          filters: [{ name: "GPX", extensions: ["gpx"] }],
        });
        if (path === null) return; // annulé par l'utilisateur
        await invoke("save_text_file", { path, contents: xml });
        setStatus(`Exporté : ${path}`);
      } else {
        const blob = new Blob([xml], { type: "application/gpx+xml" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
        setStatus("Fichier exporté (dossier de téléchargements).");
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `Échec de l'export : ${cause.message}`
          : "Échec de l'export GPX.",
      );
    }
  }

  const pointTotal =
    project === null
      ? 0
      : project.tracks.reduce((sum, t) => sum + trackPointCount(t), 0);

  return (
    <div className="toolbar">
      <BasemapSelector />
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
      <button
        type="button"
        onClick={() => void exportGpx()}
        disabled={project === null}
      >
        Exporter GPX
      </button>

      {project !== null && (
        <span className="toolbar-info">
          {project.name} — {project.tracks.length} trace(s), {pointTotal} point(s),{" "}
          {project.waypoints.length} waypoint(s)
        </span>
      )}
      {status !== null && <span className="toolbar-status">✓ {status}</span>}
      {error !== null && <span className="toolbar-error">⚠ {error}</span>}
    </div>
  );
}
