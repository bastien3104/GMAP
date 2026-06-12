import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { buildItineraryUrl, parseItineraryResponse, pickShortestSegment, segmentLength, type RoutedSegment } from "./itinerary";

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

describe("pickShortestSegment", () => {
  const seg = (distance: number, n = 2): RoutedSegment => ({
    points: Array.from({ length: n }, (_, i) => ({ lon: 6 + i * 0.01, lat: 45 })),
    distance,
    duration: 0,
  });
  const ok = (s: RoutedSegment): PromiseSettledResult<RoutedSegment> => ({
    status: "fulfilled",
    value: s,
  });
  const ko = (): PromiseSettledResult<RoutedSegment> => ({
    status: "rejected",
    reason: new Error("réseau"),
  });

  it("retient le candidat le plus court", () => {
    const best = pickShortestSegment([ok(seg(900)), ok(seg(450)), ok(seg(1200))]);
    expect(best.distance).toBe(450);
  });

  it("ignore les échecs et les segments vides", () => {
    const empty: RoutedSegment = { points: [], distance: 1, duration: 0 };
    const best = pickShortestSegment([ko(), ok(empty), ok(seg(800))]);
    expect(best.distance).toBe(800);
  });

  it("compare par longueur géométrique quand la distance annoncée manque", () => {
    // 2 points espacés (~0,78 km) vs 2 points très proches : le plus court gagne.
    const far: RoutedSegment = {
      points: [{ lon: 6, lat: 45 }, { lon: 6.01, lat: 45 }],
      distance: 0,
      duration: 0,
    };
    const near: RoutedSegment = {
      points: [{ lon: 6, lat: 45 }, { lon: 6.001, lat: 45 }],
      distance: 0,
      duration: 0,
    };
    expect(pickShortestSegment([ok(far), ok(near)])).toBe(near);
    expect(segmentLength(near)).toBeGreaterThan(0);
  });

  it("lève si aucun graphe n'a répondu", () => {
    expect(() => pickShortestSegment([ko(), ko()])).toThrow(/itinéraire/i);
  });
});
