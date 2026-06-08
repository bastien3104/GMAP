import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { PLAN_IGN } from "./basemaps";
import { buildRasterStyle } from "./map-style";

/** Vue initiale : centre approximatif de la France métropolitaine. */
const FRANCE_CENTER: [number, number] = [2.4, 46.6];
const INITIAL_ZOOM = 5;

/**
 * Composant carte MapLibre.
 *
 * Responsabilités (Phase 0) : initialiser la carte avec le fond Plan IGN,
 * afficher l'attribution et les contrôles de navigation, nettoyer à la
 * destruction. Aucune logique métier ici (elle vit dans `core/` et `store/`).
 */
export function MapView(): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

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
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="map-root" />;
}
