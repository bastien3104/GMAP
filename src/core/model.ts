/**
 * Modèle de données central de l'application (source de vérité).
 *
 * Un projet = liste de traces (tracks) + liste de waypoints.
 * Une trace = une ou plusieurs segments, chaque segment = liste ordonnée de points
 * {lat, lon, ele?, time?}. Le format pivot interne d'affichage est GeoJSON, mais ce
 * modèle reste la représentation canonique manipulée par la logique métier.
 */

/** Nature d'une trace : `track` (trk GPX) ou `route` (rte GPX). */
export type TrackKind = "track" | "route";

/** Un point d'une trace. `ele` (altitude, m) et `time` (ISO 8601) sont optionnels. */
export interface TrackPoint {
  /** Latitude en degrés décimaux (WGS84). */
  lat: number;
  /** Longitude en degrés décimaux (WGS84). */
  lon: number;
  /** Altitude en mètres, si connue. */
  ele?: number;
  /** Horodatage ISO 8601, si connu. */
  time?: string;
}

/**
 * Une trace : une ou plusieurs segments ordonnés.
 * - un `trk` GPX multi-`trkseg` → un Track de plusieurs segments ;
 * - un `rte` GPX → un Track `kind: "route"` à un seul segment.
 */
export interface Track {
  /** Identifiant unique stable (généré à l'import/création). */
  id: string;
  /** Nom affiché de la trace. */
  name: string;
  /** Nature (track ou route) — préserve la structure GPX d'origine. */
  kind: TrackKind;
  /** Segments ordonnés ; chaque segment est une liste ordonnée de points. */
  segments: TrackPoint[][];
  /** Visibilité sur la carte (calque). */
  visible: boolean;
  /** Couleur d'affichage (CSS), ex. `#e85d04`. */
  color: string;
}

/** Un point d'intérêt (waypoint / POI). */
export interface Waypoint {
  /** Identifiant unique stable. */
  id: string;
  /** Latitude en degrés décimaux (WGS84). */
  lat: number;
  /** Longitude en degrés décimaux (WGS84). */
  lon: number;
  /** Nom affiché. */
  name: string;
  /** Altitude en mètres, si connue. */
  ele?: number;
  /** Horodatage ISO 8601, si connu. */
  time?: string;
  /** Note libre. */
  note?: string;
  /** Symbole / icône (clé logique, mappée à un rendu plus tard). */
  symbol?: string;
}

/** Un projet : l'unité de travail ouverte dans l'éditeur. */
export interface Project {
  /** Identifiant unique stable. */
  id: string;
  /** Nom du projet. */
  name: string;
  /** Traces du projet. */
  tracks: Track[];
  /** Waypoints du projet. */
  waypoints: Waypoint[];
}

/** Palette de couleurs par défaut, attribuée cycliquement aux traces importées. */
export const DEFAULT_TRACK_COLORS: readonly string[] = [
  "#e85d04",
  "#0077b6",
  "#2d6a4f",
  "#9d0208",
  "#7209b7",
  "#ff9e00",
  "#118ab2",
  "#d62828",
];

/** Retourne la couleur par défaut pour la n-ième trace (cyclique). */
export function defaultTrackColor(index: number): string {
  const palette = DEFAULT_TRACK_COLORS;
  return palette[index % palette.length] ?? "#e85d04";
}

/** Crée un projet vide. */
export function createEmptyProject(name = "Projet sans titre"): Project {
  return { id: crypto.randomUUID(), name, tracks: [], waypoints: [] };
}

/** Options de création d'une trace. */
export interface CreateTrackOptions {
  name?: string;
  kind?: TrackKind;
  segments?: TrackPoint[][];
  visible?: boolean;
  color?: string;
}

/** Crée une trace avec des valeurs par défaut raisonnables. */
export function createTrack(options: CreateTrackOptions = {}): Track {
  return {
    id: crypto.randomUUID(),
    name: options.name ?? "Trace",
    kind: options.kind ?? "track",
    segments: options.segments ?? [[]],
    visible: options.visible ?? true,
    color: options.color ?? DEFAULT_TRACK_COLORS[0] ?? "#e85d04",
  };
}

/** Nombre total de points d'une trace (tous segments confondus). */
export function trackPointCount(track: Track): number {
  return track.segments.reduce((sum, seg) => sum + seg.length, 0);
}

/** Itère tous les points d'une trace (tous segments, dans l'ordre). */
export function* iterateTrackPoints(track: Track): Generator<TrackPoint> {
  for (const segment of track.segments) {
    for (const point of segment) {
      yield point;
    }
  }
}
