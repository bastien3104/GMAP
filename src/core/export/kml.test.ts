import { describe, it, expect } from "vitest";
import { createTrack, type Project } from "../model";
import { buildKml } from "./kml";

function sample(): Project {
  return {
    id: "p",
    name: "Projet & co",
    tracks: [
      createTrack({
        name: "Trace <1>",
        segments: [
          [
            { lon: 6.0, lat: 45.0, ele: 1000 },
            { lon: 6.1, lat: 45.1, ele: 1100 },
          ],
        ],
      }),
    ],
    waypoints: [{ id: "w", lon: 6.05, lat: 45.05, name: "Refuge", ele: 1500 }],
  };
}

describe("buildKml", () => {
  const kml = buildKml(sample());

  it("produit un document KML 2.2", () => {
    expect(kml).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">');
    expect(kml).toContain("<Document>");
  });

  it("inclut le waypoint et la trace (LineString)", () => {
    expect(kml).toContain("<name>Refuge</name>");
    expect(kml).toContain("<LineString>");
    expect(kml).toContain("6,45,1000 6.1,45.1,1100");
  });

  it("échappe les caractères XML", () => {
    expect(kml).toContain("Trace &lt;1&gt;");
    expect(kml).toContain("Projet &amp; co");
  });
});
