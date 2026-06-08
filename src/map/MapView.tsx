import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { FeatureCollection } from "geojson";
import maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
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
import { setMapInstance } from "./map-ref";
import { useProjectStore } from "../store/project-store";
import { useMapStore } from "../store/map-store";
import { projectBounds, projectToGeoJSON } from "../core/geojson/to-geojson";

/** Vue initiale : centre approximatif de la France métropolitaine. */
const FRANCE_CENTER: [number, number] = [2.4, 46.6];
const INITIAL_ZOOM = 5;
const EMPTY_DATA: FeatureCollection = { type: "FeatureCollection", features: [] };
const EMPTY_STYLE: StyleSpecification = { version: 8, sources: {}, layers: [] };

/**
 * Composant carte MapLibre.
 *
 * Ajoute tous les fonds (un par source/couche, seul l'actif visible) puis la source
 * et les couches du projet par-dessus. La bascule de fond se fait par visibilité de
 * couche (les couches projet ne sont jamais perdues). Aucune logique métier ici.
 */
export function MapView(): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const project = useProjectStore((s) => s.project);
  const selectedTrackId = useProjectStore((s) => s.selectedTrackId);
  const activeBasemapId = useMapStore((s) => s.activeBasemapId);
  const lastFittedProjectId = useRef<string | null>(null);

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
      // Un fond par source/couche ; seul l'actif est visible.
      for (const basemap of BASEMAPS) {
        map.addSource(basemapSourceId(basemap.id), basemapRasterSource(basemap));
        map.addLayer(basemapLayer(basemap, basemap.id === active));
      }
      // Données du projet par-dessus les fonds.
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

  // Synchronise les données du projet (source GeoJSON) ; recadre seulement au
  // chargement d'un nouveau projet (pas à chaque édition).
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

  return <div ref={containerRef} className="map-root" />;
}
