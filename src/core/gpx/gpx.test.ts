import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { GpxParseError, parseGpx } from "./parse-gpx";
import { buildGpx } from "./build-gpx";
import type { Project } from "../model";

const fixture = readFileSync(
  new URL("./__fixtures__/sample-mountain.gpx", import.meta.url),
  "utf-8",
);

/** Réduit un projet à une forme comparable (sans les identifiants aléatoires). */
function normalize(project: Project): unknown {
  return {
    name: project.name,
    tracks: project.tracks.map((t) => ({
      name: t.name,
      kind: t.kind,
      color: t.color,
      visible: t.visible,
      segments: t.segments,
    })),
    waypoints: project.waypoints.map((w) => ({
      lat: w.lat,
      lon: w.lon,
      name: w.name,
      ele: w.ele,
      time: w.time,
      note: w.note,
      symbol: w.symbol,
    })),
  };
}

describe("parseGpx", () => {
  const project = parseGpx(fixture);

  it("lit le nom du projet depuis les métadonnées", () => {
    expect(project.name).toBe("Sortie test");
  });

  it("lit une trace (multi-segments) et une route", () => {
    expect(project.tracks).toHaveLength(2);
    const [trk, rte] = project.tracks;
    expect(trk?.kind).toBe("track");
    expect(trk?.name).toBe("Montée");
    expect(trk?.segments).toHaveLength(2);
    expect(trk?.segments[0]).toHaveLength(2);
    expect(trk?.segments[1]).toHaveLength(2);
    expect(rte?.kind).toBe("route");
    expect(rte?.segments[0]).toHaveLength(2);
  });

  it("conserve ele et time des points", () => {
    const firstPoint = project.tracks[0]?.segments[0]?.[0];
    expect(firstPoint?.ele).toBe(1035);
    expect(firstPoint?.time).toBe("2026-06-08T08:00:00Z");
    const decimalEle = project.tracks[0]?.segments[0]?.[1]?.ele;
    expect(decimalEle).toBe(1500.5);
  });

  it("lit les waypoints avec nom, altitude, symbole et note", () => {
    expect(project.waypoints).toHaveLength(2);
    const [chamonix, midi] = project.waypoints;
    expect(chamonix?.name).toBe("Chamonix");
    expect(chamonix?.ele).toBe(1035);
    expect(chamonix?.symbol).toBe("Flag");
    expect(midi?.name).toBe("Aiguille du Midi");
    expect(midi?.note).toBe("Sommet");
  });
});

describe("parseGpx — robustesse", () => {
  it("lève une erreur claire sur un fichier vide", () => {
    expect(() => parseGpx("")).toThrow(GpxParseError);
  });

  it("lève une erreur claire sans racine <gpx>", () => {
    expect(() => parseGpx("<html><body>pas du gpx</body></html>")).toThrow(
      GpxParseError,
    );
  });

  it("ne crashe pas sur du texte arbitraire (erreur maîtrisée)", () => {
    expect(() => parseGpx("ceci n'est pas du XML")).toThrow(GpxParseError);
  });
});

describe("buildGpx + round-trip", () => {
  it("produit un GPX 1.1 bien formé", () => {
    const xml = buildGpx(parseGpx(fixture));
    expect(xml).toContain('<gpx version="1.1"');
    expect(xml).toContain('creator="GMAP"');
    expect(xml).toContain("<trkseg>");
    expect(xml).toContain("<rte>");
    expect(xml).toContain("<wpt ");
  });

  it("préserve les données structurelles (parse -> build -> parse)", () => {
    const p1 = parseGpx(fixture);
    const p2 = parseGpx(buildGpx(p1));
    expect(normalize(p2)).toEqual(normalize(p1));
  });

  it("échappe correctement les caractères spéciaux XML", () => {
    const p1 = parseGpx(fixture);
    if (p1.tracks[0] !== undefined) p1.tracks[0].name = "A & B <test>";
    const p2 = parseGpx(buildGpx(p1));
    expect(p2.tracks[0]?.name).toBe("A & B <test>");
  });
});
