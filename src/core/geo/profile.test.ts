import { describe, it, expect } from "vitest";
import { createTrack } from "../model";
import { buildProfile, slopeEdges } from "./profile";

describe("buildProfile", () => {
  it("cumule la distance et ne garde que les points avec altitude", () => {
    const track = createTrack({
      segments: [
        [
          { lon: 0, lat: 0, ele: 100 },
          { lon: 0, lat: 0.001 }, // sans ele : ignoré mais distance cumulée
          { lon: 0, lat: 0.002, ele: 140 },
        ],
      ],
    });
    const profile = buildProfile(track);
    expect(profile).toHaveLength(2);
    expect(profile[0]).toMatchObject({ distance: 0, ele: 100 });
    expect(profile[1]!.ele).toBe(140);
    expect(profile[1]!.distance).toBeCloseTo(2 * 111.195, 1);
  });

  it("profil vide si aucune altitude", () => {
    const track = createTrack({
      segments: [[{ lon: 0, lat: 0 }, { lon: 0, lat: 0.001 }]],
    });
    expect(buildProfile(track)).toHaveLength(0);
  });
});

describe("slopeEdges", () => {
  it("calcule la pente signée par arête", () => {
    const track = createTrack({
      segments: [
        [
          { lon: 0, lat: 0, ele: 100 },
          { lon: 0, lat: 0.001, ele: 150 }, // montée
          { lon: 0, lat: 0.002, ele: 120 }, // descente
        ],
      ],
    });
    const edges = slopeEdges(track);
    expect(edges).toHaveLength(2);
    expect(edges[0]!.slope).toBeGreaterThan(0);
    expect(edges[1]!.slope).toBeLessThan(0);
    expect(edges[0]!.from).toEqual([0, 0]);
  });
});
