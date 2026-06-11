import {
  createEmptyProject,
  createTrack,
  type ActivityMeta,
  type ActivitySport,
  type Project,
  type TrackPoint,
} from "../model";

/**
 * Décodeur FIT (Garmin) pur et tolérant : extrait les points (position, altitude,
 * temps, capteurs FC/cadence/puissance/température/vitesse) et les métadonnées
 * d'activité (sport, début, appareil) des messages `record`, `session`, `sport`,
 * `file_id` et `course`.
 *
 * Tolérance : un fichier corrompu en cours de lecture conserve les points déjà
 * décodés ; seul un fichier illisible (en-tête invalide ou aucun point) lève
 * `FitParseError`. Jamais de crash sur entrée malformée.
 *
 * Références : FIT Protocol — en-tête 12/14 octets, messages de définition
 * (architecture LE/BE, champs développeur ignorés), messages de données,
 * en-têtes à horodatage compressé. Coordonnées en semicercles, altitude
 * (val/5)−500, vitesse en mm/s, temps en secondes depuis 1989-12-31.
 */

const FIT_EPOCH = 631065600; // secondes entre 1970-01-01 et 1989-12-31 (UTC)
const SEMICIRCLE_TO_DEG = 180 / 2 ** 31;

/** Erreur d'import FIT (fichier illisible), avec message utilisateur clair. */
export class FitParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FitParseError";
  }
}

/** Résultat d'un import FIT. */
export interface FitParseResult {
  /** Nom trouvé dans le fichier (course), ou `null` si absent. */
  name: string | null;
  /** Points décodés (ordre du fichier), positions valides uniquement. */
  points: TrackPoint[];
  /** Métadonnées d'activité. */
  activity: ActivityMeta;
}

/** Sport FIT (enum) → clé de sport du modèle. */
const SPORT_BY_ENUM: Record<number, ActivitySport> = {
  0: "generic",
  1: "running",
  2: "cycling",
  5: "swimming",
  11: "walking",
  12: "xc-skiing",
  15: "rowing",
  16: "mountaineering",
  17: "hiking",
  19: "paddling",
  41: "kayaking",
};

/** Fabricants FIT (enum) usuels → nom affiché. */
const MANUFACTURER_BY_ENUM: Record<number, string> = {
  1: "Garmin",
  7: "Polar",
  23: "Suunto",
  32: "Wahoo",
  260: "Zwift",
  265: "Strava",
  294: "Coros",
};

/** Définition d'un champ d'un message de définition. */
interface FieldDef {
  num: number;
  size: number;
  baseType: number;
}

/** Définition locale (un slot 0-15) : message global + champs + endianness. */
interface MessageDef {
  globalNum: number;
  littleEndian: boolean;
  fields: FieldDef[];
  /** Taille cumulée des champs développeur (à sauter). */
  devBytes: number;
}

/** Lit la valeur scalaire d'un champ ; `null` si invalide/inexploitable. */
function readField(
  view: DataView,
  offset: number,
  field: FieldDef,
  littleEndian: boolean,
): number | null {
  const base = field.baseType & 0x1f;
  switch (base) {
    case 0x00: // enum
    case 0x02: {
      const v = view.getUint8(offset);
      return v === 0xff ? null : v;
    }
    case 0x0a: {
      const v = view.getUint8(offset); // uint8z
      return v === 0 ? null : v;
    }
    case 0x01: {
      const v = view.getInt8(offset);
      return v === 0x7f ? null : v;
    }
    case 0x03: {
      const v = view.getInt16(offset, littleEndian);
      return v === 0x7fff ? null : v;
    }
    case 0x04: {
      const v = view.getUint16(offset, littleEndian);
      return v === 0xffff ? null : v;
    }
    case 0x0b: {
      const v = view.getUint16(offset, littleEndian); // uint16z
      return v === 0 ? null : v;
    }
    case 0x05: {
      const v = view.getInt32(offset, littleEndian);
      return v === 0x7fffffff ? null : v;
    }
    case 0x06: {
      const v = view.getUint32(offset, littleEndian);
      return v === 0xffffffff ? null : v;
    }
    case 0x0c: {
      const v = view.getUint32(offset, littleEndian); // uint32z
      return v === 0 ? null : v;
    }
    case 0x08: {
      const v = view.getFloat32(offset, littleEndian);
      return Number.isFinite(v) ? v : null;
    }
    case 0x09: {
      const v = view.getFloat64(offset, littleEndian);
      return Number.isFinite(v) ? v : null;
    }
    default:
      return null; // string, byte array, 64 bits : inexploités ici
  }
}

/** Lit une chaîne (terminée par NUL) d'un champ string. */
function readString(view: DataView, offset: number, size: number): string {
  let out = "";
  for (let i = 0; i < size; i++) {
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    out += String.fromCharCode(c);
  }
  return out.trim();
}

function fitTimeToIso(fitSeconds: number): string {
  return new Date((fitSeconds + FIT_EPOCH) * 1000).toISOString();
}

/** Accumulateur du record courant (un message `record`). */
interface RecordAccumulator {
  lat: number | null;
  lon: number | null;
  ele: number | null;
  time: number | null;
  hr: number | null;
  cadence: number | null;
  power: number | null;
  temp: number | null;
  speed: number | null;
}

/**
 * Décode un fichier FIT. Lève `FitParseError` si l'en-tête est invalide ou si
 * aucun point exploitable n'est trouvé.
 */
export function parseFit(bytes: Uint8Array): FitParseResult {
  if (bytes.length < 14) {
    throw new FitParseError("Fichier FIT tronqué (en-tête incomplet).");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerSize = view.getUint8(0);
  if (headerSize !== 12 && headerSize !== 14) {
    throw new FitParseError("En-tête FIT invalide (taille inattendue).");
  }
  const signature = String.fromCharCode(
    view.getUint8(8),
    view.getUint8(9),
    view.getUint8(10),
    view.getUint8(11),
  );
  if (signature !== ".FIT") {
    throw new FitParseError("Ce fichier n'est pas un fichier FIT (signature absente).");
  }
  const dataSize = view.getUint32(4, true);
  const end = Math.min(headerSize + dataSize, bytes.length);

  const definitions = new Map<number, MessageDef>();
  const points: TrackPoint[] = [];
  let name: string | null = null;
  let sport: ActivitySport = "generic";
  let startTime: string | undefined;
  let device: string | undefined;
  let lastTimestamp: number | null = null;

  let offset = headerSize;
  try {
    while (offset < end) {
      const header = view.getUint8(offset);
      offset += 1;

      // --- En-tête à horodatage compressé (bit 7) : message de données. ---
      let localType: number;
      let compressedTime: number | null = null;
      if ((header & 0x80) !== 0) {
        localType = (header >> 5) & 0x03;
        const timeOffset = header & 0x1f;
        if (lastTimestamp !== null) {
          const last5 = lastTimestamp & 0x1f;
          compressedTime =
            (lastTimestamp & ~0x1f) + timeOffset + (timeOffset < last5 ? 0x20 : 0);
        }
      } else if ((header & 0x40) !== 0) {
        // --- Message de définition (bit 6), champs développeur si bit 5. ---
        localType = header & 0x0f;
        const hasDev = (header & 0x20) !== 0;
        offset += 1; // réservé
        const littleEndian = view.getUint8(offset) === 0;
        offset += 1;
        const globalNum = littleEndian
          ? view.getUint16(offset, true)
          : view.getUint16(offset, false);
        offset += 2;
        const numFields = view.getUint8(offset);
        offset += 1;
        const fields: FieldDef[] = [];
        for (let i = 0; i < numFields; i++) {
          fields.push({
            num: view.getUint8(offset),
            size: view.getUint8(offset + 1),
            baseType: view.getUint8(offset + 2),
          });
          offset += 3;
        }
        let devBytes = 0;
        if (hasDev) {
          const numDev = view.getUint8(offset);
          offset += 1;
          for (let i = 0; i < numDev; i++) {
            devBytes += view.getUint8(offset + 1);
            offset += 3;
          }
        }
        definitions.set(localType, { globalNum, littleEndian, fields, devBytes });
        continue;
      } else {
        localType = header & 0x0f;
      }

      // --- Message de données. ---
      const def = definitions.get(localType);
      if (def === undefined) {
        throw new FitParseError("Message FIT sans définition (fichier corrompu).");
      }

      const rec: RecordAccumulator = {
        lat: null,
        lon: null,
        ele: null,
        time: compressedTime,
        hr: null,
        cadence: null,
        power: null,
        temp: null,
        speed: null,
      };
      let courseName: string | null = null;
      let manufacturer: number | null = null;
      let sportEnum: number | null = null;
      let sessionStart: number | null = null;

      for (const field of def.fields) {
        const value = readField(view, offset, field, def.littleEndian);
        if (def.globalNum === 20) {
          // record
          if (field.num === 253 && value !== null) rec.time = value;
          else if (field.num === 0) rec.lat = value;
          else if (field.num === 1) rec.lon = value;
          else if (field.num === 2 && value !== null) rec.ele = value / 5 - 500;
          else if (field.num === 78 && value !== null) rec.ele = value / 5 - 500;
          else if (field.num === 3) rec.hr = value;
          else if (field.num === 4) rec.cadence = value;
          else if (field.num === 7) rec.power = value;
          else if (field.num === 13) rec.temp = value;
          else if (field.num === 6 && value !== null) rec.speed = value / 1000;
          else if (field.num === 73 && value !== null) rec.speed = value / 1000;
        } else if (def.globalNum === 0) {
          // file_id
          if (field.num === 1) manufacturer = value;
        } else if (def.globalNum === 18) {
          // session
          if (field.num === 5) sportEnum = value;
          else if (field.num === 2) sessionStart = value;
          else if (field.num === 253 && value !== null) lastTimestamp = value;
        } else if (def.globalNum === 12) {
          // sport
          if (field.num === 0) sportEnum = value;
        } else if (def.globalNum === 31) {
          // course
          if (field.num === 5 && (field.baseType & 0x1f) === 0x07) {
            courseName = readString(view, offset, field.size);
          }
        } else if (field.num === 253 && value !== null) {
          lastTimestamp = value; // suit l'horloge pour les en-têtes compressés
        }
        offset += field.size;
      }
      offset += def.devBytes;

      if (courseName !== null && courseName !== "") name = courseName;
      if (manufacturer !== null) {
        device = MANUFACTURER_BY_ENUM[manufacturer] ?? `Appareil #${manufacturer}`;
      }
      if (sportEnum !== null) sport = SPORT_BY_ENUM[sportEnum] ?? "generic";
      if (sessionStart !== null) startTime = fitTimeToIso(sessionStart);

      if (def.globalNum === 20) {
        if (rec.time !== null) lastTimestamp = rec.time;
        if (rec.lat !== null && rec.lon !== null) {
          const point: TrackPoint = {
            lat: rec.lat * SEMICIRCLE_TO_DEG,
            lon: rec.lon * SEMICIRCLE_TO_DEG,
          };
          if (rec.ele !== null) point.ele = rec.ele;
          if (rec.time !== null) point.time = fitTimeToIso(rec.time);
          if (rec.hr !== null) point.hr = rec.hr;
          if (rec.cadence !== null) point.cadence = rec.cadence;
          if (rec.power !== null) point.power = rec.power;
          if (rec.temp !== null) point.temp = rec.temp;
          if (rec.speed !== null) point.speed = rec.speed;
          points.push(point);
        }
      }
    }
  } catch (cause) {
    // Tolérance : si on a déjà des points, on garde ce qui a été décodé.
    if (points.length === 0) {
      throw cause instanceof FitParseError
        ? cause
        : new FitParseError("Fichier FIT corrompu ou incomplet.");
    }
  }

  if (points.length === 0) {
    throw new FitParseError("Aucun point géolocalisé dans ce fichier FIT.");
  }

  if (startTime === undefined && points[0]!.time !== undefined) {
    startTime = points[0]!.time;
  }

  const activity: ActivityMeta = { sport };
  if (startTime !== undefined) activity.startTime = startTime;
  if (device !== undefined) activity.device = device;

  return { name, points, activity };
}

/**
 * Décode un FIT et le projette en `Project` à une trace (même contrat que
 * `parseGpx`). `fallbackName` est utilisé si le fichier ne porte pas de nom
 * (typiquement le nom du fichier sans extension).
 */
export function parseFitProject(bytes: Uint8Array, fallbackName: string): Project {
  const result = parseFit(bytes);
  const name = result.name ?? fallbackName;
  const project = createEmptyProject(name);
  project.tracks.push(
    createTrack({
      name,
      segments: [result.points],
      activity: result.activity,
    }),
  );
  return project;
}
