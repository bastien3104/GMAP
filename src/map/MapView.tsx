import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { FeatureCollection } from "geojson";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { PLAN_IGN } from "./basemaps";
import { buildRasterStyle } from "./map-style";
import {
  PROJECT_SOURCE_ID,
  trackLineLayer,
  waypointCircleLayer,
} from "./track-layers";
import { useProjectStore } from "../store/project-store";
import { projectBounds, projectToGeoJSON } from "../core/geojson/to-geojson";

/** Vue initiale : centre approximatif de la France métropolitaine. */
const FRANCE_CENTER: [number, number] = [2.4, 46.6];
const INITIAL_ZOOM = 5;
const EMPTY_DATA: FeatureCollection = { type: "FeatureCollection", features: [] };

/**
 * Composant carte MapLibre.
 *
 * Initialise la carte (fond Plan IGN, attribution, navigation), ajoute la source et
 * les couches du projet, et synchronise leur contenu avec le store. Aucune logique
 * métier ici (elle vit dans `core/` et `store/`).
 */
export function MapView(): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const project = useProjectStore((s) => s.project);

  // Initialisation de la carte (une seule fois).
  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    const map = new maplibregl.Map({
      container,
      style: buildRasterStyle(PLAN_IGN),
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
      map.addSource(PROJECT_SOURCE_ID, { type: "geojson", data: EMPTY_DATA });
      map.addLayer(trackLineLayer);
      map.addLayer(waypointCircleLayer);
      setMapReady(true);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Synchronise les données du projet (source GeoJSON) et recadre la vue.
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !mapReady) return;

    const source = map.getSource(PROJECT_SOURCE_ID);
    if (source === undefined) return;
    const data = project === null ? EMPTY_DATA : projectToGeoJSON(project);
    (source as maplibregl.GeoJSONSource).setData(data);

    if (project !== null) {
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
  }, [project, mapReady]);

  return <div ref={containerRef} className="map-root" />;
}
