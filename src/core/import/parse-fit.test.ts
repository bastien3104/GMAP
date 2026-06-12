import { describe, expect, it } from "vitest";
import { buildFit } from "../export/fit";
import { createEmptyProject, createTrack, type TrackPoint } from "../model";
import { FitParseError, parseFit } from "./parse-fit";

/** Écrit un mini fichier FIT « activité » (records avec capteurs) pour les tests. */
function buildActivityFit(): Uint8Array {
  const data: number[] = [];
  const u8 = (v: number): void => {
    data.push(v & 0xff);
  };
  const u16 = (v: number): void => {
    u8(v);
    u8(v >>> 8);
  };
  const u32 = (v: number): void => {
    u16(v);
    u16(v >>> 16);
  };
  const s32 = (v: number): void => {
    u32(v >>> 0);
  };
  const semi = (deg: number): number => Math.round((deg * 2 ** 31) / 180) | 0;

  // Définition file_id (local 0) : manufacturer.
  u8(0x40);
  u8(0);
  u8(0); // little-endian
  u16(0);
  u8(1);
  u8(1);
  u8(2);
  u8(0x84); // manufacturer uint16
  // Données file_id : Garmin (1).
  u8(0);
  u16(1);

  // Définition sport (local 1) : sport enum.
  u8(0x41);
  u8(0);
  u8(0);
  u16(12);
  u8(1);
  u8(0);
  u8(1);
  u8(0x00);
  // Données sport : hiking (17).
  u8(1);
  u8(17);

  // Définition record (local 2) : timestamp, lat, lon, altitude, hr, cadence,
  // power, température, vitesse.
  u8(0x42);
  u8(0);
  u8(0);
  u16(20);
  u8(9);
  const fields: Array<[number, number, number]> = [
    [253, 4, 0x86],
    [0, 4, 0x85],
    [1, 4, 0x85],
    [2, 2, 0x84],
    [3, 1, 0x02],
    [4, 1, 0x02],
    [7, 2, 0x84],
    [13, 1, 0x01],
    [6, 2, 0x84],
  ];
  for (const [num, size, base] of fields) {
    u8(num);
    u8(size);
    u8(base);
  }

  const t0 = 1_000_000_000; // secondes FIT
  const record = (
    t: number,
    lat: number,
    lon: number,
    eleM: number,
    hr: number,
    cad: number,
    pw: number,
    temp: number,
    speedMs: number,
  ): void => {
    u8(2);
    u32(t);
    s32(semi(lat));
    s32(semi(lon));
    u16(Math.round((eleM + 500) * 5));
    u8(hr);
    u8(cad);
    u16(pw);
    u8(temp & 0xff); // sint8
    u16(Math.round(speedMs * 1000));
  };
  record(t0, 45.0, 6.0, 1000, 120, 80, 200, 12, 2.5);
  record(t0 + 10, 45.001, 6.001, 1010, 135, 82, 210, 12, 2.8);

  // Record en en-tête compressé (local 2, +5 s) : mêmes champs SANS timestamp ?
  // Non : l'en-tête compressé réutilise la définition → on écrit le champ 253
  // avec la valeur invalide pour s'appuyer sur l'horodatage compressé.
  // Offset = (t0+15) mod 32 : le dernier timestamp est t0+10 (≡ 10 mod 32),
  // donc 15 dans la même fenêtre de 32 s → horodatage = t0 + 15 (+5 s).
  u8(0x80 | (2 << 5) | ((t0 + 15) & 0x1f));
  u32(0xffffffff);
  s32(semi(45.002));
  s32(semi(6.002));
  u16(Math.round((1020 + 500) * 5));
  u8(140);
  u8(84);
  u16(220);
  u8(13);
  u16(3000);

  // En-tête 14 octets + CRC final (CRC non vérifié par le parseur : zéros).
  const header: number[] = [];
  header.push(14, 0x20);
  header.push(2173 & 0xff, 2173 >>> 8);
  header.push(
    data.length & 0xff,
    (data.length >>> 8) & 0xff,
    (data.length >>> 16) & 0xff,
    (data.length >>> 24) & 0xff,
  );
  for (const c of ".FIT") header.push(c.charCodeAt(0));
  header.push(0, 0);
  return Uint8Array.from([...header, ...data, 0, 0]);
}

describe("parseFit", () => {
  it("relit un fichier produit par buildFit (round-trip course)", () => {
    const points: TrackPoint[] = [
      { lat: 45.9, lon: 6.87, ele: 1035, time: "2026-06-01T08:00:00.000Z" },
      { lat: 45.91, lon: 6.88, ele: 1150, time: "2026-06-01T08:10:00.000Z" },
      { lat: 45.92, lon: 6.885, ele: 1300, time: "2026-06-01T08:25:00.000Z" },
    ];
    const project = createEmptyProject("Montée du refuge");
    project.tracks.push(createTrack({ name: "Montée", segments: [points] }));

    const result = parseFit(buildFit(project));

    expect(result.name).toBe("Montée du refuge"); // 16 chars : tient pile dans le champ
    expect(result.points).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      expect(result.points[i]!.lat).toBeCloseTo(points[i]!.lat, 5);
      expect(result.points[i]!.lon).toBeCloseTo(points[i]!.lon, 5);
      expect(result.points[i]!.ele).toBeCloseTo(points[i]!.ele!, 0);
      expect(result.points[i]!.time).toBe(points[i]!.time);
    }
  });

  it("décode capteurs, sport, appareil et en-tête compressé", () => {
    const result = parseFit(buildActivityFit());

    expect(result.activity.sport).toBe("hiking");
    expect(result.activity.device).toBe("Garmin");
    expect(result.points).toHaveLength(3);

    const p0 = result.points[0]!;
    expect(p0.hr).toBe(120);
    expect(p0.cadence).toBe(80);
    expect(p0.power).toBe(200);
    expect(p0.temp).toBe(12);
    expect(p0.speed).toBeCloseTo(2.5, 3);
    expect(p0.ele).toBeCloseTo(1000, 0);

    // Record à en-tête compressé : horodatage = précédent + 5 s.
    const t1 = Date.parse(result.points[1]!.time!);
    const t2 = Date.parse(result.points[2]!.time!);
    expect((t2 - t1) / 1000).toBe(5);
    expect(result.points[2]!.hr).toBe(140);

    // startTime déduit du premier point (pas de session ici).
    expect(result.activity.startTime).toBe(result.points[0]!.time);
  });

  it("préserve les capteurs et le sport au round-trip export → import", () => {
    const points: TrackPoint[] = [
      {
        lat: 45.9,
        lon: 6.87,
        ele: 1035,
        time: "2026-06-01T08:00:00.000Z",
        hr: 120,
        cadence: 80,
        power: 200,
        temp: 12,
        speed: 2.5,
      },
      {
        lat: 45.91,
        lon: 6.88,
        ele: 1150,
        time: "2026-06-01T08:10:00.000Z",
        hr: 145,
        // cadence absente sur ce point : doit ressortir absente, pas 0.
        power: 230,
        temp: 11,
        speed: 3.1,
      },
    ];
    const project = createEmptyProject("Sortie capteurs");
    project.tracks.push(
      createTrack({
        name: "Sortie",
        segments: [points],
        activity: { sport: "hiking" },
      }),
    );

    const result = parseFit(buildFit(project));

    expect(result.activity.sport).toBe("hiking");
    const p0 = result.points[0]!;
    expect(p0.hr).toBe(120);
    expect(p0.cadence).toBe(80);
    expect(p0.power).toBe(200);
    expect(p0.temp).toBe(12);
    expect(p0.speed).toBeCloseTo(2.5, 3);
    const p1 = result.points[1]!;
    expect(p1.hr).toBe(145);
    expect(p1.cadence).toBeUndefined();
    expect(p1.power).toBe(230);
    expect(p1.speed).toBeCloseTo(3.1, 3);
  });

  it("rejette un fichier non FIT avec une erreur claire", () => {
    expect(() => parseFit(new Uint8Array([1, 2, 3]))).toThrow(FitParseError);
    const garbage = new Uint8Array(64).fill(0xab);
    expect(() => parseFit(garbage)).toThrow(FitParseError);
  });

  it("tolère un fichier tronqué en conservant les points décodés", () => {
    const full = buildActivityFit();
    // Coupe au milieu du dernier record (en-tête compressé) : les 2 premiers
    // points doivent survivre.
    const truncated = full.slice(0, full.length - 10);
    const result = parseFit(truncated);
    expect(result.points.length).toBeGreaterThanOrEqual(2);
    expect(result.points[0]!.hr).toBe(120);
  });

  it("rejette un FIT valide sans aucun point géolocalisé", () => {
    const project = createEmptyProject("Vide");
    expect(() => parseFit(buildFit(project))).toThrow(FitParseError);
  });
});
