import { haversine } from "./stats";
import type { Track, TrackPoint } from "../model";

/**
 * Statistiques d'activité (temps, vitesses, capteurs), pures et testées.
 * Complète `trackStats` (géométrie) pour les traces horodatées/instrumentées
 * (imports FIT). Toutes les valeurs sont `null` quand la donnée est absente.
 */

/** Vitesse (m/s) en dessous de laquelle on considère être à l'arrêt. */
export const MOVING_SPEED_THRESHOLD_MS = 0.5;

/** Statistiques d'activité d'une trace. */
export interface ActivityStats {
  /** Temps total écoulé (s), premier → dernier point horodaté. */
  totalTime: number | null;
  /** Temps en mouvement (s) : arêtes parcourues au-dessus du seuil de vitesse. */
  movingTime: number | null;
  /** Vitesse moyenne en mouvement (m/s). */
  avgSpeed: number | null;
  /** Vitesse maximale (m/s) — capteur si présent, sinon calculée par arête. */
  maxSpeed: number | null;
  /** Vitesse ascensionnelle moyenne en montée (m/h). */
  vam: number | null;
  /** Fréquence cardiaque moyenne (bpm). */
  hrAvg: number | null;
  /** Fréquence cardiaque maximale (bpm). */
  hrMax: number | null;
  /** Cadence moyenne (points en mouvement, rpm/spm). */
  cadenceAvg: number | null;
  /** Cadence maximale. */
  cadenceMax: number | null;
  /** Puissance moyenne (W). */
  powerAvg: number | null;
  /** Puissance maximale (W). */
  powerMax: number | null;
  /** Température moyenne (°C). */
  tempAvg: number | null;
}

/** Vrai si la trace porte des métadonnées d'activité (import FIT). */
export function isActivity(track: Track): boolean {
  return track.activity !== undefined;
}

/** Vrai si au moins un point de la trace porte le champ capteur donné. */
export function hasSensor(
  track: Track,
  field: "hr" | "cadence" | "power" | "temp" | "speed",
): boolean {
  return track.segments.some((seg) => seg.some((p) => p[field] !== undefined));
}

function parseTime(p: TrackPoint): number | null {
  if (p.time === undefined) return null;
  const t = Date.parse(p.time);
  return Number.isNaN(t) ? null : t / 1000;
}

/**
 * Calcule les statistiques d'activité d'une trace.
 * @param movingThreshold vitesse (m/s) sous laquelle une arête compte comme pause.
 */
export function activityStats(
  track: Track,
  movingThreshold = MOVING_SPEED_THRESHOLD_MS,
): ActivityStats {
  let firstTime: number | null = null;
  let lastTime: number | null = null;
  let movingTime = 0;
  let movingDistance = 0;
  let hasMoving = false;
  let maxSpeed: number | null = null;
  let climbTime = 0;
  let climbGain = 0;

  let hrSum = 0;
  let hrCount = 0;
  let hrMax: number | null = null;
  let cadSum = 0;
  let cadCount = 0;
  let cadMax: number | null = null;
  let pwSum = 0;
  let pwCount = 0;
  let pwMax: number | null = null;
  let tempSum = 0;
  let tempCount = 0;

  for (const segment of track.segments) {
    for (let i = 0; i < segment.length; i++) {
      const p = segment[i]!;
      const t = parseTime(p);
      if (t !== null) {
        if (firstTime === null) firstTime = t;
        lastTime = t;
      }

      if (p.hr !== undefined) {
        hrSum += p.hr;
        hrCount += 1;
        hrMax = hrMax === null ? p.hr : Math.max(hrMax, p.hr);
      }
      if (p.cadence !== undefined && p.cadence > 0) {
        cadSum += p.cadence;
        cadCount += 1;
        cadMax = cadMax === null ? p.cadence : Math.max(cadMax, p.cadence);
      }
      if (p.power !== undefined) {
        pwSum += p.power;
        pwCount += 1;
        pwMax = pwMax === null ? p.power : Math.max(pwMax, p.power);
      }
      if (p.temp !== undefined) {
        tempSum += p.temp;
        tempCount += 1;
      }
      if (p.speed !== undefined) {
        maxSpeed = maxSpeed === null ? p.speed : Math.max(maxSpeed, p.speed);
      }

      if (i === 0) continue;
      const prev = segment[i - 1]!;
      const tPrev = parseTime(prev);
      if (t === null || tPrev === null) continue;
      const dt = t - tPrev;
      if (dt <= 0) continue;
      const d = haversine(prev, p);
      const speed = d / dt;
      if (p.speed === undefined && (maxSpeed === null || speed > maxSpeed)) {
        maxSpeed = speed;
      }
      if (speed >= movingThreshold) {
        hasMoving = true;
        movingTime += dt;
        movingDistance += d;
        if (prev.ele !== undefined && p.ele !== undefined && p.ele > prev.ele) {
          climbTime += dt;
          climbGain += p.ele - prev.ele;
        }
      }
    }
  }

  const totalTime =
    firstTime !== null && lastTime !== null && lastTime > firstTime
      ? lastTime - firstTime
      : null;

  return {
    totalTime,
    movingTime: hasMoving ? movingTime : null,
    avgSpeed: hasMoving && movingTime > 0 ? movingDistance / movingTime : null,
    maxSpeed,
    vam: climbTime > 0 ? (climbGain / climbTime) * 3600 : null,
    hrAvg: hrCount > 0 ? hrSum / hrCount : null,
    hrMax,
    cadenceAvg: cadCount > 0 ? cadSum / cadCount : null,
    cadenceMax: cadMax,
    powerAvg: pwCount > 0 ? pwSum / pwCount : null,
    powerMax: pwMax,
    tempAvg: tempCount > 0 ? tempSum / tempCount : null,
  };
}
