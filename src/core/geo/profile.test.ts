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

  it("transporte les capteurs et dérive la vitesse des horodatages", () => {
    const track = createTrack({
      segments: [
        [
          { lon: 0, lat: 0, ele: 100, time: "2026-06-01T08:00:00Z", hr: 120, cadence: 80 },
          { lon: 0, lat: 0.001, ele: 110, time: "2026-06-01T08:01:00Z", hr: 130 },
          { lon: 0, lat: 0.002, ele: 120, time: "2026-06-01T08:02:00Z", speed: 3.5 },
        ],
      ],
    });
    const profile = buildProfile(track);
    expect(profile[0]!.hr).toBe(120);
    expect(profile[0]!.cadence).toBe(80);
    expect(profile[0]!.speed).toBeUndefined(); // premier point : pas d'arête
    expect(profile[1]!.speed).toBeCloseTo(111.195 / 60, 2); // dérivée du temps
    expect(profile[2]!.speed).toBe(3.5); // capteur prioritaire
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
