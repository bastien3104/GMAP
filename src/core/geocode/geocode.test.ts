import { describe, it, expect } from "vitest";
import { buildGeocodeUrl, parseGeocodeResponse } from "./geocode";

describe("buildGeocodeUrl", () => {
  it("encode la requête et les paramètres", () => {
    const url = buildGeocodeUrl("rue de la paix, paris");
    expect(url).toContain("q=rue+de+la+paix%2C+paris");
    expect(url).toContain("limit=8");
    expect(url).toContain("index=address%2Cpoi");
  });
});

describe("parseGeocodeResponse", () => {
  const sample = JSON.stringify({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [6.123, 45.456] },
        properties: { label: "Col du Galibier", type: "poi", score: 0.9 },
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [2.3, 48.86] },
        properties: { name: "Paris" },
      },
    ],
  });

  it("normalise label/lon/lat/type", () => {
    const results = parseGeocodeResponse(sample);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      label: "Col du Galibier",
      lon: 6.123,
      lat: 45.456,
      type: "poi",
    });
    expect(results[1]!.label).toBe("Paris");
    expect(results[1]!.type).toBeUndefined();
  });

  it("ignore les features sans géométrie valide", () => {
    const bad = JSON.stringify({
      features: [
        { geometry: { coordinates: [] }, properties: { label: "x" } },
        { properties: { label: "y" } },
        { geometry: { coordinates: ["a", "b"] }, properties: { label: "z" } },
      ],
    });
    expect(parseGeocodeResponse(bad)).toHaveLength(0);
  });

  it("renvoie une liste vide si pas de features", () => {
    expect(parseGeocodeResponse("{}")).toEqual([]);
  });
});
