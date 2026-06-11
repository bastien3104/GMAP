import type {
  CircleLayerSpecification,
  DataDrivenPropertyValueSpecification,
  LineLayerSpecification,
} from "maplibre-gl";
import type { ColoringMetric } from "../core/geojson/metric-geojson";

/** Sources/couches pour la coloration par pente et le marqueur de survol du profil. */

export const SLOPE_SOURCE_ID = "slope-data";
export const SLOPE_LAYER_ID = "slope-layer";
export const HOVER_SOURCE_ID = "hover-point";
export const HOVER_LAYER_ID = "hover-point-layer";

/** Gradient de pente (configurable en un seul endroit) : seuils % absolus → couleur. */
export const SLOPE_LEGEND: ReadonlyArray<{ label: string; color: string }> = [
  { label: "0–5 %", color: "#1a9850" },
  { label: "5–10 %", color: "#a6d96a" },
  { label: "10–15 %", color: "#fee08b" },
  { label: "15–25 %", color: "#fdae61" },
  { label: "25–40 %", color: "#f46d43" },
  { label: "> 40 %", color: "#a50026" },
];

/** Couleur d'une pente (% signé) selon le même gradient que la légende. */
export function slopeColor(slopePercent: number): string {
  const a = Math.abs(slopePercent);
  if (a < 5) return "#1a9850";
  if (a < 10) return "#a6d96a";
  if (a < 15) return "#fee08b";
  if (a < 25) return "#fdae61";
  if (a < 40) return "#f46d43";
  return "#a50026";
}

/** Expression de couleur par pente absolue (`step` sur la propriété `slope`). */
export const SLOPE_COLOR_EXPRESSION: DataDrivenPropertyValueSpecification<string> = [
  "step",
  ["abs", ["get", "slope"]],
  "#1a9850",
  5,
  "#a6d96a",
  10,
  "#fee08b",
  15,
  "#fdae61",
  25,
  "#f46d43",
  40,
  "#a50026",
];

/** Couleurs des 5 zones cardio (Z1 → Z5), partagées carte / analyse. */
export const HR_ZONE_COLORS: readonly [string, string, string, string, string] = [
  "#85b7eb",
  "#5dcaa5",
  "#97c459",
  "#ef9f27",
  "#e24b4a",
];

/**
 * Expression de couleur pour une métrique d'activité sur la propriété `value` :
 * - vitesse : dégradé continu lent (bleu) → rapide (rouge) calé sur min/max ;
 * - FC : paliers aux zones cardio (% de la FC max).
 */
export function metricColorExpression(
  metric: ColoringMetric,
  min: number,
  max: number,
  hrMax: number,
): DataDrivenPropertyValueSpecification<string> {
  if (metric === "hr") {
    return [
      "step",
      ["get", "value"],
      HR_ZONE_COLORS[0],
      0.6 * hrMax,
      HR_ZONE_COLORS[1],
      0.7 * hrMax,
      HR_ZONE_COLORS[2],
      0.8 * hrMax,
      HR_ZONE_COLORS[3],
      0.9 * hrMax,
      HR_ZONE_COLORS[4],
    ];
  }
  const range = Math.max(max - min, 1e-6);
  return [
    "interpolate",
    ["linear"],
    ["get", "value"],
    min,
    "#4575b4",
    min + range * 0.45,
    "#1fa899",
    min + range * 0.75,
    "#f4a936",
    max,
    "#e24b4a",
  ];
}

/** Couche ligne colorée par métrique (pente par défaut ; recolorée à la volée). */
export const slopeLineLayer: LineLayerSpecification = {
  id: SLOPE_LAYER_ID,
  type: "line",
  source: SLOPE_SOURCE_ID,
  layout: { "line-join": "round", "line-cap": "round" },
  paint: {
    "line-width": 5,
    "line-color": SLOPE_COLOR_EXPRESSION,
  },
};

/** Marqueur ponctuel de survol du profil. */
export const hoverPointLayer: CircleLayerSpecification = {
  id: HOVER_LAYER_ID,
  type: "circle",
  source: HOVER_SOURCE_ID,
  paint: {
    "circle-radius": 6,
    "circle-color": "#ffffff",
    "circle-stroke-color": "#000000",
    "circle-stroke-width": 2,
  },
};
