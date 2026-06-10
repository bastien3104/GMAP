import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactElement } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { BASEMAPS } from "../map/basemaps";
import { GpxParseError, parseGpx } from "../core/gpx/parse-gpx";
import { buildGpx } from "../core/gpx/build-gpx";
import { buildGeoJson } from "../core/export/geojson-export";
import { buildKml } from "../core/export/kml";
import { buildTcx } from "../core/export/tcx";
import { createDrawingTrack } from "../core/edit/draw-ops";
import { fetchElevations, trackCoords } from "../core/elevation/elevation-client";
import { DEFAULT_SPIKE_THRESHOLD_M } from "../core/geo/elevation-clean";
import { useProjectStore } from "../store/project-store";
import { useMapStore } from "../store/map-store";
import { useUiStore } from "../store/ui-store";
import { Menu, MenuItem, MenuSeparator } from "./Menu";

/** Barre de menus principale (Fichier / Édition / Carte / Outils) + indicateur réseau. */
export function MenuBar(): ReactElement {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const project = useProjectStore((s) => s.project);
  const selectedTrackId = useProjectStore((s) => s.selectedTrackId);
  const loadProject = useProjectStore((s) => s.loadProject);
  const addTrack = useProjectStore((s) => s.addTrack);
  const setTrackElevations = useProjectStore((s) => s.setTrackElevations);
  const past = useProjectStore((s) => s.past);
  const future = useProjectStore((s) => s.future);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const reverseTrack = useProjectStore((s) => s.reverseTrack);
  const convertTrackKind = useProjectStore((s) => s.convertTrackKind);
  const mergeVisibleTracks = useProjectStore((s) => s.mergeVisibleTracks);
  const cleanElevationSpikes = useProjectStore((s) => s.cleanElevationSpikes);

  const activeBasemapId = useMapStore((s) => s.activeBasemapId);
  const setBasemap = useMapStore((s) => s.setBasemap);
  const slopeColoring = useMapStore((s) => s.slopeColoring);
  const setSlopeColoring = useMapStore((s) => s.setSlopeColoring);
  const offline = useMapStore((s) => s.offline);
  const setOffline = useMapStore((s) => s.setOffline);
  const editMode = useMapStore((s) => s.editMode);
  const setEditMode = useMapStore((s) => s.setEditMode);
  const drawMode = useMapStore((s) => s.drawMode);
  const setDrawMode = useMapStore((s) => s.setDrawMode);

  const setDownloadOpen = useUiStore((s) => s.setDownloadOpen);
  const setSplitOpen = useUiStore((s) => s.setSplitOpen);
  const setSimplifyOpen = useUiStore((s) => s.setSimplifyOpen);
  const setSmoothOpen = useUiStore((s) => s.setSmoothOpen);

  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [status, setStatus] = useState<string | null>(null);

  // Connectivité réseau.
  useEffect(() => {
    const up = (): void => setOnline(true);
    const down = (): void => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  // Sortie auto du mode édition si plus aucune trace sélectionnée.
  useEffect(() => {
    if (selectedTrackId === null && editMode) setEditMode(false);
  }, [selectedTrackId, editMode, setEditMode]);

  function flash(message: string): void {
    setStatus(message);
    window.setTimeout(() => setStatus(null), 4000);
  }

  async function importFile(file: File): Promise<void> {
    try {
      const text = await file.text();
      loadProject(parseGpx(text, file.name.replace(/\.gpx$/i, "")));
    } catch (cause) {
      flash(
        cause instanceof GpxParseError ? cause.message : "Échec de l'import GPX.",
      );
    }
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.currentTarget.files?.[0];
    if (file !== undefined) void importFile(file);
    event.currentTarget.value = "";
  }

  async function saveAs(content: string, ext: string): Promise<void> {
    if (project === null) return;
    const filename = `${project.name.trim() || "export"}.${ext}`;
    try {
      if (isTauri()) {
        const path = await save({
          defaultPath: filename,
          filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
        });
        if (path === null) return;
        await invoke("save_text_file", { path, contents: content });
        flash(`Exporté : ${path}`);
      } else {
        const url = URL.createObjectURL(new Blob([content]));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
        flash("Fichier exporté.");
      }
    } catch (cause) {
      flash(`Échec de l'export : ${cause instanceof Error ? cause.message : ""}`);
    }
  }

  function toggleDraw(): void {
    if (drawMode) {
      setDrawMode(false);
    } else {
      addTrack(createDrawingTrack());
      setDrawMode(true);
    }
  }

  async function correctElevation(): Promise<void> {
    const track = project?.tracks.find((t) => t.id === selectedTrackId);
    if (track === undefined) return;
    flash("Correction d'altitude…");
    try {
      const elevations = await fetchElevations(trackCoords(track));
      setTrackElevations(track.id, elevations);
      flash("Altitudes mises à jour.");
    } catch (cause) {
      flash(`Erreur altitude : ${cause instanceof Error ? cause.message : ""}`);
    }
  }

  const hasProject = project !== null;
  const hasSelection = selectedTrackId !== null;
  const selectedTrack = project?.tracks.find((t) => t.id === selectedTrackId) ?? null;
  const visibleCount = project?.tracks.filter((t) => t.visible).length ?? 0;

  return (
    <div className="menubar">
      <input
        ref={fileInputRef}
        type="file"
        accept=".gpx,application/gpx+xml"
        onChange={onInputChange}
        hidden
      />

      <Menu label="Fichier">
        <MenuItem label="Ouvrir GPX…" onSelect={() => fileInputRef.current?.click()} />
        <MenuSeparator />
        <MenuItem
          label="Exporter GPX…"
          onSelect={() => {
            if (project !== null) void saveAs(buildGpx(project), "gpx");
          }}
          disabled={!hasProject}
        />
        <MenuItem
          label="Exporter GeoJSON…"
          onSelect={() => {
            if (project !== null) void saveAs(buildGeoJson(project), "geojson");
          }}
          disabled={!hasProject}
        />
        <MenuItem
          label="Exporter KML…"
          onSelect={() => {
            if (project !== null) void saveAs(buildKml(project), "kml");
          }}
          disabled={!hasProject}
        />
        <MenuItem
          label="Exporter TCX…"
          onSelect={() => {
            if (project !== null) void saveAs(buildTcx(project), "tcx");
          }}
          disabled={!hasProject}
        />
      </Menu>

      <div className="menubar-group" aria-label="Édition">
        <button type="button" className="menubar-btn" onClick={undo} disabled={past.length === 0} title="Annuler (Ctrl+Z)">↶</button>
        <button type="button" className="menubar-btn" onClick={redo} disabled={future.length === 0} title="Rétablir (Ctrl+Y)">↷</button>
        <button
          type="button"
          className={drawMode ? "menubar-btn active" : "menubar-btn"}
          onClick={toggleDraw}
          title="Dessiner une trace"
        >
          ✏ Dessiner
        </button>
        <button
          type="button"
          className={editMode ? "menubar-btn active" : "menubar-btn"}
          onClick={() => setEditMode(!editMode)}
          disabled={!hasSelection}
          title="Éditer les points de la trace sélectionnée"
        >
          ✎ Éditer
        </button>
      </div>

      <Menu label="Carte">
        {BASEMAPS.map((b) => (
          <MenuItem
            key={b.id}
            label={b.label}
            checked={b.id === activeBasemapId}
            onSelect={() => setBasemap(b.id)}
          />
        ))}
        <MenuSeparator />
        <MenuItem
          label="Coloration par pente"
          checked={slopeColoring}
          onSelect={() => setSlopeColoring(!slopeColoring)}
        />
        <MenuItem
          label="Mode hors-ligne"
          checked={offline}
          onSelect={() => setOffline(!offline)}
        />
      </Menu>

      <Menu label="Outils">
        <MenuItem
          label="Inverser le sens"
          onSelect={() => {
            if (selectedTrackId !== null) reverseTrack(selectedTrackId);
          }}
          disabled={!hasSelection}
        />
        <MenuItem
          label={selectedTrack?.kind === "route" ? "Convertir en trace" : "Convertir en route"}
          onSelect={() => {
            if (selectedTrackId !== null) convertTrackKind(selectedTrackId);
          }}
          disabled={!hasSelection}
        />
        <MenuItem
          label="Fusionner les traces visibles"
          onSelect={mergeVisibleTracks}
          disabled={visibleCount < 2}
        />
        <MenuItem
          label="Découper par distance…"
          onSelect={() => setSplitOpen(true)}
          disabled={!hasSelection}
        />
        <MenuSeparator />
        <MenuItem
          label="Simplifier…"
          onSelect={() => setSimplifyOpen(true)}
          disabled={!hasSelection}
        />
        <MenuItem
          label="Lisser…"
          onSelect={() => setSmoothOpen(true)}
          disabled={!hasSelection}
        />
        <MenuItem
          label="Supprimer les pics d'altitude"
          onSelect={() => {
            if (selectedTrackId !== null)
              cleanElevationSpikes(selectedTrackId, DEFAULT_SPIKE_THRESHOLD_M);
          }}
          disabled={!hasSelection}
        />
        <MenuSeparator />
        <MenuItem
          label="Corriger l'altitude"
          onSelect={() => void correctElevation()}
          disabled={!hasSelection}
        />
        <MenuItem label="Télécharger la zone…" onSelect={() => setDownloadOpen(true)} />
      </Menu>

      <div className="menubar-spacer" />
      {status !== null && <span className="menubar-status">{status}</span>}
      <span className="menubar-net">
        <span className={online ? "dot dot-online" : "dot dot-offline"} />
        {offline ? "Hors-ligne (forcé)" : online ? "En ligne" : "Hors ligne"}
      </span>
    </div>
  );
}
