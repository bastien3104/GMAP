import { invoke, isTauri } from "@tauri-apps/api/core";

/**
 * Client de géocodage (Géoplateforme). Recherche d'adresses/lieux → coordonnées.
 * Appel réseau via la commande Rust `geocode_online` sous Tauri (évite le CORS) ;
 * `fetch` direct en dev. Le parsing est pur et testé.
 */

const ENDPOINT = "https://data.geopf.fr/geocodage/search";

/** Un résultat de géocodage normalisé. */
export interface GeocodeResult {
  /** Libellé affiché (adresse/lieu complet). */
  label: string;
  /** Longitude WGS84. */
  lon: number;
  /** Latitude WGS84. */
  lat: number;
  /** Type de résultat (housenumber, street, municipality, poi…), si fourni. */
  type?: string;
}

/** Construit l'URL de recherche pour une requête texte. */
export function buildGeocodeUrl(query: string, limit = 8): string {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    index: "address,poi",
  });
  return `${ENDPOINT}?${params.toString()}`;
}

interface RawFeature {
  geometry?: { coordinates?: unknown };
  properties?: { label?: unknown; name?: unknown; type?: unknown; _type?: unknown };
}

/** Extrait les résultats normalisés d'une réponse GeoJSON de géocodage. */
export function parseGeocodeResponse(jsonText: string): GeocodeResult[] {
  const data: unknown = JSON.parse(jsonText);
  const obj = data as { features?: RawFeature[] };
  if (!Array.isArray(obj.features)) return [];

  const results: GeocodeResult[] = [];
  for (const feature of obj.features) {
    const coords = feature.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;

    const props = feature.properties ?? {};
    const label =
      typeof props.label === "string"
        ? props.label
        : typeof props.name === "string"
          ? props.name
          : `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    const type =
      typeof props.type === "string"
        ? props.type
        : typeof props._type === "string"
          ? props._type
          : undefined;

    const result: GeocodeResult = { label, lon, lat };
    if (type !== undefined) result.type = type;
    results.push(result);
  }
  return results;
}

/**
 * Géocodage inverse : nom de lieu le plus proche d'un point, ou `null`.
 * Tolérant : tout échec (réseau/hors-ligne) renvoie `null` sans lever.
 */
export async function reverseGeocode(lon: number, lat: number): Promise<string | null> {
  try {
    let jsonText: string;
    if (isTauri()) {
      jsonText = await invoke<string>("geocode_reverse_online", { lon, lat });
    } else {
      const params = new URLSearchParams({
        lon: String(lon),
        lat: String(lat),
        index: "address,poi",
        limit: "1",
      });
      const response = await fetch(`https://data.geopf.fr/geocodage/reverse?${params.toString()}`);
      if (!response.ok) return null;
      jsonText = await response.text();
    }
    const results = parseGeocodeResponse(jsonText);
    return results[0]?.label ?? null;
  } catch {
    return null;
  }
}

/** Recherche des adresses/lieux pour une requête texte (vide → liste vide). */
export async function geocodeSearch(query: string): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q === "") return [];
  let jsonText: string;
  if (isTauri()) {
    jsonText = await invoke<string>("geocode_online", { query: q });
  } else {
    const response = await fetch(buildGeocodeUrl(q));
    if (!response.ok) throw new Error(`Service de géocodage : HTTP ${response.status}`);
    jsonText = await response.text();
  }
  return parseGeocodeResponse(jsonText);
}
