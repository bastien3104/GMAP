import { describe, it, expect } from "vitest";
import { createTrack, type Project, type TrackPoint } from "../model";
import { deletePoint, insertPoint, midpoint, movePoint } from "./point-ops";

function project(): Project {
  const track = createTrack({
    name: "T",
    segments: [
      [
        { lon: 6.0, lat: 45.0, ele: 1000, time: "2026-01-01T00:00:00Z" },
        { lon: 6.1, lat: 45.1, ele: 1100 },
        { lon: 6.2, lat: 45.2 },
      ],
    ],
  });
  return { id: "p", name: "P", tracks: [track], waypoints: [] };
}

describe("point-ops", () => {
  it("déplace un point en préservant ele/time", () => {
    const p = project();
    const id = p.tracks[0]!.id;
    const next = movePoint(p, id, 0, 0, 6.5, 45.5);
    const moved = next.tracks[0]!.segments[0]![0]!;
    expect(moved.lon).toBe(6.5);
    expect(moved.lat).toBe(45.5);
    expect(moved.ele).toBe(1000);
    expect(moved.time).toBe("2026-01-01T00:00:00Z");
    // original intact
    expect(p.tracks[0]!.segments[0]![0]!.lon).toBe(6.0);
  });

  it("insère un point à l'index donné", () => {
    const p = project();
    const id = p.tracks[0]!.id;
    const pt: TrackPoint = { lon: 6.05, lat: 45.05 };
    const next = insertPoint(p, id, 0, 1, pt);
    const seg = next.tracks[0]!.segments[0]!;
    expect(seg).toHaveLength(4);
    expect(seg[1]).toEqual(pt);
  });

  it("supprime un point", () => {
    const p = project();
    const id = p.tracks[0]!.id;
    const next = deletePoint(p, id, 0, 1);
    const seg = next.tracks[0]!.segments[0]!;
    expect(seg).toHaveLength(2);
    expect(seg[1]?.lon).toBe(6.2);
  });

  it("calcule le milieu d'une arête (ele moyenne si connue)", () => {
    const m = midpoint(
      { lon: 6.0, lat: 45.0, ele: 1000 },
      { lon: 6.2, lat: 45.2, ele: 1200 },
    );
    expect(m.lon).toBeCloseTo(6.1);
    expect(m.lat).toBeCloseTo(45.1);
    expect(m.ele).toBe(1100);
    // ele indéfinie si l'un des deux manque
    expect(midpoint({ lon: 0, lat: 0, ele: 5 }, { lon: 2, lat: 2 }).ele).toBeUndefined();
  });

  it("ignore les index hors bornes", () => {
    const p = project();
    const id = p.tracks[0]!.id;
    expect(deletePoint(p, id, 0, 9)).toBe(p);
    expect(movePoint(p, id, 0, 9, 1, 1).tracks[0]!.segments[0]).toHaveLength(3);
  });
});
