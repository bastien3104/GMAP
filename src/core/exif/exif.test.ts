import { describe, it, expect } from "vitest";
import { parseExifGps } from "./exif";

/**
 * Construit un JPEG minimal porteur d'un bloc EXIF little-endian avec position GPS
 * (45°30′N, 6°0′E → 45.5, 6.0) et DateTimeOriginal « 2026:06:11 09:30:00 ».
 */
function buildExifJpeg(): Uint8Array {
  const tiff = new Uint8Array(178);
  const dv = new DataView(tiff.buffer);
  const LE = true;

  const setEntry = (
    off: number,
    tag: number,
    type: number,
    count: number,
    value: number,
  ): void => {
    dv.setUint16(off, tag, LE);
    dv.setUint16(off + 2, type, LE);
    dv.setUint32(off + 4, count, LE);
    dv.setUint32(off + 8, value, LE);
  };
  const setRational = (off: number, num: number, den: number): void => {
    dv.setUint32(off, num, LE);
    dv.setUint32(off + 4, den, LE);
  };

  // En-tête TIFF
  dv.setUint16(0, 0x4949, LE); // "II"
  dv.setUint16(2, 42, LE);
  dv.setUint32(4, 8, LE); // IFD0 à l'offset 8

  // IFD0 (2 entrées)
  dv.setUint16(8, 2, LE);
  setEntry(10, 0x8825, 4, 1, 38); // GPSInfo → IFD GPS à 38
  setEntry(22, 0x8769, 4, 1, 140); // ExifIFD → sous-IFD Exif à 140
  dv.setUint32(34, 0, LE); // next IFD = 0

  // IFD GPS (4 entrées) à 38
  dv.setUint16(38, 4, LE);
  // GPSLatitudeRef "N" (ASCII inline)
  dv.setUint16(40, 1, LE);
  dv.setUint16(42, 2, LE);
  dv.setUint32(44, 2, LE);
  tiff[48] = 0x4e; // 'N'
  // GPSLatitude (3 rationals) → offset 92
  setEntry(52, 2, 5, 3, 92);
  // GPSLongitudeRef "E"
  dv.setUint16(64, 3, LE);
  dv.setUint16(66, 2, LE);
  dv.setUint32(68, 2, LE);
  tiff[72] = 0x45; // 'E'
  // GPSLongitude (3 rationals) → offset 116
  setEntry(76, 4, 5, 3, 116);
  dv.setUint32(88, 0, LE); // next IFD = 0

  // Rationals latitude (45/1, 30/1, 0/1) à 92
  setRational(92, 45, 1);
  setRational(100, 30, 1);
  setRational(108, 0, 1);
  // Rationals longitude (6/1, 0/1, 0/1) à 116
  setRational(116, 6, 1);
  setRational(124, 0, 1);
  setRational(132, 0, 1);

  // Sous-IFD Exif (1 entrée) à 140
  dv.setUint16(140, 1, LE);
  setEntry(142, 0x9003, 2, 20, 158); // DateTimeOriginal → chaîne à 158
  dv.setUint32(154, 0, LE); // next IFD = 0

  // Chaîne "2026:06:11 09:30:00\0" à 158
  const date = "2026:06:11 09:30:00\0";
  for (let i = 0; i < date.length; i += 1) tiff[158 + i] = date.charCodeAt(i);

  // Enveloppe JPEG : SOI + APP1("Exif\0\0" + TIFF) + EOI
  const header = new Uint8Array(12); // FFD8 FFE1 len(2) "Exif\0\0"(6)
  const hv = new DataView(header.buffer);
  hv.setUint16(0, 0xffd8); // SOI
  hv.setUint16(2, 0xffe1); // APP1
  hv.setUint16(4, 2 + 6 + tiff.length); // longueur de segment (big-endian)
  header.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00], 6); // "Exif\0\0"

  const eoi = new Uint8Array([0xff, 0xd9]);
  const out = new Uint8Array(header.length + tiff.length + eoi.length);
  out.set(header, 0);
  out.set(tiff, header.length);
  out.set(eoi, header.length + tiff.length);
  return out;
}

describe("parseExifGps", () => {
  it("extrait latitude/longitude/date d'un JPEG EXIF", () => {
    const data = parseExifGps(buildExifJpeg());
    expect(data.lat).toBeCloseTo(45.5, 6);
    expect(data.lon).toBeCloseTo(6.0, 6);
    expect(data.time).toBe("2026-06-11T09:30:00");
  });

  it("renvoie un objet vide pour un fichier non-JPEG", () => {
    expect(parseExifGps(new Uint8Array([1, 2, 3, 4]))).toEqual({});
  });

  it("ne lève pas d'exception sur un JPEG sans EXIF", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    expect(parseExifGps(jpeg)).toEqual({});
  });
});
