/**
 * Estimation de durée de marche (règle de Naismith + correction de descente Langmuir).
 * Fonction pure et testée.
 */

export interface NaismithOptions {
  /** Vitesse de base sur le plat (km/h). Défaut 4. */
  baseSpeedKmh?: number;
  /** Secondes ajoutées par mètre de montée. Défaut 6 (≈ 1 h / 600 m). */
  ascentSecondsPerMeter?: number;
  /** Applique la correction de descente de Langmuir (gain de temps en pente douce). */
  descentCorrection?: boolean;
}

/**
 * Durée estimée (secondes) pour une distance (m), un D+ (m) et un D- (m).
 *
 * Naismith : temps plat = distance / vitesse de base ; + `ascentSecondsPerMeter` par mètre
 * de montée. Langmuir (optionnel) : retire ~10 min par 300 m de descente douce (2 s/m).
 */
export function naismithDuration(
  distanceM: number,
  ascentM: number,
  descentM: number,
  options: NaismithOptions = {},
): number {
  const baseSpeedKmh = options.baseSpeedKmh ?? 4;
  const ascentSecondsPerMeter = options.ascentSecondsPerMeter ?? 6;

  const flatSeconds = baseSpeedKmh > 0 ? (distanceM / 1000 / baseSpeedKmh) * 3600 : 0;
  const ascentSeconds = ascentM * ascentSecondsPerMeter;
  const descentSeconds = options.descentCorrection === true ? -descentM * 2 : 0;

  return Math.max(0, flatSeconds + ascentSeconds + descentSeconds);
}
