import { describe, expect, it } from "vitest";
import { createTrack, type TrackPoint } from "../model";
import {
  activityStats,
  hasSensor,
  hrZones,
  isActivity,
  kmSplits,
} from "./activity-stats";

/** Trace de test : points espacés de ~111 m (0.001° lat) toutes les `dt` secondes. */
function makeTrack(
  count: number,
  dtSeconds: number,
  extra: (i: number) => Partial<TrackPoint> = () => ({}),
): ReturnType<typeof createTrack> {
  const t0 = Date.parse("2026-06-01T08:00:00Z");
  const points: TrackPoint[] = [];
  for (let i = 0; i < count; i++) {
    points.push({
      lat: 45 + i * 0.001,
      lon: 6,
      time: new Date(t0 + i * dtSeconds * 1000).toISOString(),
      ...extra(i),
    });
  }
  return createTrack({ name: "T", segments: [points] });
}

describe("activityStats", () => {
  it("calcule temps total, temps en mouvement et vitesse moyenne", () => {
    // 5 points, 111 m / 60 s ≈ 1,85 m/s (> seuil) → tout est « en mouvement ».
    const stats = activityStats(makeTrack(5, 60));
    expect(stats.totalTime).toBe(240);
    expect(stats.movingTime).toBe(240);
    expect(stats.avgSpeed).toBeCloseTo(1.85, 1);
  });

  it("exclut les pauses du temps en mouvement", () => {
    // Points immobiles au milieu : lat constante entre i=2 et i=3 (vitesse 0).
    const t0 = Date.parse("2026-06-01T08:00:00Z");
    const mk = (lat: number, s: number): TrackPoint => ({
      lat,
      lon: 6,
      time: new Date(t0 + s * 1000).toISOString(),
    });
    const track = createTrack({
      segments: [
        [mk(45, 0), mk(45.001, 60), mk(45.002, 120), mk(45.002, 600), mk(45.003, 660)],
      ],
    });
    const stats = activityStats(track);
    expect(stats.totalTime).toBe(660);
    expect(stats.movingTime).toBe(180); // la pause de 480 s est exclue
  });

  it("agrège FC, cadence, puissance, température et vitesse capteur", () => {
    const stats = activityStats(
      makeTrack(3, 60, (i) => ({
        hr: 120 + i * 10,
        cadence: 80,
        power: 200 + i * 20,
        temp: 10,
        speed: 2 + i,
      })),
    );
    expect(stats.hrAvg).toBe(130);
    expect(stats.hrMax).toBe(140);
    expect(stats.cadenceAvg).toBe(80);
    expect(stats.powerMax).toBe(240);
    expect(stats.tempAvg).toBe(10);
    expect(stats.maxSpeed).toBe(4); // capteur prioritaire sur le calcul
  });

  it("calcule la VAM sur les portions en montée", () => {
    // +10 m par arête de 60 s → 600 m/h.
    const stats = activityStats(makeTrack(4, 60, (i) => ({ ele: 1000 + i * 10 })));
    expect(stats.vam).toBeCloseTo(600, 0);
  });

  it("renvoie null partout sans horodatage ni capteurs", () => {
    const track = createTrack({
      segments: [[{ lat: 45, lon: 6 }, { lat: 45.001, lon: 6 }]],
    });
    const stats = activityStats(track);
    expect(stats.totalTime).toBeNull();
    expect(stats.movingTime).toBeNull();
    expect(stats.avgSpeed).toBeNull();
    expect(stats.hrAvg).toBeNull();
    expect(stats.vam).toBeNull();
  });
});

describe("hrZones", () => {
  it("répartit le temps par zone (FC max 200)", () => {
    // FC 100 (50 %) → Z1, FC 150 (75 %) → Z3, FC 190 (95 %) → Z5.
    // Arêtes : 100→100 (Z1), 100→150 (62,5 % → Z2), 150→190 (85 % → Z4).
    const track = makeTrack(4, 60, (i) => ({ hr: [100, 100, 150, 190][i]! }));
    const zones = hrZones(track, 200);
    expect(zones.map((z) => z.seconds)).toEqual([60, 60, 0, 60, 0]);
    expect(zones[0]!.zone).toBe(1);
  });

  it("ignore les arêtes sans FC ou sans temps", () => {
    const track = makeTrack(3, 60, (i) => (i === 1 ? {} : { hr: 120 }));
    const zones = hrZones(track, 200);
    expect(zones.reduce((s, z) => s + z.seconds, 0)).toBe(0);
  });
});

describe("kmSplits", () => {
  it("découpe au kilomètre avec répartition linéaire du temps et du D+", () => {
    // 25 points espacés de ~111 m → ~2,67 km, 60 s et +10 m par arête.
    const track = makeTrack(25, 60, (i) => ({ ele: 1000 + i * 10 }));
    const splits = kmSplits(track);
    expect(splits).toHaveLength(3);
    expect(splits[0]!.distance).toBe(1000);
    // ~9 arêtes par km → ~540 s et ~90 m de D+.
    expect(splits[0]!.seconds).toBeCloseTo(540, -1);
    expect(splits[0]!.ascent).toBeCloseTo(90, 0);
    // Dernier split partiel.
    expect(splits[2]!.distance).toBeLessThan(1000);
    expect(splits[2]!.distance).toBeGreaterThan(50);
    // Total cohérent.
    const total = splits.reduce((s, x) => s + (x.seconds ?? 0), 0);
    expect(total).toBeCloseTo(24 * 60, 0);
  });

  it("temps null pour une trace non horodatée", () => {
    const track = createTrack({
      segments: [
        Array.from({ length: 12 }, (_, i) => ({ lat: 45 + i * 0.001, lon: 6 })),
      ],
    });
    const splits = kmSplits(track);
    expect(splits.length).toBeGreaterThan(0);
    expect(splits[0]!.seconds).toBeNull();
  });
});

describe("isActivity / hasSensor", () => {
  it("détecte les activités et les capteurs présents", () => {
    const plain = createTrack({ segments: [[{ lat: 45, lon: 6 }]] });
    const activity = createTrack({
      segments: [[{ lat: 45, lon: 6, hr: 120 }]],
      activity: { sport: "hiking" },
    });
    expect(isActivity(plain)).toBe(false);
    expect(isActivity(activity)).toBe(true);
    expect(hasSensor(activity, "hr")).toBe(true);
    expect(hasSensor(activity, "power")).toBe(false);
  });
});
