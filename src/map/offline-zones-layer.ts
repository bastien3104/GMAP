import type { FeatureCollection } from "geojson";
import type { FillLayerSpecification, LineLayerSpecification } from "maplibre-gl";
import type { OfflineZone } from "../store/offline-store";

/** Source et couches MapLibre pour les emprises des zones téléchargées (hors-ligne). */

export const OFFLINE_ZONES_SOURCE_ID = "offline-zones";
export const OFFLINE_ZONES_FILL_LAYER_ID = "offline-zones-fill";
export const OFFLINE_ZONES_LINE_LAYER_ID = "offline-zones-line";

/** Remplissage léger des zones. */
export const offlineZonesFillLayer: FillLayerSpecification = {
  id: OFFLINE_ZONES_FILL_LAYER_ID,
  type: "fill",
  source: OFFLINE_ZONES_SOURCE_ID,
  paint: {
    "fill-color": "#0077b6",
    "fill-opacity": 0.08,
  },
};

/** Contour des zones. */
export const offlineZonesLineLayer: LineLayerSpecification = {
  id: OFFLINE_ZONES_LINE_LAYER_ID,
  type: "line",
  source: OFFLINE_ZONES_SOURCE_ID,
  paint: {
    "line-color": "#0077b6",
    "line-width": 1.5,
    "line-dasharray": [3, 2],
  },
};

/** Construit la FeatureCollection des emprises (un polygone rectangulaire par zone). */
export function offlineZonesFeatureCollection(zones: OfflineZone[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: zones.map((z) => {
      const { minLon, minLat, maxLon, maxLat } = z.bbox;
      return {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [minLon, minLat],
              [maxLon, minLat],
              [maxLon, maxLat],
              [minLon, maxLat],
              [minLon, minLat],
            ],
          ],
        },
        properties: { id: z.id, name: z.name },
      };
    }),
  };
}
