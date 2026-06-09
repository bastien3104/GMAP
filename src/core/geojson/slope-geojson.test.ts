import { describe, it, expect } from "vitest";
import { createTrack } from "../model";
import { slopeFeatureCollection } from "./slope-geojson";

describe("slopeFeatureCollection", () => {
  it("produit une LineString par arête, avec la pente en propriété", () => {
    const track = createTrack({
      segments: [
        [
          { lon: 0, lat: 0, ele: 100 },
          { lon: 0, lat: 0.001, ele: 150 },
          { lon: 0, lat: 0.002, ele: 120 },
        ],
      ],
    });
    const fc = slopeFeatureCollection(track);
    expect(fc.features).toHaveLength(2);
    const first = fc.features[0];
    expect(first?.geometry.type).toBe("LineString");
    expect(typeof first?.properties?.slope).toBe("number");
  });
});
