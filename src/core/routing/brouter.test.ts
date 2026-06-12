import { describe, expect, it } from "vitest";
import { buildBrouterUrl, parseBrouterResponse } from "./brouter";

const SAMPLE_RESPONSE = JSON.stringify({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        creator: "BRouter-1.7.7",
        "track-length": "5289",
        "filtered ascend": "403",
        "total-time": "4458",
        cost: "9665",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [6.87, 45.9, 1035.25],
          [6.8712, 45.9011, 1042.0],
          [6.8725, 45.9022],
        ],
      },
    },
  ],
});

describe("buildBrouterUrl", () => {
  it("construit l'URL avec lonlats, profil et format geojson", () => {
    const url = buildBrouterUrl("hiking-mountain", [6.87, 45.9], [6.88, 45.91]);
    expect(url).toContain("https://brouter.de/brouter?");
    expect(url).toContain("profile=hiking-mountain");
    expect(url).toContain("format=geojson");
    expect(decodeURIComponent(url)).toContain("lonlats=6.87,45.9|6.88,45.91");
  });
});

describe("parseBrouterResponse", () => {
  it("extrait points (avec altitude), distance et durée", () => {
    const segment = parseBrouterResponse(SAMPLE_RESPONSE);
    expect(segment.points).toHaveLength(3);
    expect(segment.points[0]).toEqual({ lon: 6.87, lat: 45.9, ele: 1035.25 });
    // Point sans 3e composante : pas d'altitude inventée.
    expect(segment.points[2]!.ele).toBeUndefined();
    expect(segment.distance).toBe(5289);
    expect(segment.duration).toBe(4458);
  });

  it("tolère des propriétés manquantes (distance/durée à 0)", () => {
    const noProps = JSON.stringify({
      features: [{ geometry: { coordinates: [[6.87, 45.9]] } }],
    });
    const segment = parseBrouterResponse(noProps);
    expect(segment.points).toHaveLength(1);
    expect(segment.distance).toBe(0);
    expect(segment.duration).toBe(0);
  });

  it("rejette une réponse sans géométrie avec une erreur claire", () => {
    expect(() => parseBrouterResponse("{}")).toThrow(/géométrie|invalide/);
    expect(() => parseBrouterResponse('{"features":[]}')).toThrow(/géométrie/);
    expect(() => parseBrouterResponse("null")).toThrow(/invalide/);
  });
});
