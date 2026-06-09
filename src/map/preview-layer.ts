import type { LineLayerSpecification } from "maplibre-gl";

/** Source/couche d'aperçu (prévisualisation des outils de nettoyage). */
export const PREVIEW_SOURCE_ID = "preview-data";
export const PREVIEW_LAYER_ID = "preview-layer";

/** Ligne d'aperçu : pointillés contrastés au-dessus du tracé courant. */
export const previewLineLayer: LineLayerSpecification = {
  id: PREVIEW_LAYER_ID,
  type: "line",
  source: PREVIEW_SOURCE_ID,
  layout: { "line-join": "round", "line-cap": "round" },
  paint: {
    "line-color": "#ff1493",
    "line-width": 2.5,
    "line-dasharray": [2, 2],
  },
};
