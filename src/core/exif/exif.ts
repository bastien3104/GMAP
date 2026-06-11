/**
 * Lecture EXIF minimale et **pure** (zéro dépendance) : position GPS + horodatage
 * d'une photo JPEG. On extrait juste ce dont l'app a besoin (latitude, longitude,
 * altitude, date de prise de vue) ; tout fichier non conforme renvoie un résultat
 * partiel ou vide, jamais d'exception.
 *
 * Chaîne : JPEG (segments APPn) → segment APP1 « Exif » → en-tête TIFF → IFD0 →
 * sous-IFD GPS (pointeur 0x8825) et sous-IFD Exif (pointeur 0x8769, DateTimeOriginal).
 */

/** Données extraites d'une photo (toutes optionnelles). */
export interface ExifData {
  /** Latitude WGS84 (degrés décimaux). */
  lat?: number;
  /** Longitude WGS84 (degrés décimaux). */
  lon?: number;
  /** Altitude (m), si présente. */
  ele?: number;
  /** Date de prise de vue, ISO 8601 sans fuseau (`YYYY-MM-DDThh:mm:ss`). */
  time?: string;
}

/** Taille en octets des types TIFF (index = type). */
const TYPE_SIZE: Readonly<Record<number, number>> = {
  1: 1, // BYTE
  2: 1, // ASCII
  3: 2, // SHORT
  4: 4, // LONG
  5: 8, // RATIONAL
  7: 1, // UNDEFINED
  9: 4, // SLONG
  10: 8, // SRATIONAL
};

interface Entry {
  type: number;
  count: number;
  /** Offset absolu (dans le DataView) où commencent les octets de valeur. */
  valOff: number;
}

interface Ctx {
  view: DataView;
  /** Offset absolu du début de l'en-tête TIFF (origine des offsets internes). */
  tiff: number;
  little: boolean;
}

/** Localise le début du bloc TIFF dans le segment APP1 « Exif », ou `null`. */
function findTiffStart(view: DataView): number | null {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null; // pas un JPEG
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = view.getUint8(offset + 1);
    // SOS (début image) ou EOI : plus de métadonnées au-delà.
    if (marker === 0xda || marker === 0xd9) break;
    // Marqueurs sans charge utile (padding 0xff, RSTn, SOI…).
    if (marker === 0xff || (marker >= 0xd0 && marker <= 0xd8) || marker === 0x01) {
      offset += 2;
      continue;
    }
    if (offset + 4 > view.byteLength) break;
    const size = view.getUint16(offset + 2); // longueur de segment : big-endian
    if (marker === 0xe1) {
      const sig = offset + 4;
      // "Exif\0\0"
      if (
        sig + 6 <= view.byteLength &&
        view.getUint32(sig) === 0x45786966 &&
        view.getUint16(sig + 4) === 0x0000
      ) {
        return sig + 6;
      }
    }
    offset += 2 + size;
  }
  return null;
}

function u16(c: Ctx, off: number): number {
  return c.view.getUint16(off, c.little);
}
function u32(c: Ctx, off: number): number {
  return c.view.getUint32(off, c.little);
}

/** Lit les entrées d'un IFD situé à `ifdRel` (relatif à l'origine TIFF). */
function readIfd(c: Ctx, ifdRel: number): Map<number, Entry> {
  const map = new Map<number, Entry>();
  const base = c.tiff + ifdRel;
  if (base + 2 > c.view.byteLength) return map;
  const count = u16(c, base);
  for (let i = 0; i < count; i += 1) {
    const e = base + 2 + i * 12;
    if (e + 12 > c.view.byteLength) break;
    const tag = u16(c, e);
    const type = u16(c, e + 2);
    const cnt = u32(c, e + 4);
    const size = (TYPE_SIZE[type] ?? 1) * cnt;
    const valOff = size <= 4 ? e + 8 : c.tiff + u32(c, e + 8);
    map.set(tag, { type, count: cnt, valOff });
  }
  return map;
}

function readAscii(c: Ctx, entry: Entry): string {
  let s = "";
  for (let i = 0; i < entry.count; i += 1) {
    const ch = c.view.getUint8(entry.valOff + i);
    if (ch === 0) break;
    s += String.fromCharCode(ch);
  }
  return s;
}

/** Lit le `idx`-ième rationnel (num/den) à partir d'un offset. */
function readRational(c: Ctx, valOff: number, idx: number): number {
  const num = u32(c, valOff + idx * 8);
  const den = u32(c, valOff + idx * 8 + 4);
  return den === 0 ? 0 : num / den;
}

/** Convertit 3 rationnels (deg, min, sec) + référence en degrés décimaux signés. */
function dms(c: Ctx, entry: Entry, ref: string): number {
  const deg = readRational(c, entry.valOff, 0);
  const min = readRational(c, entry.valOff, 1);
  const sec = readRational(c, entry.valOff, 2);
  const value = deg + min / 60 + sec / 3600;
  return ref === "S" || ref === "W" ? -value : value;
}

/** Extrait position GPS + horodatage d'une photo JPEG (résultat partiel toléré). */
export function parseExifGps(bytes: Uint8Array): ExifData {
  const result: ExifData = {};
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tiff = findTiffStart(view);
    if (tiff === null) return result;
    const order = view.getUint16(tiff);
    if (order !== 0x4949 && order !== 0x4d4d) return result;
    const c: Ctx = { view, tiff, little: order === 0x4949 };

    const ifd0 = readIfd(c, u32(c, tiff + 4));

    // --- GPS ---
    const gpsPtr = ifd0.get(0x8825);
    if (gpsPtr !== undefined) {
      const gps = readIfd(c, u32(c, gpsPtr.valOff));
      const lat = gps.get(2);
      const lon = gps.get(4);
      if (lat !== undefined && lon !== undefined) {
        const latRef = gps.has(1) ? readAscii(c, gps.get(1)!) : "N";
        const lonRef = gps.has(3) ? readAscii(c, gps.get(3)!) : "E";
        const latVal = dms(c, lat, latRef);
        const lonVal = dms(c, lon, lonRef);
        if (Math.abs(latVal) <= 90 && Math.abs(lonVal) <= 180) {
          result.lat = latVal;
          result.lon = lonVal;
        }
      }
      const alt = gps.get(6);
      if (alt !== undefined) {
        let a = readRational(c, alt.valOff, 0);
        const altRef = gps.get(5);
        if (altRef !== undefined && view.getUint8(altRef.valOff) === 1) a = -a;
        if (Number.isFinite(a)) result.ele = Math.round(a * 10) / 10;
      }
    }

    // --- Date de prise de vue (sous-IFD Exif) ---
    const exifPtr = ifd0.get(0x8769);
    if (exifPtr !== undefined) {
      const sub = readIfd(c, u32(c, exifPtr.valOff));
      const dto = sub.get(0x9003) ?? sub.get(0x9004); // DateTimeOriginal / Digitized
      if (dto !== undefined) {
        const raw = readAscii(c, dto).trim(); // "YYYY:MM:DD hh:mm:ss"
        const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(raw);
        if (m !== null) {
          result.time = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
        }
      }
    }
  } catch {
    // Fichier malformé : on renvoie ce qui a pu être lu.
  }
  return result;
}
