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

/**
 * Un point d'une trace. `ele` (altitude, m) et `time` (ISO 8601) sont optionnels.
 * Les champs capteurs (FC, cadence, puissance, température, vitesse) proviennent
 * des imports FIT (« activités ») ; ils sont absents pour un GPX classique.
 */
export interface TrackPoint {
  /** Latitude en degrés décimaux (WGS84). */
  lat: number;
  /** Longitude en degrés décimaux (WGS84). */
  lon: number;
  /** Altitude en mètres, si connue. */
  ele?: number;
  /** Horodatage ISO 8601, si connu. */
  time?: string;
  /** Fréquence cardiaque (bpm), si capteur présent. */
  hr?: number;
  /** Cadence (rpm vélo / spm course), si capteur présent. */
  cadence?: number;
  /** Puissance (W), si capteur présent. */
  power?: number;
  /** Température (°C), si capteur présent. */
  temp?: number;
  /** Vitesse instantanée (m/s), si fournie par l'appareil. */
  speed?: number;
}

/** Sports d'activité reconnus (clé stable, issue de l'enum FIT). */
export type ActivitySport =
  | "generic"
  | "running"
  | "cycling"
  | "swimming"
  | "walking"
  | "hiking"
  | "mountaineering"
  | "rowing"
  | "paddling"
  | "kayaking"
  | "xc-skiing";

/** Métadonnées d'activité (import FIT) attachées à une trace. */
export interface ActivityMeta {
  /** Sport de l'activité. */
  sport: ActivitySport;
  /** Début de l'activité (ISO 8601), si connu. */
  startTime?: string;
  /** Appareil d'enregistrement (fabricant), si connu. */
  device?: string;
}

/** Libellés français des sports d'activité. */
export const ACTIVITY_SPORT_LABELS: Record<ActivitySport, string> = {
  generic: "Activité",
  running: "Course à pied",
  cycling: "Vélo",
  swimming: "Natation",
  walking: "Marche",
  hiking: "Randonnée",
  mountaineering: "Alpinisme",
  rowing: "Aviron",
  paddling: "Canoë",
  kayaking: "Kayak",
  "xc-skiing": "Ski de fond",
};

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
  /** Métadonnées d'activité (présentes pour un import FIT). */
  activity?: ActivityMeta;
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

/** Un symbole de waypoint : clé logique, libellé FR et glyphe d'affichage. */
export interface WaypointSymbol {
  /** Clé logique stable (stockée dans `Waypoint.symbol`, exportée en GPX `<sym>`). */
  key: string;
  /** Libellé affiché dans l'UI. */
  label: string;
  /** Glyphe (emoji) pour le rendu carte/liste. */
  glyph: string;
}

/** Jeu de symboles proposés pour les points d'intérêt (rando/canoë). */
export const WAYPOINT_SYMBOLS: readonly WaypointSymbol[] = [
  { key: "generic", label: "Point", glyph: "📍" },
  { key: "summit", label: "Sommet", glyph: "⛰️" },
  { key: "viewpoint", label: "Point de vue", glyph: "👁️" },
  { key: "water", label: "Eau / source", glyph: "💧" },
  { key: "camp", label: "Bivouac", glyph: "⛺" },
  { key: "food", label: "Ravitaillement", glyph: "🍴" },
  { key: "parking", label: "Parking", glyph: "🅿️" },
  { key: "danger", label: "Danger", glyph: "⚠️" },
  { key: "photo", label: "Photo", glyph: "📷" },
];

/** Symbole par défaut (clé) pour un nouveau waypoint. */
export const DEFAULT_WAYPOINT_SYMBOL = "generic";

/** Retourne le symbole correspondant à une clé (repli sur « générique »). */
export function waypointSymbol(key: string | undefined): WaypointSymbol {
  return (
    WAYPOINT_SYMBOLS.find((s) => s.key === key) ?? WAYPOINT_SYMBOLS[0]!
  );
}

/** Options de création d'un waypoint. */
export interface CreateWaypointOptions {
  lat: number;
  lon: number;
  name?: string;
  ele?: number;
  time?: string;
  note?: string;
  symbol?: string;
}

/** Crée un waypoint avec des valeurs par défaut raisonnables. */
export function createWaypoint(options: CreateWaypointOptions): Waypoint {
  const wpt: Waypoint = {
    id: crypto.randomUUID(),
    lat: options.lat,
    lon: options.lon,
    name: options.name ?? "Point d'intérêt",
    symbol: options.symbol ?? DEFAULT_WAYPOINT_SYMBOL,
  };
  if (options.ele !== undefined) wpt.ele = options.ele;
  if (options.time !== undefined) wpt.time = options.time;
  if (options.note !== undefined) wpt.note = options.note;
  return wpt;
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
  activity?: ActivityMeta;
}

/** Crée une trace avec des valeurs par défaut raisonnables. */
export function createTrack(options: CreateTrackOptions = {}): Track {
  const track: Track = {
    id: crypto.randomUUID(),
    name: options.name ?? "Trace",
    kind: options.kind ?? "track",
    segments: options.segments ?? [[]],
    visible: options.visible ?? true,
    color: options.color ?? DEFAULT_TRACK_COLORS[0] ?? "#e85d04",
  };
  if (options.activity !== undefined) track.activity = options.activity;
  return track;
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
