import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { createTrack } from "../model";
import {
  buildElevationUrl,
  parseElevationResponse,
  trackCoords,
  withElevations,
} from "./elevation-client";

const fixture = readFileSync(
  new URL("./__fixtures__/elevation-sample.json", import.meta.url),
  "utf-8",
);

describe("buildElevationUrl", () => {
  it("encode lon/lat séparés et la ressource", () => {
    const url = buildElevationUrl([
      [6.0, 45.0],
      [6.01, 45.01],
    ]);
    expect(url).toContain("resource=ign_rge_alti_wld");
    expect(url).toContain("lon=6%7C6.01"); // 6|6.01
    expect(url).toContain("lat=45%7C45.01");
  });
});

describe("parseElevationResponse", () => {
  it("extrait les z dans l'ordre", () => {
    expect(parseElevationResponse(fixture)).toEqual([1035.2, 1120.5, -99999.0]);
  });
  it("lève une erreur si pas d'elevations", () => {
    expect(() => parseElevationResponse("{}")).toThrow();
  });
});

describe("trackCoords / withElevations", () => {
  const track = createTrack({
    segments: [
      [
        { lon: 6.0, lat: 45.0 },
        { lon: 6.01, lat: 45.01 },
        { lon: 6.02, lat: 45.02 },
      ],
    ],
  });

  it("aplati les coordonnées dans l'ordre", () => {
    expect(trackCoords(track)).toEqual([
      [6.0, 45.0],
      [6.01, 45.01],
      [6.02, 45.02],
    ]);
  });

  it("applique les altitudes valides et ignore la sentinelle no-data", () => {
    const next = withElevations(track, [1035.2, 1120.5, -99999.0]);
    const seg = next.segments[0]!;
    expect(seg[0]?.ele).toBe(1035.2);
    expect(seg[1]?.ele).toBe(1120.5);
    expect(seg[2]?.ele).toBeUndefined(); // -99999 ignoré
  });
});
