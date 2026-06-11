import type { Feature, FeatureCollection, LineString } from "geojson";
import { haversine } from "../geo/stats";
import type { Track } from "../model";

/**
 * Arêtes colorables par une métrique d'activité (vitesse ou FC), pures.
 * La valeur d'une arête est la moyenne de ses extrémités ; la vitesse est
 * prise du capteur ou dérivée des horodatages.
 */

/** Métriques de coloration de trace disponibles côté carte. */
export type ColoringMetric = "speed" | "hr";

/** Propriétés d'une arête métrique. */
export interface MetricFeatureProperties {
  value: number;
}

/** Résultat : collection + bornes (pour construire le dégradé). */
export interface MetricCollection {
  collection: FeatureCollection;
  min: number;
  max: number;
}

/** Vitesse (m/s) d'un point : capteur, sinon dérivée de l'arête précédente. */
function edgeSpeed(
  a: { lat: number; lon: number; time?: string; speed?: number },
  b: { lat: number; lon: number; time?: string; speed?: number },
): number | null {
  if (a.speed !== undefined && b.speed !== undefined) return (a.speed + b.speed) / 2;
  if (b.speed !== undefined) return b.speed;
  if (a.time !== undefined && b.time !== undefined) {
    const dt = (Date.parse(b.time) - Date.parse(a.time)) / 1000;
    if (Number.isFinite(dt) && dt > 0) return haversine(a, b) / dt;
  }
  return null;
}

/**
 * FeatureCollection d'arêtes portant la métrique demandée (les arêtes sans
 * valeur sont omises), avec min/max pour caler le dégradé.
 */
export function metricFeatureCollection(
  track: Track,
  metric: ColoringMetric,
): MetricCollection {
  const features: Feature<LineString, MetricFeatureProperties>[] = [];
  let min = Infinity;
  let max = -Infinity;
  for (const segment of track.segments) {
    for (let i = 1; i < segment.length; i++) {
      const a = segment[i - 1]!;
      const b = segment[i]!;
      let value: number | null = null;
      if (metric === "speed") {
        value = edgeSpeed(a, b);
      } else if (a.hr !== undefined && b.hr !== undefined) {
        value = (a.hr + b.hr) / 2;
      } else if (b.hr !== undefined) {
        value = b.hr;
      }
      if (value === null) continue;
      if (value < min) min = value;
      if (value > max) max = value;
      features.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [a.lon, a.lat],
            [b.lon, b.lat],
          ],
        },
        properties: { value },
      });
    }
  }
  if (features.length === 0) {
    min = 0;
    max = 1;
  }
  return {
    collection: { type: "FeatureCollection", features },
    min,
    max: max > min ? max : min + 1,
  };
}
