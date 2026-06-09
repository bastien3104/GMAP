import { describe, it, expect } from "vitest";
import { naismithDuration } from "./naismith";

describe("naismithDuration", () => {
  it("plat : distance / vitesse de base", () => {
    expect(naismithDuration(5000, 0, 0, { baseSpeedKmh: 5 })).toBeCloseTo(3600, 5);
  });

  it("montée : ~1 h par 600 m", () => {
    expect(naismithDuration(0, 600, 0)).toBeCloseTo(3600, 5);
  });

  it("plat + montée s'additionnent", () => {
    expect(naismithDuration(5000, 600, 0, { baseSpeedKmh: 5 })).toBeCloseTo(7200, 5);
  });

  it("correction de descente (Langmuir) réduit le temps", () => {
    const sans = naismithDuration(1000, 0, 300, { baseSpeedKmh: 5 });
    const avec = naismithDuration(1000, 0, 300, {
      baseSpeedKmh: 5,
      descentCorrection: true,
    });
    expect(avec).toBeLessThan(sans);
    expect(avec).toBeCloseTo(720 - 600, 5); // 1km à 5km/h = 720 s, -2 s/m × 300
  });

  it("ne renvoie jamais un temps négatif", () => {
    expect(naismithDuration(0, 0, 1000, { descentCorrection: true })).toBe(0);
  });
});
