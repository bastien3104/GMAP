import { describe, it, expect } from "vitest";
import { createTrack, type Project } from "../model";
import { buildTcx } from "./tcx";

function sample(withTime: boolean): Project {
  return {
    id: "p",
    name: "Projet",
    tracks: [
      createTrack({
        name: "Une très longue trace de montagne",
        segments: [
          [
            {
              lon: 6.0,
              lat: 45.0,
              ele: 1000,
              ...(withTime ? { time: "2026-06-10T08:00:00Z" } : {}),
            },
            { lon: 6.1, lat: 45.1, ele: 1100 },
          ],
        ],
      }),
    ],
    waypoints: [],
  };
}

describe("buildTcx", () => {
  it("produit un TrainingCenterDatabase v2 avec Course/Trackpoint", () => {
    const tcx = buildTcx(sample(true));
    expect(tcx).toContain("<TrainingCenterDatabase");
    expect(tcx).toContain("<Course>");
    expect(tcx).toContain("<Trackpoint>");
    expect(tcx).toContain("<LatitudeDegrees>45</LatitudeDegrees>");
    expect(tcx).toContain("<AltitudeMeters>1000</AltitudeMeters>");
    expect(tcx).toContain("<Time>2026-06-10T08:00:00Z</Time>");
  });

  it("synthétise un horodatage si absent et tronque le nom à 15 caractères", () => {
    const tcx = buildTcx(sample(false));
    expect(tcx).toContain("<Time>2020-01-01T00:00:00.000Z</Time>");
    expect(tcx).toContain("<Name>Une très longue</Name>"); // 15 caractères
  });
});
