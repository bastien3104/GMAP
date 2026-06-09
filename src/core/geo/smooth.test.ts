import { describe, it, expect } from "vitest";
import { createTrack } from "../model";
import { smoothTrack } from "./smooth";

describe("smoothTrack", () => {
  it("conserve les extrémités et adoucit un point intérieur", () => {
    const track = createTrack({
      segments: [
        [
          { lon: 0, lat: 0 },
          { lon: 0.002, lat: 0 }, // pic latéral
          { lon: 0, lat: 0.002 },
        ],
      ],
    });
    const out = smoothTrack(track, { windowSize: 3, maxJumpM: 0 });
    const seg = out.segments[0]!;
    expect(seg[0]).toEqual({ lon: 0, lat: 0 }); // extrémité fixe
    expect(seg[2]).toEqual({ lon: 0, lat: 0.002 }); // extrémité fixe
    expect(seg[1]!.lon).toBeLessThan(0.002); // point intérieur lissé
  });

  it("retire un point aberrant (saut trop grand)", () => {
    const track = createTrack({
      segments: [
        [
          { lon: 0, lat: 0 },
          { lon: 5, lat: 5 }, // saut énorme
          { lon: 0, lat: 0.001 },
          { lon: 0, lat: 0.002 },
        ],
      ],
    });
    const out = smoothTrack(track, { windowSize: 1, maxJumpM: 1000 });
    expect(out.segments[0]!.some((p) => p.lon === 5)).toBe(false);
  });

  it("moyenne l'altitude des voisins", () => {
    const track = createTrack({
      segments: [
        [
          { lon: 0, lat: 0, ele: 100 },
          { lon: 0, lat: 0.001, ele: 200 },
          { lon: 0, lat: 0.002, ele: 100 },
        ],
      ],
    });
    const out = smoothTrack(track, { windowSize: 3, maxJumpM: 0 });
    expect(out.segments[0]![1]!.ele).toBeCloseTo((100 + 200 + 100) / 3, 5);
  });
});
