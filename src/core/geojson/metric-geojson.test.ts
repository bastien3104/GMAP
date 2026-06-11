import { describe, expect, it } from "vitest";
import { createTrack } from "../model";
import { metricFeatureCollection } from "./metric-geojson";

describe("metricFeatureCollection", () => {
  it("construit les arêtes de FC (moyenne des extrémités) avec bornes", () => {
    const track = createTrack({
      segments: [
        [
          { lat: 45, lon: 6, hr: 100 },
          { lat: 45.001, lon: 6, hr: 140 },
          { lat: 45.002, lon: 6, hr: 160 },
        ],
      ],
    });
    const { collection, min, max } = metricFeatureCollection(track, "hr");
    expect(collection.features).toHaveLength(2);
    const values = collection.features.map(
      (f) => (f.properties as { value: number }).value,
    );
    expect(values).toEqual([120, 150]);
    expect(min).toBe(120);
    expect(max).toBe(150);
  });

  it("dérive la vitesse des horodatages quand le capteur est absent", () => {
    const t0 = Date.parse("2026-06-01T08:00:00Z");
    const track = createTrack({
      segments: [
        [
          { lat: 45, lon: 6, time: new Date(t0).toISOString() },
          { lat: 45.001, lon: 6, time: new Date(t0 + 60_000).toISOString() },
        ],
      ],
    });
    const { collection } = metricFeatureCollection(track, "speed");
    expect(collection.features).toHaveLength(1);
    const value = (collection.features[0]!.properties as { value: number }).value;
    expect(value).toBeCloseTo(111.195 / 60, 2);
  });

  it("omet les arêtes sans valeur et gère le cas vide", () => {
    const track = createTrack({
      segments: [[{ lat: 45, lon: 6 }, { lat: 45.001, lon: 6 }]],
    });
    const { collection, min, max } = metricFeatureCollection(track, "hr");
    expect(collection.features).toHaveLength(0);
    expect(max).toBeGreaterThan(min);
  });
});
