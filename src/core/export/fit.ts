import { haversine } from "../geo/stats";
import {
  iterateTrackPoints,
  type ActivitySport,
  type Project,
  type TrackPoint,
} from "../model";

/**
 * Export FIT (Garmin) d'un projet en fichier « course » : file_id + course + lap +
 * messages record. Encodeur binaire pur et testé (structure + CRC).
 *
 * Références : FIT Protocol — en-tête 14 octets, messages de définition/données,
 * CRC-16 FIT. Coordonnées en semicercles, altitude en (m+500)×5, temps en secondes
 * depuis l'époque FIT (1989-12-31).
 */

const FIT_EPOCH = 631065600; // secondes entre 1970-01-01 et 1989-12-31 (UTC)

// Types de base FIT (octet de type).
const ENUM = 0x00;
const SINT8 = 0x01;
const UINT8 = 0x02;
const UINT16 = 0x84;
const UINT32 = 0x86;
const UINT32Z = 0x8c;
const SINT32 = 0x85;
const STRING = 0x07;

/** Sport du modèle → enum FIT (inverse de la table d'import). */
const SPORT_ENUM_BY_KEY: Record<ActivitySport, number> = {
  generic: 0,
  running: 1,
  cycling: 2,
  swimming: 5,
  walking: 11,
  "xc-skiing": 12,
  rowing: 15,
  mountaineering: 16,
  hiking: 17,
  paddling: 19,
  kayaking: 41,
};

const COURSE_NAME_LEN = 16;

class ByteWriter {
  readonly bytes: number[] = [];
  u8(v: number): void {
    this.bytes.push(v & 0xff);
  }
  u16(v: number): void {
    this.u8(v);
    this.u8(v >>> 8);
  }
  u32(v: number): void {
    this.u8(v);
    this.u8(v >>> 8);
    this.u8(v >>> 16);
    this.u8(v >>> 24);
  }
  str(s: string, len: number): void {
    for (let i = 0; i < len; i++) this.u8(i < s.length ? s.charCodeAt(i) & 0xff : 0);
  }
}

function semicircles(deg: number): number {
  return Math.round((deg * 2 ** 31) / 180) | 0;
}

function fitTime(iso: string | undefined, fallback: number): number {
  if (iso === undefined) return fallback >>> 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? fallback >>> 0 : (Math.floor(t / 1000) - FIT_EPOCH) >>> 0;
}

function fitAltitude(m: number): number {
  const v = Math.round((m + 500) * 5);
  return Math.min(65535, Math.max(0, v));
}

/** Écrit un message de définition. */
function definition(
  w: ByteWriter,
  localType: number,
  globalNum: number,
  fields: Array<[number, number, number]>,
): void {
  w.u8(0x40 | localType);
  w.u8(0); // réservé
  w.u8(0); // architecture little-endian
  w.u16(globalNum);
  w.u8(fields.length);
  for (const [num, size, base] of fields) {
    w.u8(num);
    w.u8(size);
    w.u8(base);
  }
}

/** CRC-16 FIT (nibble par nibble). */
function crc16(bytes: number[]): number {
  const table = [
    0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001, 0x6c00,
    0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400,
  ];
  let crc = 0;
  for (const byte of bytes) {
    let tmp = table[crc & 0xf]!;
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ table[byte & 0xf]!;
    tmp = table[crc & 0xf]!;
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ table[(byte >> 4) & 0xf]!;
  }
  return crc & 0xffff;
}

/** Construit un fichier FIT (course) pour un projet. Renvoie les octets. */
export function buildFit(project: Project): Uint8Array {
  const points: TrackPoint[] = [];
  for (const track of project.tracks) {
    for (const p of iterateTrackPoints(track)) points.push(p);
  }

  const data = new ByteWriter();
  const nowFit = (Math.floor(Date.now() / 1000) - FIT_EPOCH) >>> 0;

  // --- file_id (global 0) ---
  definition(data, 0, 0, [
    [0, 1, ENUM], // type
    [1, 2, UINT16], // manufacturer
    [2, 2, UINT16], // product
    [4, 4, UINT32], // time_created
    [3, 4, UINT32Z], // serial_number
  ]);
  data.u8(0); // header data, local 0
  data.u8(6); // type = course
  data.u16(255); // manufacturer = development
  data.u16(0); // product
  data.u32(nowFit); // time_created
  data.u32(0); // serial_number

  // --- course (global 31) : name ---
  definition(data, 1, 31, [[5, COURSE_NAME_LEN, STRING]]);
  data.u8(1);
  data.str(project.name, COURSE_NAME_LEN);

  // --- sport (global 12), si au moins une trace est une activité ---
  const sport = project.tracks.find((t) => t.activity !== undefined)?.activity?.sport;
  if (sport !== undefined) {
    definition(data, 4, 12, [[0, 1, ENUM]]);
    data.u8(4);
    data.u8(SPORT_ENUM_BY_KEY[sport]);
  }

  if (points.length > 0) {
    const startTime = points[0]!.time !== undefined ? fitTime(points[0]!.time, nowFit) : nowFit;
    let cumulative = 0;
    const recordTimes: number[] = [];
    const distances: number[] = [];
    for (let i = 0; i < points.length; i++) {
      if (i > 0) cumulative += haversine(points[i - 1]!, points[i]!);
      distances.push(cumulative);
      recordTimes.push(fitTime(points[i]!.time, startTime + i));
    }
    const endTime = recordTimes[recordTimes.length - 1]!;
    const first = points[0]!;
    const last = points[points.length - 1]!;

    // --- lap (global 19) ---
    definition(data, 2, 19, [
      [253, 4, UINT32], // timestamp
      [2, 4, UINT32], // start_time
      [3, 4, SINT32], // start_position_lat
      [4, 4, SINT32], // start_position_long
      [5, 4, SINT32], // end_position_lat
      [6, 4, SINT32], // end_position_long
      [7, 4, UINT32], // total_elapsed_time (×1000)
      [9, 4, UINT32], // total_distance (×100)
    ]);
    data.u8(2);
    data.u32(endTime);
    data.u32(startTime);
    data.u32(semicircles(first.lat) >>> 0);
    data.u32(semicircles(first.lon) >>> 0);
    data.u32(semicircles(last.lat) >>> 0);
    data.u32(semicircles(last.lon) >>> 0);
    data.u32(Math.round((endTime - startTime) * 1000));
    data.u32(Math.round(cumulative * 100));

    // --- record (global 20) : champs capteurs inclus s'ils existent quelque
    // part dans le projet (valeur « invalide » FIT sur les points qui en
    // manquent) — l'export préserve ainsi FC, cadence, puissance, etc. ---
    const hasHr = points.some((p) => p.hr !== undefined);
    const hasCadence = points.some((p) => p.cadence !== undefined);
    const hasPower = points.some((p) => p.power !== undefined);
    const hasTemp = points.some((p) => p.temp !== undefined);
    const hasSpeed = points.some((p) => p.speed !== undefined);

    const recordFields: Array<[number, number, number]> = [
      [253, 4, UINT32], // timestamp
      [0, 4, SINT32], // position_lat
      [1, 4, SINT32], // position_long
      [5, 4, UINT32], // distance (×100)
      [2, 2, UINT16], // altitude
    ];
    if (hasHr) recordFields.push([3, 1, UINT8]); // heart_rate (bpm)
    if (hasCadence) recordFields.push([4, 1, UINT8]); // cadence (rpm/spm)
    if (hasPower) recordFields.push([7, 2, UINT16]); // power (W)
    if (hasTemp) recordFields.push([13, 1, SINT8]); // temperature (°C)
    if (hasSpeed) recordFields.push([6, 2, UINT16]); // speed (×1000, m/s)

    definition(data, 3, 20, recordFields);
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      data.u8(3);
      data.u32(recordTimes[i]!);
      data.u32(semicircles(p.lat) >>> 0);
      data.u32(semicircles(p.lon) >>> 0);
      data.u32(Math.round(distances[i]! * 100));
      data.u16(p.ele !== undefined ? fitAltitude(p.ele) : 0xffff);
      if (hasHr) data.u8(p.hr !== undefined ? Math.round(p.hr) : 0xff);
      if (hasCadence) data.u8(p.cadence !== undefined ? Math.round(p.cadence) : 0xff);
      if (hasPower) data.u16(p.power !== undefined ? Math.round(p.power) : 0xffff);
      if (hasTemp) data.u8(p.temp !== undefined ? Math.round(p.temp) & 0xff : 0x7f);
      if (hasSpeed) {
        data.u16(
          p.speed !== undefined
            ? Math.min(0xfffe, Math.max(0, Math.round(p.speed * 1000)))
            : 0xffff,
        );
      }
    }
  }

  // --- En-tête (14 octets) ---
  const header = new ByteWriter();
  header.u8(14); // taille en-tête
  header.u8(0x20); // version protocole
  header.u16(2173); // version profil
  header.u32(data.bytes.length); // taille des données
  header.str(".FIT", 4);
  header.u16(crc16(header.bytes)); // CRC de l'en-tête

  const all = [...header.bytes, ...data.bytes];
  const fileCrc = crc16(all);
  all.push(fileCrc & 0xff, (fileCrc >>> 8) & 0xff);
  return Uint8Array.from(all);
}
