import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { buildItineraryUrl, coherenceScore, parseItineraryResponse, pickCoherentSegment, segmentLength, type RoutedCandidate, type RoutedSegment, type RoutingEngine } from "./itinerary";

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

describe("pickCoherentSegment", () => {
  // Ancre → clic : ~1,1 km plein est, à 45° N.
  const anchor: [number, number] = [6.0, 45.0];
  const click: [number, number] = [6.014, 45.0];

  const seg = (points: Array<[number, number]>): RoutedSegment => ({
    points: points.map(([lon, lat]) => ({ lon, lat })),
    distance: 0,
    duration: 0,
  });
  const cand = (engine: RoutingEngine, s: RoutedSegment): RoutedCandidate => ({
    engine,
    segment: s,
  });

  // Suit la corde de bout en bout (léger serpentin).
  const alongChord = seg([
    [6.0, 45.0],
    [6.004, 45.0003],
    [6.008, 44.9997],
    [6.014, 45.0],
  ]);

  it("élimine le candidat raccroché loin des clics, même plus court", () => {
    // Part à ~300 m au sud de l'ancre et arrive à ~300 m du clic : plus court
    // en longueur, mais incohérent avec le geste.
    const snappedAway = seg([
      [6.0, 44.9973],
      [6.007, 44.9973],
      [6.014, 44.9973],
    ]);
    const best = pickCoherentSegment(anchor, click, [
      cand("ign", snappedAway),
      cand("osm-hiking", alongChord),
    ]);
    expect(best.engine).toBe("osm-hiking");
  });

  it("élimine la grande boucle qui sort du corridor", () => {
    // Mêmes extrémités mais détour à ~700 m au nord.
    const bigLoop = seg([
      [6.0, 45.0],
      [6.005, 45.0063],
      [6.009, 45.0063],
      [6.014, 45.0],
    ]);
    const best = pickCoherentSegment(anchor, click, [
      cand("osm-mtb", bigLoop),
      cand("ign", alongChord),
    ]);
    expect(best.engine).toBe("ign");
    expect(coherenceScore(anchor, click, bigLoop)).toBeGreaterThan(
      coherenceScore(anchor, click, alongChord),
    );
  });

  it("hystérésis : à score quasi égal, conserve le moteur précédent", () => {
    // Deux tracés quasi identiques (écart ~10 m sur les points intermédiaires).
    const variantA = alongChord;
    const variantB = seg([
      [6.0, 45.0],
      [6.004, 45.00035],
      [6.008, 44.99965],
      [6.014, 45.0],
    ]);
    const withoutPrevious = pickCoherentSegment(anchor, click, [
      cand("ign", variantA),
      cand("osm-hiking", variantB),
    ]);
    const withPrevious = pickCoherentSegment(
      anchor,
      click,
      [cand("ign", variantA), cand("osm-hiking", variantB)],
      "osm-hiking",
    );
    expect(withoutPrevious.engine).toBe("ign");
    expect(withPrevious.engine).toBe("osm-hiking");
  });

  it("l'hystérésis ne retient pas un moteur précédent vraiment moins bon", () => {
    const bigLoop = seg([
      [6.0, 45.0],
      [6.005, 45.0063],
      [6.009, 45.0063],
      [6.014, 45.0],
    ]);
    const best = pickCoherentSegment(
      anchor,
      click,
      [cand("ign", alongChord), cand("osm-mtb", bigLoop)],
      "osm-mtb",
    );
    expect(best.engine).toBe("ign");
  });

  it("ignore les segments vides et lève si aucun candidat", () => {
    const empty: RoutedSegment = { points: [], distance: 0, duration: 0 };
    const best = pickCoherentSegment(anchor, click, [
      cand("ign", empty),
      cand("osm-hiking", alongChord),
    ]);
    expect(best.engine).toBe("osm-hiking");
    expect(() => pickCoherentSegment(anchor, click, [])).toThrow(/itinéraire/i);
    expect(segmentLength(alongChord)).toBeGreaterThan(1000);
  });
});
