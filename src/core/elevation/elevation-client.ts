import { invoke, isTauri } from "@tauri-apps/api/core";
import { iterateTrackPoints, type Track } from "../model";

/**
 * Client altimétrique (Géoplateforme). Récupère/corrige les altitudes des points.
 * Appel réseau via la commande Rust `elevation_online` sous Tauri (évite le CORS) ;
 * `fetch` direct en dev. Le parsing est pur et testé.
 */

const ENDPOINT = "https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json";
const BATCH_SIZE = 200;
/** En-deçà de ce z, la valeur est considérée « hors couverture » (sentinelle API). */
const NODATA_THRESHOLD = -1000;

/** Construit l'URL de requête altimétrique pour un lot de points [lon, lat]. */
export function buildElevationUrl(points: [number, number][]): string {
  const params = new URLSearchParams({
    lon: points.map((p) => p[0]).join("|"),
    lat: points.map((p) => p[1]).join("|"),
    resource: "ign_rge_alti_wld",
    delimiter: "|",
    zonly: "false",
  });
  return `${ENDPOINT}?${params.toString()}`;
}

/** Extrait les altitudes `z` de la réponse JSON (dans l'ordre des points). */
export function parseElevationResponse(jsonText: string): number[] {
  const data: unknown = JSON.parse(jsonText);
  const obj = data as { elevations?: { z?: unknown }[] };
  if (!Array.isArray(obj.elevations)) {
    throw new Error("Réponse altimétrique invalide.");
  }
  return obj.elevations.map((e) => Number(e.z));
}

/** Coordonnées [lon, lat] de tous les points d'une trace, dans l'ordre. */
export function trackCoords(track: Track): [number, number][] {
  const coords: [number, number][] = [];
  for (const p of iterateTrackPoints(track)) coords.push([p.lon, p.lat]);
  return coords;
}

async function fetchBatch(points: [number, number][]): Promise<number[]> {
  let jsonText: string;
  if (isTauri()) {
    jsonText = await invoke<string>("elevation_online", { points });
  } else {
    const response = await fetch(buildElevationUrl(points));
    if (!response.ok) throw new Error(`Service altimétrique : HTTP ${response.status}`);
    jsonText = await response.text();
  }
  return parseElevationResponse(jsonText);
}

/** Récupère les altitudes d'une liste de points (découpée en lots). */
export async function fetchElevations(
  points: [number, number][],
): Promise<number[]> {
  const result: number[] = [];
  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const chunk = points.slice(i, i + BATCH_SIZE);
    result.push(...(await fetchBatch(chunk)));
  }
  return result;
}

/** Applique des altitudes (ordre aplati) à une trace ; ignore les valeurs invalides. */
export function withElevations(track: Track, elevations: number[]): Track {
  let k = 0;
  const segments = track.segments.map((segment) =>
    segment.map((point) => {
      const z = elevations[k++];
      if (z === undefined || !Number.isFinite(z) || z <= NODATA_THRESHOLD) {
        return point;
      }
      return { ...point, ele: Math.round(z * 10) / 10 };
    }),
  );
  return { ...track, segments };
}
