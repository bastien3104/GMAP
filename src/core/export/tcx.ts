import type { Project } from "../model";

/**
 * Export TCX (Garmin Training Center) d'un projet : chaque trace devient un `Course`.
 * Le schéma TCX exige `Time` sur chaque Trackpoint → horodatage synthétisé si absent.
 * Pur et testé.
 */

const BASE_TIME = Date.UTC(2020, 0, 1, 0, 0, 0);

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Sérialise un projet en document TCX (Courses). */
export function buildTcx(project: Project): string {
  let courses = "";

  for (const track of project.tracks) {
    const points = track.segments.flat();
    if (points.length === 0) continue;

    let trackpoints = "";
    points.forEach((p, i) => {
      const time = p.time ?? new Date(BASE_TIME + i * 1000).toISOString();
      trackpoints += `        <Trackpoint>\n`;
      trackpoints += `          <Time>${time}</Time>\n`;
      trackpoints += `          <Position><LatitudeDegrees>${p.lat}</LatitudeDegrees>`;
      trackpoints += `<LongitudeDegrees>${p.lon}</LongitudeDegrees></Position>\n`;
      if (p.ele !== undefined) {
        trackpoints += `          <AltitudeMeters>${p.ele}</AltitudeMeters>\n`;
      }
      trackpoints += `        </Trackpoint>\n`;
    });

    // Le nom de Course TCX est limité à 15 caractères.
    const name = escapeXml(track.name).slice(0, 15);
    courses += `    <Course>\n      <Name>${name}</Name>\n      <Track>\n${trackpoints}      </Track>\n    </Course>\n`;
  }

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">\n` +
    `  <Courses>\n` +
    courses +
    `  </Courses>\n</TrainingCenterDatabase>\n`
  );
}
