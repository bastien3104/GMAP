import { describe, it, expect } from "vitest";
import { createTrack } from "../model";
import { haversine, trackStats } from "./stats";

describe("haversine", () => {
  it("≈ 111.2 km pour 1° de latitude", () => {
    expect(haversine({ lon: 0, lat: 0 }, { lon: 0, lat: 1 })).toBeCloseTo(111195, -1);
  });
  it("0 pour deux points identiques", () => {
    expect(haversine({ lon: 6, lat: 45 }, { lon: 6, lat: 45 })).toBe(0);
  });
});

describe("trackStats", () => {
  const track = createTrack({
    segments: [
      [
        { lon: 0, lat: 0, ele: 100 },
        { lon: 0, lat: 0.001, ele: 150 },
        { lon: 0, lat: 0.002, ele: 120 },
      ],
    ],
  });

  it("distance = somme des arêtes", () => {
    const s = trackStats(track);
    expect(s.distance).toBeCloseTo(2 * 111.195, 1); // 2 × ~111 m
    expect(s.pointCount).toBe(3);
  });

  it("D+ / D- et altitudes min/max", () => {
    const s = trackStats(track);
    expect(s.ascent).toBe(50); // 100→150
    expect(s.descent).toBe(30); // 150→120
    expect(s.eleMin).toBe(100);
    expect(s.eleMax).toBe(150);
  });

  it("pentes moyenne et max en %", () => {
    const s = trackStats(track);
    expect(s.maxSlope).toBeGreaterThan(0);
    expect(s.avgSlope).toBeCloseTo((80 / s.distance) * 100, 5);
  });

  it("ne franchit pas les frontières de segments pour la distance", () => {
    const multi = createTrack({
      segments: [
        [
          { lon: 0, lat: 0 },
          { lon: 0, lat: 0.001 },
        ],
        [
          { lon: 10, lat: 10 },
          { lon: 10, lat: 10.001 },
        ],
      ],
    });
    const s = trackStats(multi);
    expect(s.distance).toBeCloseTo(2 * 111.195, 1); // pas de saut entre segments
  });

  it("respecte le seuil de D+/D-", () => {
    const s = trackStats(track, 40);
    expect(s.ascent).toBe(50); // 50 > 40 conservé
    expect(s.descent).toBe(0); // 30 < 40 ignoré
  });
});
