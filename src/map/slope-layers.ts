import type {
  CircleLayerSpecification,
  LineLayerSpecification,
} from "maplibre-gl";

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

/** Couche ligne colorée par pente absolue (expression `step`). */
export const slopeLineLayer: LineLayerSpecification = {
  id: SLOPE_LAYER_ID,
  type: "line",
  source: SLOPE_SOURCE_ID,
  layout: { "line-join": "round", "line-cap": "round" },
  paint: {
    "line-width": 5,
    "line-color": [
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
    ],
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
