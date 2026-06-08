import type { Project, Track, TrackPoint, Waypoint } from "../model";

/**
 * Export GPX 1.1 fidèle : sérialise un `Project` en chaîne GPX valide.
 *
 * Fidélité structurelle : `ele`/`time`, multi-segments (`trkseg`), routes (`rte`)
 * et waypoints (`wpt`) sont préservés. Les nombres sont écrits tels quels (round-trip
 * exact des coordonnées et altitudes).
 */

/** Échappe les caractères réservés XML dans un contenu texte. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Nombre → chaîne (préserve la valeur pour un round-trip exact). */
function num(value: number): string {
  return String(value);
}

/** Élément texte optionnel `<tag>contenu</tag>`, ou chaîne vide si absent. */
function textEl(tag: string, value: string | undefined, indent: string): string {
  if (value === undefined) return "";
  return `${indent}<${tag}>${escapeXml(value)}</${tag}>\n`;
}

/** Contenu commun ele/time d'un point. */
function pointChildren(point: TrackPoint, indent: string): string {
  let out = "";
  if (point.ele !== undefined) out += `${indent}<ele>${num(point.ele)}</ele>\n`;
  if (point.time !== undefined) out += `${indent}<time>${escapeXml(point.time)}</time>\n`;
  return out;
}

/** Sérialise un point (`trkpt` / `rtept`). */
function serializePoint(tag: string, point: TrackPoint, indent: string): string {
  const children = pointChildren(point, `${indent}  `);
  const open = `${indent}<${tag} lat="${num(point.lat)}" lon="${num(point.lon)}">`;
  if (children === "") return `${open}</${tag}>\n`;
  return `${open}\n${children}${indent}</${tag}>\n`;
}

function serializeWaypoint(wpt: Waypoint, indent: string): string {
  const inner = `${indent}  `;
  let children = "";
  if (wpt.ele !== undefined) children += `${inner}<ele>${num(wpt.ele)}</ele>\n`;
  if (wpt.time !== undefined) children += `${inner}<time>${escapeXml(wpt.time)}</time>\n`;
  children += textEl("name", wpt.name, inner);
  children += textEl("desc", wpt.note, inner);
  children += textEl("sym", wpt.symbol, inner);
  return `${indent}<wpt lat="${num(wpt.lat)}" lon="${num(wpt.lon)}">\n${children}${indent}</wpt>\n`;
}

function serializeTrack(track: Track, indent: string): string {
  const inner = `${indent}  `;
  let out = `${indent}<trk>\n`;
  out += textEl("name", track.name, inner);
  for (const segment of track.segments) {
    out += `${inner}<trkseg>\n`;
    for (const point of segment) {
      out += serializePoint("trkpt", point, `${inner}  `);
    }
    out += `${inner}</trkseg>\n`;
  }
  out += `${indent}</trk>\n`;
  return out;
}

function serializeRoute(track: Track, indent: string): string {
  const inner = `${indent}  `;
  let out = `${indent}<rte>\n`;
  out += textEl("name", track.name, inner);
  for (const segment of track.segments) {
    for (const point of segment) {
      out += serializePoint("rtept", point, inner);
    }
  }
  out += `${indent}</rte>\n`;
  return out;
}

/** Sérialise un `Project` en document GPX 1.1. */
export function buildGpx(project: Project): string {
  const indent = "  ";
  let body = "";
  body += `${indent}<metadata>\n${indent}  <name>${escapeXml(project.name)}</name>\n${indent}</metadata>\n`;

  for (const wpt of project.waypoints) {
    body += serializeWaypoint(wpt, indent);
  }
  for (const track of project.tracks) {
    body += track.kind === "route" ? serializeRoute(track, indent) : serializeTrack(track, indent);
  }

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="GMAP" xmlns="http://www.topografix.com/GPX/1/1">\n` +
    body +
    `</gpx>\n`
  );
}
