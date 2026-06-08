import { XMLParser } from "fast-xml-parser";
import {
  defaultTrackColor,
  type Project,
  type Track,
  type TrackPoint,
  type Waypoint,
} from "../model";

/**
 * Import GPX tolérant : convertit le XML d'un fichier GPX (1.0 ou 1.1) en `Project`.
 *
 * Conserve `ele` et `time` quand présents, préserve les multi-segments (`trkseg`),
 * les routes (`rte`) et les waypoints (`wpt`). Ne crashe jamais sur un fichier
 * malformé : lève une `Error` au message clair, à présenter à l'utilisateur.
 */

/** Erreur d'import GPX, avec message utilisateur en français. */
export class GpxParseError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "GpxParseError";
  }
}

const ATTR_PREFIX = "@_";

const ARRAY_PATHS = new Set([
  "gpx.wpt",
  "gpx.rte",
  "gpx.rte.rtept",
  "gpx.trk",
  "gpx.trk.trkseg",
  "gpx.trk.trkseg.trkpt",
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: ATTR_PREFIX,
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
  // fast-xml-parser v5 type le jPath comme JPathOrMatcher ; au runtime c'est la
  // chaîne du chemin (ex. "gpx.trk.trkseg.trkpt"). `toArray` couvre de toute façon
  // le cas mono-élément si isArray ne déclenche pas.
  isArray: (_name, jpath) => ARRAY_PATHS.has(String(jpath)),
});

/** Convertit une valeur de balise en texte propre, ou `undefined` si vide. */
function asText(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

/** Convertit une valeur en nombre fini, ou `undefined`. */
function asNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Champs communs lat/lon/ele/time d'un point GPX (`trkpt`, `rtept`, `wpt`). */
interface RawPointNode {
  [key: string]: unknown;
}

/** Construit un `TrackPoint` à partir d'un nœud GPX, ou `undefined` si lat/lon invalides. */
function toTrackPoint(node: RawPointNode): TrackPoint | undefined {
  const lat = asNumber(node[`${ATTR_PREFIX}lat`]);
  const lon = asNumber(node[`${ATTR_PREFIX}lon`]);
  if (lat === undefined || lon === undefined) return undefined;
  const point: TrackPoint = { lat, lon };
  const ele = asNumber(node["ele"]);
  if (ele !== undefined) point.ele = ele;
  const time = asText(node["time"]);
  if (time !== undefined) point.time = time;
  return point;
}

/** Normalise une valeur potentiellement absente en tableau. */
function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function toWaypoint(node: RawPointNode): Waypoint | undefined {
  const lat = asNumber(node[`${ATTR_PREFIX}lat`]);
  const lon = asNumber(node[`${ATTR_PREFIX}lon`]);
  if (lat === undefined || lon === undefined) return undefined;
  const wpt: Waypoint = {
    id: crypto.randomUUID(),
    lat,
    lon,
    name: asText(node["name"]) ?? "Waypoint",
  };
  const ele = asNumber(node["ele"]);
  if (ele !== undefined) wpt.ele = ele;
  const time = asText(node["time"]);
  if (time !== undefined) wpt.time = time;
  const note = asText(node["desc"]) ?? asText(node["cmt"]);
  if (note !== undefined) wpt.note = note;
  const symbol = asText(node["sym"]);
  if (symbol !== undefined) wpt.symbol = symbol;
  return wpt;
}

/** Construit la liste des traces (trk multi-segments + rte). */
function buildTracks(gpx: RawPointNode): Track[] {
  const tracks: Track[] = [];

  for (const trk of toArray(gpx["trk"] as RawPointNode | RawPointNode[] | undefined)) {
    const segments: TrackPoint[][] = [];
    for (const seg of toArray(trk["trkseg"] as RawPointNode | RawPointNode[] | undefined)) {
      const points = toArray(seg["trkpt"] as RawPointNode | RawPointNode[] | undefined)
        .map(toTrackPoint)
        .filter((p): p is TrackPoint => p !== undefined);
      segments.push(points);
    }
    tracks.push({
      id: crypto.randomUUID(),
      name: asText(trk["name"]) ?? `Trace ${tracks.length + 1}`,
      kind: "track",
      segments: segments.length > 0 ? segments : [[]],
      visible: true,
      color: defaultTrackColor(tracks.length),
    });
  }

  for (const rte of toArray(gpx["rte"] as RawPointNode | RawPointNode[] | undefined)) {
    const points = toArray(rte["rtept"] as RawPointNode | RawPointNode[] | undefined)
      .map(toTrackPoint)
      .filter((p): p is TrackPoint => p !== undefined);
    tracks.push({
      id: crypto.randomUUID(),
      name: asText(rte["name"]) ?? `Route ${tracks.length + 1}`,
      kind: "route",
      segments: [points],
      visible: true,
      color: defaultTrackColor(tracks.length),
    });
  }

  return tracks;
}

/** Parse une chaîne GPX en `Project`. Lève `GpxParseError` si invalide. */
export function parseGpx(xml: string, projectName = "Import GPX"): Project {
  if (typeof xml !== "string" || xml.trim().length === 0) {
    throw new GpxParseError("Fichier GPX vide.");
  }

  let root: RawPointNode;
  try {
    root = parser.parse(xml) as RawPointNode;
  } catch (cause) {
    throw new GpxParseError("Fichier GPX illisible (XML invalide).", { cause });
  }

  const gpx = root["gpx"] as RawPointNode | undefined;
  if (gpx === undefined || typeof gpx !== "object") {
    throw new GpxParseError("Ce fichier ne contient pas de racine <gpx>.");
  }

  const metadata = gpx["metadata"] as RawPointNode | undefined;
  const name = asText(metadata?.["name"]) ?? asText(gpx["name"]) ?? projectName;

  const tracks = buildTracks(gpx);
  const waypoints = toArray(gpx["wpt"] as RawPointNode | RawPointNode[] | undefined)
    .map(toWaypoint)
    .filter((w): w is Waypoint => w !== undefined);

  return { id: crypto.randomUUID(), name, tracks, waypoints };
}
