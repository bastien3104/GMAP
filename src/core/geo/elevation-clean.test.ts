import { describe, it, expect } from "vitest";
import { createTrack } from "../model";
import { removeElevationSpikes } from "./elevation-clean";

describe("removeElevationSpikes", () => {
  it("remplace un pic d'altitude isolé par l'interpolation des voisins", () => {
    const track = createTrack({
      segments: [
        [
          { lon: 0, lat: 0, ele: 1000 },
          { lon: 0, lat: 0.001, ele: 1500 }, // pic (+500 vs ~1000)
          { lon: 0, lat: 0.002, ele: 1010 },
        ],
      ],
    });
    const out = removeElevationSpikes(track, 25);
    expect(out.segments[0]![1]!.ele).toBe(1005); // (1000+1010)/2
  });

  it("laisse une montée régulière intacte", () => {
    const track = createTrack({
      segments: [
        [
          { lon: 0, lat: 0, ele: 1000 },
          { lon: 0, lat: 0.001, ele: 1010 },
          { lon: 0, lat: 0.002, ele: 1020 },
        ],
      ],
    });
    expect(removeElevationSpikes(track, 25).segments[0]![1]!.ele).toBe(1010);
  });
});
