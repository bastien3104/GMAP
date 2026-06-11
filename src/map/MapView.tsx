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
import {
  HOVER_SOURCE_ID,
  SLOPE_SOURCE_ID,
  hoverPointLayer,
  slopeLineLayer,
} from "./slope-layers";
import {
  PREVIEW_SOURCE_ID,
  previewLineLayer,
} from "./preview-layer";
import {
  OFFLINE_ZONES_SOURCE_ID,
  offlineZonesFillLayer,
  offlineZonesLineLayer,
  offlineZonesFeatureCollection,
} from "./offline-zones-layer";
import { useOfflineStore } from "../store/offline-store";
import { setMapInstance } from "./map-ref";
import { useProjectStore } from "../store/project-store";
import { useMapStore } from "../store/map-store";
import { slopeFeatureCollection } from "../core/geojson/slope-geojson";
import { deletePoint, insertPoint, movePoint } from "../core/edit/point-ops";
import { appendPoint, appendPoints } from "../core/edit/draw-ops";
import { routeSegment } from "../core/routing/itinerary";
import {
  createWaypoint,
  trackPointCount,
  waypointSymbol,
  type Project,
  type TrackPoint,
  type Waypoint,
} from "../core/model";
import { fetchElevations } from "../core/elevation/elevation-client";
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
  const waypoints = useProjectStore((s) => s.project?.waypoints);
  const selectedWaypointId = useProjectStore((s) => s.selectedWaypointId);
  const activeBasemapId = useMapStore((s) => s.activeBasemapId);
  const editMode = useMapStore((s) => s.editMode);
  const drawMode = useMapStore((s) => s.drawMode);
  const poiMode = useMapStore((s) => s.poiMode);
  const freehand = useMapStore((s) => s.freehand);
  const slopeColoring = useMapStore((s) => s.slopeColoring);
  const hoverPoint = useMapStore((s) => s.hoverPoint);
  const previewData = useMapStore((s) => s.previewData);
  const showOfflineZones = useMapStore((s) => s.showOfflineZones);
  const offlineZones = useOfflineStore((s) => s.zones);
  const lastFittedProjectId = useRef<string | null>(null);
  const wasDrawing = useRef(false);
  const lastAnchorRef = useRef<[number, number] | null>(null);
  const selectedVertexRef = useRef<SelectedVertex | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const rebuildHandlesRef = useRef<(() => void) | null>(null);
  const markersRef = useRef<globalThis.Map<string, maplibregl.Marker>>(new globalThis.Map());

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
    // Attribution en haut-droite (compacte) : reste visible au-dessus du dock profil.
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "top-right",
    );

    map.on("load", () => {
      const active = useMapStore.getState().activeBasemapId;
      for (const basemap of BASEMAPS) {
        map.addSource(basemapSourceId(basemap.id), basemapRasterSource(basemap));
        map.addLayer(basemapLayer(basemap, basemap.id === active));
      }
      map.addSource(PROJECT_SOURCE_ID, { type: "geojson", data: EMPTY_DATA });
      map.addLayer(trackLineLayer);
      map.addSource(SLOPE_SOURCE_ID, { type: "geojson", data: EMPTY_DATA });
      map.addLayer(slopeLineLayer);
      map.addSource(HOVER_SOURCE_ID, { type: "geojson", data: EMPTY_DATA });
      map.addLayer(hoverPointLayer);
      map.addSource(PREVIEW_SOURCE_ID, { type: "geojson", data: EMPTY_DATA });
      map.addLayer(previewLineLayer);
      map.addSource(OFFLINE_ZONES_SOURCE_ID, { type: "geojson", data: EMPTY_DATA });
      map.addLayer(offlineZonesFillLayer);
      map.addLayer(offlineZonesLineLayer);
      setMapReady(true);
    });

    // Redimensionne la carte quand la région centrale change (panneaux repliés/dépliés).
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);

    mapRef.current = map;
    setMapInstance(map);
    return () => {
      resizeObserver.disconnect();
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

  // Coloration par pente de la trace sélectionnée.
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !mapReady) return;
    const source = map.getSource(SLOPE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (source === undefined) return;
    const track =
      slopeColoring && selectedTrackId !== null
        ? project?.tracks.find((t) => t.id === selectedTrackId)
        : undefined;
    source.setData(track !== undefined ? slopeFeatureCollection(track) : EMPTY_DATA);
  }, [slopeColoring, selectedTrackId, project, mapReady]);

  // Aperçu des outils de nettoyage.
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !mapReady) return;
    const source = map.getSource(PREVIEW_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (source === undefined) return;
    source.setData(previewData ?? EMPTY_DATA);
  }, [previewData, mapReady]);

  // Emprises des zones téléchargées (affichage à la demande).
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !mapReady) return;
    const source = map.getSource(OFFLINE_ZONES_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (source === undefined) return;
    source.setData(
      showOfflineZones ? offlineZonesFeatureCollection(offlineZones) : EMPTY_DATA,
    );
  }, [showOfflineZones, offlineZones, mapReady]);

  // Marqueur de survol (synchronisé avec le profil).
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !mapReady) return;
    const source = map.getSource(HOVER_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (source === undefined) return;
    const data: FeatureCollection =
      hoverPoint === null
        ? EMPTY_DATA
        : {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: hoverPoint },
                properties: {},
              },
            ],
          };
    source.setData(data);
  }, [hoverPoint, mapReady]);

  // Waypoints : marqueurs DOM (glyphe + nom), déplaçables en mode POI.
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !mapReady) return;
    const markers = markersRef.current;
    const list = waypoints ?? [];
    const ids = new Set(list.map((w) => w.id));

    // Retire les marqueurs des waypoints disparus.
    for (const [id, marker] of markers) {
      if (!ids.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }

    for (const wpt of list) {
      let marker = markers.get(wpt.id);
      if (marker === undefined) {
        const el = document.createElement("div");
        el.className = "wpt-marker";
        const glyph = document.createElement("span");
        glyph.className = "wpt-glyph";
        const label = document.createElement("span");
        label.className = "wpt-label";
        el.append(glyph, label);
        el.addEventListener("click", (ev) => {
          ev.stopPropagation(); // ne place pas un nouveau POI
          useProjectStore.getState().selectWaypoint(wpt.id);
        });
        marker = new maplibregl.Marker({ element: el, anchor: "center" });
        marker.setLngLat([wpt.lon, wpt.lat]).addTo(map);
        marker.on("dragstart", () => useProjectStore.getState().selectWaypoint(wpt.id));
        const m = marker;
        marker.on("dragend", () => {
          const { lng, lat } = m.getLngLat();
          useProjectStore.getState().moveWaypoint(wpt.id, lng, lat);
        });
        markers.set(wpt.id, marker);
      }
      marker.setLngLat([wpt.lon, wpt.lat]);
      marker.setDraggable(poiMode);
      const el = marker.getElement();
      el.classList.toggle("selected", wpt.id === selectedWaypointId);
      el.classList.toggle("draggable", poiMode);
      const sym = waypointSymbol(wpt.symbol);
      const glyphEl = el.querySelector(".wpt-glyph");
      const labelEl = el.querySelector(".wpt-label");
      if (glyphEl !== null) glyphEl.textContent = sym.glyph;
      if (labelEl !== null) labelEl.textContent = wpt.name;
    }
  }, [waypoints, selectedWaypointId, poiMode, mapReady]);

  // Nettoyage des marqueurs au démontage.
  useEffect(() => {
    const markers = markersRef.current;
    return () => {
      for (const marker of markers.values()) marker.remove();
      markers.clear();
    };
  }, []);

  // Mode POI : clic = pose un waypoint (altitude auto online, repli silencieux).
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !mapReady || !poiMode) return;
    map.getCanvas().style.cursor = "crosshair";

    const fillElevation = async (id: string, lon: number, lat: number): Promise<void> => {
      try {
        const [z] = await fetchElevations([[lon, lat]]);
        if (z !== undefined && Number.isFinite(z) && z > -1000) {
          useProjectStore.getState().enrichWaypointElevation(id, Math.round(z * 10) / 10);
        }
      } catch {
        // hors-ligne / échec : altitude laissée vide (éditable à la main).
      }
    };

    const onClick = (e: MapMouseEvent): void => {
      const lon = e.lngLat.lng;
      const lat = e.lngLat.lat;
      const wpt: Waypoint = createWaypoint({ lat, lon });
      useProjectStore.getState().addWaypoint(wpt);
      void fillElevation(wpt.id, lon, lat);
    };
    const onKeyDown = (ev: KeyboardEvent): void => {
      if (ev.key === "Escape") useMapStore.getState().setPoiMode(false);
    };
    map.on("click", onClick);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      map.off("click", onClick);
      window.removeEventListener("keydown", onKeyDown);
      map.getCanvas().style.cursor = "";
    };
  }, [poiMode, mapReady]);

  // Touches sur un waypoint sélectionné : Suppr = supprimer, Échap = désélectionner.
  useEffect(() => {
    if (selectedWaypointId === null) return;
    const onKey = (ev: KeyboardEvent): void => {
      const target = ev.target as HTMLElement | null;
      if (
        target !== null &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return; // saisie en cours dans l'éditeur
      }
      if (ev.key === "Delete" || ev.key === "Backspace") {
        ev.preventDefault();
        useProjectStore.getState().deleteWaypoint(selectedWaypointId);
      } else if (ev.key === "Escape") {
        useProjectStore.getState().selectWaypoint(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedWaypointId]);

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
    lastAnchorRef.current = null;
    const setData = (data: FeatureCollection): void => {
      (map.getSource(PROJECT_SOURCE_ID) as maplibregl.GeoJSONSource | undefined)?.setData(data);
    };

    let stroke: TrackPoint[] | null = null;
    let lastScreen: maplibregl.Point | null = null;
    const THRESHOLD_PX = 6;

    // Routage online d'un segment ancre→clic, puis ajout des points routés.
    const routeBetween = async (
      trackId: string,
      from: [number, number],
      to: [number, number],
    ): Promise<void> => {
      const mapStore = useMapStore.getState();
      mapStore.setRoutingBusy(true);
      try {
        const segment = await routeSegment(mapStore.routingProfile, from, to);
        // On retire le 1er point (doublon de l'ancre précédente).
        const points = segment.points.slice(1);
        const toAppend = points.length > 0 ? points : [{ lon: to[0], lat: to[1] }];
        useProjectStore.getState().applyEdit((p) => appendPoints(p, trackId, toAppend));
      } catch {
        // Dégradation gracieuse : segment droit.
        useProjectStore
          .getState()
          .applyEdit((p) => appendPoints(p, trackId, [{ lon: to[0], lat: to[1] }]));
      } finally {
        lastAnchorRef.current = to;
        useMapStore.getState().setRoutingBusy(false);
      }
    };

    const onClick = (e: MapMouseEvent): void => {
      const store = useMapStore.getState();
      if (store.freehand) return; // freehand géré au glissement
      const trackId = useProjectStore.getState().selectedTrackId;
      if (trackId === null) return;
      const click: [number, number] = [e.lngLat.lng, e.lngLat.lat];

      if (!store.routing || lastAnchorRef.current === null) {
        // Premier point, ou mode point par point : ajout direct.
        useProjectStore
          .getState()
          .applyEdit((p) => appendPoint(p, trackId, { lon: click[0], lat: click[1] }));
        lastAnchorRef.current = click;
        return;
      }
      if (store.routingBusy) return; // évite le chevauchement des requêtes
      void routeBetween(trackId, lastAnchorRef.current, click);
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
