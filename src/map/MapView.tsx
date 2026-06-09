import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { FeatureCollection } from "geojson";
import maplibregl from "maplibre-gl";
import type {
  MapLayerMouseEvent,
  MapMouseEvent,
  StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BASEMAPS } from "./basemaps";
import {
  basemapLayer,
  basemapLayerId,
  basemapRasterSource,
  basemapSourceId,
} from "./map-style";
import {
  PROJECT_SOURCE_ID,
  trackLineLayer,
  waypointCircleLayer,
} from "./track-layers";
import {
  buildEditFeatures,
  midpointsLayer,
  verticesLayer,
  MIDPOINTS_LAYER_ID,
  MIDPOINTS_SOURCE_ID,
  VERTICES_LAYER_ID,
  VERTICES_SOURCE_ID,
  type SelectedVertex,
} from "./edit-layers";
import { setMapInstance } from "./map-ref";
import { useProjectStore } from "../store/project-store";
import { useMapStore } from "../store/map-store";
import { deletePoint, insertPoint, movePoint } from "../core/edit/point-ops";
import { appendPoint, appendPoints } from "../core/edit/draw-ops";
import { trackPointCount, type Project, type TrackPoint } from "../core/model";
import { projectBounds, projectToGeoJSON } from "../core/geojson/to-geojson";

/** Vue initiale : centre approximatif de la France métropolitaine. */
const FRANCE_CENTER: [number, number] = [2.4, 46.6];
const INITIAL_ZOOM = 5;
const EMPTY_DATA: FeatureCollection = { type: "FeatureCollection", features: [] };
const EMPTY_STYLE: StyleSpecification = { version: 8, sources: {}, layers: [] };

interface DragState {
  segmentIndex: number;
  pointIndex: number;
  moved: boolean;
  baseProject: Project | null;
}

/**
 * Composant carte MapLibre : fonds, données du projet, et mode édition des points
 * de la trace sélectionnée (poignées déplaçables, insertion, suppression). Aucune
 * logique métier ici — les opérations pures vivent dans `core/edit`.
 */
export function MapView(): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const project = useProjectStore((s) => s.project);
  const selectedTrackId = useProjectStore((s) => s.selectedTrackId);
  const activeBasemapId = useMapStore((s) => s.activeBasemapId);
  const editMode = useMapStore((s) => s.editMode);
  const drawMode = useMapStore((s) => s.drawMode);
  const freehand = useMapStore((s) => s.freehand);
  const lastFittedProjectId = useRef<string | null>(null);
  const wasDrawing = useRef(false);
  const selectedVertexRef = useRef<SelectedVertex | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const rebuildHandlesRef = useRef<(() => void) | null>(null);

  // Initialisation de la carte (une seule fois).
  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    const map = new maplibregl.Map({
      container,
      style: EMPTY_STYLE,
      center: FRANCE_CENTER,
      zoom: INITIAL_ZOOM,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(
      new maplibregl.AttributionControl({ compact: false }),
      "bottom-right",
    );

    map.on("load", () => {
      const active = useMapStore.getState().activeBasemapId;
      for (const basemap of BASEMAPS) {
        map.addSource(basemapSourceId(basemap.id), basemapRasterSource(basemap));
        map.addLayer(basemapLayer(basemap, basemap.id === active));
      }
      map.addSource(PROJECT_SOURCE_ID, { type: "geojson", data: EMPTY_DATA });
      map.addLayer(trackLineLayer);
      map.addLayer(waypointCircleLayer);
      setMapReady(true);
    });

    mapRef.current = map;
    setMapInstance(map);
    return () => {
      setMapInstance(null);
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Bascule de fond (visibilité des couches).
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !mapReady) return;
    for (const basemap of BASEMAPS) {
      map.setLayoutProperty(
        basemapLayerId(basemap.id),
        "visibility",
        basemap.id === activeBasemapId ? "visible" : "none",
      );
    }
  }, [activeBasemapId, mapReady]);

  // Synchronise les données du projet ; recadre seulement au chargement d'un projet.
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !mapReady) return;
    const source = map.getSource(PROJECT_SOURCE_ID);
    if (source === undefined) return;
    const data =
      project === null ? EMPTY_DATA : projectToGeoJSON(project, selectedTrackId);
    (source as maplibregl.GeoJSONSource).setData(data);

    if (project === null) {
      lastFittedProjectId.current = null;
      return;
    }
    if (project.id !== lastFittedProjectId.current) {
      lastFittedProjectId.current = project.id;
      const bounds = projectBounds(project);
      if (bounds !== null) {
        const [minLon, minLat, maxLon, maxLat] = bounds;
        map.fitBounds(
          [
            [minLon, minLat],
            [maxLon, maxLat],
          ],
          { padding: 48, maxZoom: 15, duration: 600 },
        );
      }
    }
  }, [project, selectedTrackId, mapReady]);

  // Mode édition : poignées (sommets + milieux), déplacement, insertion, suppression.
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !mapReady || !editMode || selectedTrackId === null) return;

    const currentTrack = () => {
      const st = useProjectStore.getState();
      return st.project?.tracks.find((t) => t.id === st.selectedTrackId);
    };
    const setData = (id: string, data: FeatureCollection): void => {
      (map.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData(data);
    };

    if (map.getSource(VERTICES_SOURCE_ID) === undefined) {
      map.addSource(VERTICES_SOURCE_ID, { type: "geojson", data: EMPTY_DATA });
    }
    if (map.getSource(MIDPOINTS_SOURCE_ID) === undefined) {
      map.addSource(MIDPOINTS_SOURCE_ID, { type: "geojson", data: EMPTY_DATA });
    }
    if (map.getLayer(MIDPOINTS_LAYER_ID) === undefined) map.addLayer(midpointsLayer);
    if (map.getLayer(VERTICES_LAYER_ID) === undefined) map.addLayer(verticesLayer);

    const rebuild = (): void => {
      const track = currentTrack();
      if (track === undefined) return;
      const { vertices, midpoints } = buildEditFeatures(
        track,
        selectedVertexRef.current,
      );
      setData(VERTICES_SOURCE_ID, vertices);
      setData(MIDPOINTS_SOURCE_ID, midpoints);
    };
    rebuildHandlesRef.current = rebuild;
    rebuild();

    const onEnter = (): void => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onLeave = (): void => {
      if (dragRef.current === null) map.getCanvas().style.cursor = "";
    };

    const onVertexDown = (e: MapLayerMouseEvent): void => {
      const feature = e.features?.[0];
      if (feature === undefined) return;
      e.preventDefault();
      map.dragPan.disable();
      dragRef.current = {
        segmentIndex: Number(feature.properties?.["segmentIndex"]),
        pointIndex: Number(feature.properties?.["pointIndex"]),
        moved: false,
        baseProject: useProjectStore.getState().project,
      };
    };

    const onMove = (e: MapMouseEvent): void => {
      const drag = dragRef.current;
      if (drag === null || drag.baseProject === null) return;
      drag.moved = true;
      const trackId = useProjectStore.getState().selectedTrackId;
      if (trackId === null) return;
      const transient = movePoint(
        drag.baseProject,
        trackId,
        drag.segmentIndex,
        drag.pointIndex,
        e.lngLat.lng,
        e.lngLat.lat,
      );
      setData(PROJECT_SOURCE_ID, projectToGeoJSON(transient, trackId));
      const track = transient.tracks.find((t) => t.id === trackId);
      if (track !== undefined) {
        const { vertices, midpoints } = buildEditFeatures(
          track,
          selectedVertexRef.current,
        );
        setData(VERTICES_SOURCE_ID, vertices);
        setData(MIDPOINTS_SOURCE_ID, midpoints);
      }
    };

    const onUp = (e: MapMouseEvent): void => {
      const drag = dragRef.current;
      if (drag === null) return;
      dragRef.current = null;
      map.dragPan.enable();
      map.getCanvas().style.cursor = "";
      const trackId = useProjectStore.getState().selectedTrackId;
      if (trackId === null) return;
      if (drag.moved) {
        const { lng, lat } = e.lngLat;
        useProjectStore
          .getState()
          .applyEdit((p) =>
            movePoint(p, trackId, drag.segmentIndex, drag.pointIndex, lng, lat),
          );
      } else {
        selectedVertexRef.current = {
          segmentIndex: drag.segmentIndex,
          pointIndex: drag.pointIndex,
        };
        rebuild();
      }
    };

    const onMidpointDown = (e: MapLayerMouseEvent): void => {
      const feature = e.features?.[0];
      if (feature === undefined) return;
      e.preventDefault();
      const trackId = useProjectStore.getState().selectedTrackId;
      if (trackId === null) return;
      const segmentIndex = Number(feature.properties?.["segmentIndex"]);
      const insertIndex = Number(feature.properties?.["insertIndex"]);
      const { lng, lat } = e.lngLat;
      useProjectStore
        .getState()
        .applyEdit((p) =>
          insertPoint(p, trackId, segmentIndex, insertIndex, { lon: lng, lat }),
        );
      selectedVertexRef.current = { segmentIndex, pointIndex: insertIndex };
    };

    const onKeyDown = (ev: KeyboardEvent): void => {
      if (ev.key === "Escape") {
        useMapStore.getState().setEditMode(false);
        return;
      }
      const vertex = selectedVertexRef.current;
      if ((ev.key === "Delete" || ev.key === "Backspace") && vertex !== null) {
        const trackId = useProjectStore.getState().selectedTrackId;
        if (trackId === null) return;
        ev.preventDefault();
        useProjectStore
          .getState()
          .applyEdit((p) =>
            deletePoint(p, trackId, vertex.segmentIndex, vertex.pointIndex),
          );
        selectedVertexRef.current = null;
      }
    };

    map.on("mouseenter", VERTICES_LAYER_ID, onEnter);
    map.on("mouseleave", VERTICES_LAYER_ID, onLeave);
    map.on("mouseenter", MIDPOINTS_LAYER_ID, onEnter);
    map.on("mouseleave", MIDPOINTS_LAYER_ID, onLeave);
    map.on("mousedown", VERTICES_LAYER_ID, onVertexDown);
    map.on("mousedown", MIDPOINTS_LAYER_ID, onMidpointDown);
    map.on("mousemove", onMove);
    map.on("mouseup", onUp);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      map.off("mouseenter", VERTICES_LAYER_ID, onEnter);
      map.off("mouseleave", VERTICES_LAYER_ID, onLeave);
      map.off("mouseenter", MIDPOINTS_LAYER_ID, onEnter);
      map.off("mouseleave", MIDPOINTS_LAYER_ID, onLeave);
      map.off("mousedown", VERTICES_LAYER_ID, onVertexDown);
      map.off("mousedown", MIDPOINTS_LAYER_ID, onMidpointDown);
      map.off("mousemove", onMove);
      map.off("mouseup", onUp);
      window.removeEventListener("keydown", onKeyDown);
      map.dragPan.enable();
      map.getCanvas().style.cursor = "";
      dragRef.current = null;
      selectedVertexRef.current = null;
      rebuildHandlesRef.current = null;
      if (map.getLayer(VERTICES_LAYER_ID) !== undefined) map.removeLayer(VERTICES_LAYER_ID);
      if (map.getLayer(MIDPOINTS_LAYER_ID) !== undefined) map.removeLayer(MIDPOINTS_LAYER_ID);
      if (map.getSource(VERTICES_SOURCE_ID) !== undefined) map.removeSource(VERTICES_SOURCE_ID);
      if (map.getSource(MIDPOINTS_SOURCE_ID) !== undefined) map.removeSource(MIDPOINTS_SOURCE_ID);
      // Restaure la ligne depuis l'état du store (annule une éventuelle prévisualisation).
      const st = useProjectStore.getState();
      setData(
        PROJECT_SOURCE_ID,
        st.project === null ? EMPTY_DATA : projectToGeoJSON(st.project, st.selectedTrackId),
      );
    };
  }, [editMode, selectedTrackId, mapReady]);

  // Rafraîchit les poignées après une édition validée (insert/delete/move).
  useEffect(() => {
    if (!editMode) return;
    rebuildHandlesRef.current?.();
  }, [project, editMode]);

  // Mode dessin : clic = ajout de point ; freehand = glisser (preview + commit unique).
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !mapReady || !drawMode || selectedTrackId === null) return;

    map.getCanvas().style.cursor = "crosshair";
    const setData = (data: FeatureCollection): void => {
      (map.getSource(PROJECT_SOURCE_ID) as maplibregl.GeoJSONSource | undefined)?.setData(data);
    };

    let stroke: TrackPoint[] | null = null;
    let lastScreen: maplibregl.Point | null = null;
    const THRESHOLD_PX = 6;

    const onClick = (e: MapMouseEvent): void => {
      if (useMapStore.getState().freehand) return; // freehand géré au glissement
      const trackId = useProjectStore.getState().selectedTrackId;
      if (trackId === null) return;
      const { lng, lat } = e.lngLat;
      useProjectStore
        .getState()
        .applyEdit((p) => appendPoint(p, trackId, { lon: lng, lat }));
    };

    const onDown = (e: MapMouseEvent): void => {
      if (!useMapStore.getState().freehand) return;
      e.preventDefault();
      map.dragPan.disable();
      stroke = [{ lon: e.lngLat.lng, lat: e.lngLat.lat }];
      lastScreen = e.point;
    };

    const onMove = (e: MapMouseEvent): void => {
      if (stroke === null) return;
      const distance =
        lastScreen === null
          ? Infinity
          : Math.hypot(e.point.x - lastScreen.x, e.point.y - lastScreen.y);
      if (distance < THRESHOLD_PX) return;
      stroke.push({ lon: e.lngLat.lng, lat: e.lngLat.lat });
      lastScreen = e.point;
      const base = useProjectStore.getState().project;
      const trackId = useProjectStore.getState().selectedTrackId;
      if (base !== null && trackId !== null) {
        setData(projectToGeoJSON(appendPoints(base, trackId, stroke), trackId));
      }
    };

    const onUp = (): void => {
      if (stroke === null) return;
      const points = stroke;
      stroke = null;
      lastScreen = null;
      map.dragPan.enable();
      const trackId = useProjectStore.getState().selectedTrackId;
      if (trackId !== null && points.length > 0) {
        useProjectStore.getState().applyEdit((p) => appendPoints(p, trackId, points));
      }
    };

    const onKeyDown = (ev: KeyboardEvent): void => {
      if (ev.key === "Escape") useMapStore.getState().setDrawMode(false);
    };

    map.on("click", onClick);
    map.on("mousedown", onDown);
    map.on("mousemove", onMove);
    map.on("mouseup", onUp);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      map.off("click", onClick);
      map.off("mousedown", onDown);
      map.off("mousemove", onMove);
      map.off("mouseup", onUp);
      window.removeEventListener("keydown", onKeyDown);
      map.dragPan.enable();
      map.getCanvas().style.cursor = "";
    };
  }, [drawMode, selectedTrackId, mapReady, freehand]);

  // À la sortie du mode dessin, retire la trace si elle est restée vide.
  useEffect(() => {
    if (wasDrawing.current && !drawMode) {
      const st = useProjectStore.getState();
      const track = st.project?.tracks.find((t) => t.id === st.selectedTrackId);
      if (track !== undefined && trackPointCount(track) === 0) {
        st.deleteTrack(track.id);
      }
    }
    wasDrawing.current = drawMode;
  }, [drawMode]);

  return <div ref={containerRef} className="map-root" />;
}
