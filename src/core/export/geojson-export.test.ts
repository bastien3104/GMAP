import { describe, it, expect } from "vitest";
import { createTrack, type Project } from "../model";
import { projectToGeoJsonExport } from "./geojson-export";

function sample(): Project {
  return {
    id: "p",
    name: "Projet",
    tracks: [
      createTrack({
        name: "T",
        segments: [
          [
            { lon: 6.0, lat: 45.0, ele: 1000 },
            { lon: 6.1, lat: 45.1 },
          ],
        ],
      }),
    ],
    waypoints: [
      { id: "w", lon: 6.05, lat: 45.05, name: "Sommet", ele: 1200, note: "vue" },
    ],
  };
}

describe("projectToGeoJsonExport", () => {
  const fc = projectToGeoJsonExport(sample());

  it("une feature par trace + une par waypoint", () => {
    expect(fc.features).toHaveLength(2);
  });

  it("trace en MultiLineString avec altitude en 3e coordonnée", () => {
    const track = fc.features.find((f) => f.geometry.type === "MultiLineString");
    const coords =
      track?.geometry.type === "MultiLineString" ? track.geometry.coordinates : [];
    expect(coords[0]?.[0]).toEqual([6.0, 45.0, 1000]);
    expect(coords[0]?.[1]).toEqual([6.1, 45.1]); // sans ele
  });

  it("waypoint en Point avec propriétés", () => {
    const wpt = fc.features.find((f) => f.geometry.type === "Point");
    expect(wpt?.properties?.name).toBe("Sommet");
    expect(wpt?.properties?.ele).toBe(1200);
    expect(wpt?.geometry.type === "Point" ? wpt.geometry.coordinates : []).toEqual([
      6.05, 45.05, 1200,
    ]);
  });
});
