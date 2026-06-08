import type {
  RasterLayerSpecification,
  RasterSourceSpecification,
  StyleSpecification,
} from "maplibre-gl";
import type { RasterBasemap } from "./basemaps";

/** Identifiant de source MapLibre pour un fond. */
export function basemapSourceId(basemapId: string): string {
  return `basemap-${basemapId}`;
}

/** Identifiant de couche MapLibre pour un fond. */
export function basemapLayerId(basemapId: string): string {
  return `basemap-${basemapId}-layer`;
}

/** Spécification de source raster pour un fond. */
export function basemapRasterSource(
  basemap: RasterBasemap,
): RasterSourceSpecification {
  return {
    type: "raster",
    tiles: [...basemap.tiles],
    tileSize: basemap.tileSize,
    maxzoom: basemap.maxzoom,
    attribution: basemap.attribution,
  };
}

/** Spécification de couche raster pour un fond (visible ou masquée). */
export function basemapLayer(
  basemap: RasterBasemap,
  visible: boolean,
): RasterLayerSpecification {
  return {
    id: basemapLayerId(basemap.id),
    type: "raster",
    source: basemapSourceId(basemap.id),
    layout: { visibility: visible ? "visible" : "none" },
  };
}

/**
 * Construit un style MapLibre minimal à partir d'un seul fond raster.
 * Fonction pure (aucune dépendance à l'instance de carte) → testable.
 */
export function buildRasterStyle(basemap: RasterBasemap): StyleSpecification {
  const sourceId = basemapSourceId(basemap.id);
  return {
    version: 8,
    sources: { [sourceId]: basemapRasterSource(basemap) },
    layers: [basemapLayer(basemap, true)],
  };
}
