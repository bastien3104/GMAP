import type { Project, TrackPoint } from "../model";

/** Export KML 2.2 d'un projet (waypoints en Point, traces en MultiGeometry). Pur et testé. */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function coordinates(points: TrackPoint[]): string {
  return points.map((p) => `${p.lon},${p.lat},${p.ele ?? 0}`).join(" ");
}

/** Sérialise un projet en document KML. */
export function buildKml(project: Project): string {
  let body = "";

  for (const wpt of project.waypoints) {
    body += `    <Placemark>\n      <name>${escapeXml(wpt.name)}</name>\n`;
    if (wpt.note !== undefined) {
      body += `      <description>${escapeXml(wpt.note)}</description>\n`;
    }
    body += `      <Point><coordinates>${wpt.lon},${wpt.lat},${wpt.ele ?? 0}</coordinates></Point>\n`;
    body += `    </Placemark>\n`;
  }

  for (const track of project.tracks) {
    body += `    <Placemark>\n      <name>${escapeXml(track.name)}</name>\n      <MultiGeometry>\n`;
    for (const seg of track.segments) {
      if (seg.length < 2) continue;
      body += `        <LineString><tessellate>1</tessellate><coordinates>${coordinates(seg)}</coordinates></LineString>\n`;
    }
    body += `      </MultiGeometry>\n    </Placemark>\n`;
  }

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<kml xmlns="http://www.opengis.net/kml/2.2">\n` +
    `  <Document>\n` +
    `    <name>${escapeXml(project.name)}</name>\n` +
    body +
    `  </Document>\n</kml>\n`
  );
}
