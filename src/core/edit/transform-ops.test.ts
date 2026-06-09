import { describe, it, expect } from "vitest";
import { createTrack, type Project } from "../model";
import {
  convertTrackKind,
  mergeTracks,
  reverseTrack,
  splitTrackByDistance,
} from "./transform-ops";

function single(): { project: Project; id: string } {
  const track = createTrack({
    name: "T",
    segments: [
      [
        { lon: 0, lat: 0 },
        { lon: 0, lat: 0.001 },
        { lon: 0, lat: 0.002 },
        { lon: 0, lat: 0.003 },
        { lon: 0, lat: 0.004 },
      ],
    ],
  });
  return { project: { id: "p", name: "P", tracks: [track], waypoints: [] }, id: track.id };
}

describe("reverseTrack", () => {
  it("inverse l'ordre des points et des segments", () => {
    const t = createTrack({
      segments: [
        [
          { lon: 0, lat: 0 },
          { lon: 1, lat: 1 },
        ],
        [
          { lon: 2, lat: 2 },
          { lon: 3, lat: 3 },
        ],
      ],
    });
    const p: Project = { id: "p", name: "P", tracks: [t], waypoints: [] };
    const seg = reverseTrack(p, t.id).tracks[0]!.segments;
    expect(seg[0]).toEqual([
      { lon: 3, lat: 3 },
      { lon: 2, lat: 2 },
    ]);
    expect(seg[1]).toEqual([
      { lon: 1, lat: 1 },
      { lon: 0, lat: 0 },
    ]);
  });
});

describe("convertTrackKind", () => {
  it("track → route (aplati) puis route → track", () => {
    const { project, id } = single();
    const route = convertTrackKind(project, id);
    expect(route.tracks[0]!.kind).toBe("route");
    expect(route.tracks[0]!.segments).toHaveLength(1);
    const back = convertTrackKind(route, id);
    expect(back.tracks[0]!.kind).toBe("track");
  });
});

describe("mergeTracks", () => {
  it("concatène les segments des traces visées et garde la première", () => {
    const a = createTrack({ name: "A", segments: [[{ lon: 0, lat: 0 }]] });
    const b = createTrack({ name: "B", segments: [[{ lon: 1, lat: 1 }]] });
    const c = createTrack({ name: "C", segments: [[{ lon: 2, lat: 2 }]] });
    const p: Project = { id: "p", name: "P", tracks: [a, b, c], waypoints: [] };
    const merged = mergeTracks(p, [a.id, c.id]);
    expect(merged.tracks).toHaveLength(2); // a+c fusionnées, b reste
    const first = merged.tracks[0]!;
    expect(first.name).toBe("A");
    expect(first.segments).toHaveLength(2);
  });

  it("ne fait rien si moins de 2 cibles", () => {
    const { project, id } = single();
    expect(mergeTracks(project, [id])).toBe(project);
  });
});

describe("splitTrackByDistance", () => {
  it("découpe en morceaux contigus", () => {
    const { project, id } = single(); // 5 pts × ~111 m ≈ 444 m
    const result = splitTrackByDistance(project, id, 200);
    expect(result.tracks.length).toBeGreaterThan(1);
    // les morceaux se touchent (point-frontière partagé)
    const a = result.tracks[0]!.segments[0]!;
    const b = result.tracks[1]!.segments[0]!;
    expect(a[a.length - 1]).toEqual(b[0]);
  });

  it("ne découpe pas avec un intervalle nul ou trop grand", () => {
    const { project, id } = single();
    expect(splitTrackByDistance(project, id, 0)).toBe(project);
    expect(splitTrackByDistance(project, id, 100000)).toBe(project);
  });
});
