import { describe, it, expect } from "vitest";
import { createTrack } from "../model";
import { simplifyTrack } from "./simplify";

describe("simplifyTrack", () => {
  it("retire les points colinéaires (sur une droite)", () => {
    const track = createTrack({
      segments: [
        [
          { lon: 0, lat: 0 },
          { lon: 0, lat: 0.001 },
          { lon: 0, lat: 0.002 },
          { lon: 0, lat: 0.003 },
        ],
      ],
    });
    const out = simplifyTrack(track, 5);
    expect(out.segments[0]).toHaveLength(2); // ne garde que les extrémités
  });

  it("conserve un point qui dévie au-delà de la tolérance", () => {
    const track = createTrack({
      segments: [
        [
          { lon: 0, lat: 0 },
          { lon: 0.001, lat: 0.001 }, // ~110 m hors de la droite
          { lon: 0, lat: 0.002 },
        ],
      ],
    });
    expect(simplifyTrack(track, 5).segments[0]).toHaveLength(3);
  });

  it("tolérance ≤ 0 : trace inchangée", () => {
    const track = createTrack({
      segments: [[{ lon: 0, lat: 0 }, { lon: 0, lat: 0.001 }, { lon: 0, lat: 0.002 }]],
    });
    expect(simplifyTrack(track, 0)).toBe(track);
  });
});
