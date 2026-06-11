import {
  createWaypoint,
  iterateTrackPoints,
  type Track,
  type Waypoint,
} from "../model";
import type { ExifData } from "./exif";

/**
 * Conversion d'une photo (EXIF) en point d'intérêt.
 *
 * - **Géolocalisée** : POI à la position GPS de la photo.
 * - **Corrélée** : sans GPS mais horodatée, position interpolée sur une trace dont les
 *   points portent un `time` (même horloge supposée).
 * - **Ignorée** : ni GPS, ni horodatage exploitable.
 */

export type PhotoStatus = "geotagged" | "correlated" | "skipped";

export interface PhotoImportResult {
  status: PhotoStatus;
  waypoint?: Waypoint;
}

/** Nom d'affichage : nom de fichier sans extension. */
function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

/** Convertit un horodatage ISO en epoch ms ; un temps « nu » est lu comme UTC. */
function toEpoch(iso: string): number {
  const normalized = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  return Date.parse(normalized);
}

/** Point interpolé sur une trace horodatée à l'instant `iso`, ou `null` si hors plage. */
export function trackPointAtTime(
  track: Track,
  iso: string,
): { lon: number; lat: number; ele?: number } | null {
  const target = toEpoch(iso);
  if (!Number.isFinite(target)) return null;

  const timed = [...iterateTrackPoints(track)]
    .filter((p) => p.time !== undefined)
    .map((p) => ({ p, t: toEpoch(p.time!) }))
    .filter((x) => Number.isFinite(x.t));
  if (timed.length === 0) return null;

  const first = timed[0]!;
  const last = timed[timed.length - 1]!;
  if (target < first.t || target > last.t) return null; // hors plage : on n'invente pas

  for (let i = 1; i < timed.length; i += 1) {
    const a = timed[i - 1]!;
    const b = timed[i]!;
    if (target >= a.t && target <= b.t) {
      const span = b.t - a.t;
      const f = span === 0 ? 0 : (target - a.t) / span;
      const lon = a.p.lon + (b.p.lon - a.p.lon) * f;
      const lat = a.p.lat + (b.p.lat - a.p.lat) * f;
      const point: { lon: number; lat: number; ele?: number } = { lon, lat };
      if (a.p.ele !== undefined && b.p.ele !== undefined) {
        point.ele = a.p.ele + (b.p.ele - a.p.ele) * f;
      }
      return point;
    }
  }
  return null;
}

/** Crée un POI à partir des données EXIF d'une photo (corrélation si `track` fourni). */
export function photoToWaypoint(
  fileName: string,
  exif: ExifData,
  track?: Track,
): PhotoImportResult {
  const name = baseName(fileName);

  if (exif.lat !== undefined && exif.lon !== undefined) {
    const wpt = createWaypoint({
      lat: exif.lat,
      lon: exif.lon,
      name,
      symbol: "photo",
      ...(exif.ele !== undefined ? { ele: exif.ele } : {}),
      ...(exif.time !== undefined ? { time: exif.time } : {}),
    });
    return { status: "geotagged", waypoint: wpt };
  }

  if (exif.time !== undefined && track !== undefined) {
    const point = trackPointAtTime(track, exif.time);
    if (point !== null) {
      const wpt = createWaypoint({
        lat: point.lat,
        lon: point.lon,
        name,
        symbol: "photo",
        time: exif.time,
        ...(point.ele !== undefined ? { ele: Math.round(point.ele * 10) / 10 } : {}),
      });
      return { status: "correlated", waypoint: wpt };
    }
  }

  return { status: "skipped" };
}
