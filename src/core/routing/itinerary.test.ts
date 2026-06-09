import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { buildItineraryUrl, parseItineraryResponse } from "./itinerary";

const fixture = readFileSync(
  new URL("./__fixtures__/itinerary-sample.json", import.meta.url),
  "utf-8",
);

describe("buildItineraryUrl", () => {
  it("inclut profil, start/end et geometryFormat", () => {
    const url = buildItineraryUrl("pedestrian", [6.0, 45.0], [6.05, 45.05]);
    expect(url).toContain("resource=bdtopo-osrm");
    expect(url).toContain("profile=pedestrian");
    expect(url).toContain("start=6%2C45"); // 6,45 encodé
    expect(url).toContain("end=6.05%2C45.05");
    expect(url).toContain("geometryFormat=geojson");
  });
});

describe("parseItineraryResponse", () => {
  it("extrait les points, la distance et la durée", () => {
    const segment = parseItineraryResponse(fixture);
    expect(segment.points).toHaveLength(4);
    expect(segment.points[0]).toEqual({ lon: 6.0, lat: 45.0 });
    expect(segment.points[3]).toEqual({ lon: 6.05, lat: 45.05 });
    expect(segment.distance).toBe(8421.3);
    expect(segment.duration).toBe(6300.5);
  });

  it("lève une erreur claire sur une réponse sans géométrie", () => {
    expect(() => parseItineraryResponse("{}")).toThrow();
    expect(() => parseItineraryResponse('{"geometry":{"coordinates":[]}}')).toThrow();
  });
});
