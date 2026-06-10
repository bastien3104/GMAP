import { describe, it, expect } from "vitest";
import { createTrack, type Project } from "../model";
import { buildFit } from "./fit";

function sample(): Project {
  return {
    id: "p",
    name: "Course test",
    tracks: [
      createTrack({
        segments: [
          [
            { lon: 6.0, lat: 45.0, ele: 1000, time: "2026-06-10T08:00:00Z" },
            { lon: 6.1, lat: 45.1, ele: 1100 },
            { lon: 6.2, lat: 45.2, ele: 1050 },
          ],
        ],
      }),
    ],
    waypoints: [],
  };
}

describe("buildFit", () => {
  const fit = buildFit(sample());

  it("a un en-tête FIT valide (taille 14, signature .FIT)", () => {
    expect(fit[0]).toBe(14);
    expect(String.fromCharCode(fit[8]!, fit[9]!, fit[10]!, fit[11]!)).toBe(".FIT");
  });

  it("la taille de données de l'en-tête est cohérente avec le fichier", () => {
    const dataSize =
      fit[4]! | (fit[5]! << 8) | (fit[6]! << 16) | (fit[7]! << 24);
    expect(fit.length).toBe(14 + dataSize + 2); // en-tête + données + CRC
  });

  it("produit un fichier non trivial (file_id + course + lap + records)", () => {
    expect(fit.length).toBeGreaterThan(80);
  });
});
