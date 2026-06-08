import type { StyleSpecification } from "maplibre-gl";
import type { RasterBasemap } from "./basemaps";

/**
 * Construit un style MapLibre minimal à partir d'un fond raster.
 * Fonction pure (aucune dépendance à l'instance de carte) → testable.
 */
export function buildRasterStyle(basemap: RasterBasemap): StyleSpecification {
  const sourceId = `basemap-${basemap.id}`;
  return {
    version: 8,
    sources: {
      [sourceId]: {
        type: "raster",
        tiles: [...basemap.tiles],
        tileSize: basemap.tileSize,
        maxzoom: basemap.maxzoom,
        attribution: basemap.attribution,
      },
    },
    layers: [
      {
        id: `${sourceId}-layer`,
        type: "raster",
        source: sourceId,
      },
    ],
  };
}
