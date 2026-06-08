/**
 * Modèle de données central de l'application (source de vérité).
 *
 * Un projet = liste de traces (tracks) + liste de waypoints.
 * Une trace = liste ordonnée de points {lat, lon, ele?, time?}.
 * Tout le reste de l'application (carte, store, import/export GPX) s'appuie sur
 * ces types. Le format pivot interne de travail est GeoJSON, mais ce modèle
 * reste la représentation canonique manipulée par la logique métier.
 *
 * Ce fichier est volontairement minimal en Phase 0 ; il sera étoffé en Phase 1
 * (import/export GPX) sans casser l'API publique existante.
 */

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

/** Une trace : suite ordonnée de points, avec métadonnées d'affichage. */
export interface Track {
  /** Identifiant unique stable (généré à l'import/création). */
  id: string;
  /** Nom affiché de la trace. */
  name: string;
  /** Points ordonnés de la trace. */
  points: TrackPoint[];
  /** Visibilité sur la carte (calque). */
  visible: boolean;
  /** Couleur d'affichage (CSS), ex. `# e85d04`. */
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

/** Crée un projet vide. */
export function createEmptyProject(name = "Projet sans titre"): Project {
  return { id: crypto.randomUUID(), name, tracks: [], waypoints: [] };
}
