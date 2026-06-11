import { useEffect, useRef, useState } from "react";
import type { PointerEvent, ReactElement } from "react";
import type { ProfilePoint } from "../core/geo/profile";
import { slopeColor } from "../map/slope-layers";

const HEIGHT = 150;
const PAD = { top: 12, right: 14, bottom: 22, left: 48 };

/** Courbes capteurs superposables au profil altimétrique. */
export interface ChartSeries {
  speed: boolean;
  hr: boolean;
  cadence: boolean;
}

/** Aucune courbe superposée (traces sans capteurs). */
export const NO_SERIES: ChartSeries = { speed: false, hr: false, cadence: false };

interface ElevationChartProps {
  points: ProfilePoint[];
  /** Colore la courbe par pente (sinon bleu uni). */
  colorBySlope: boolean;
  /** Courbes capteurs à superposer (normalisées sur la hauteur du graphe). */
  series: ChartSeries;
  /** Appelé au survol (point survolé ou `null`) — pour synchroniser la carte. */
  onHover: (point: ProfilePoint | null) => void;
}

/** Métriques superposables : clé du point de profil + classe CSS de la courbe. */
const OVERLAYS: ReadonlyArray<{
  key: "speed" | "hr" | "cadence";
  className: string;
}> = [
  { key: "speed", className: "elev-overlay-speed" },
  { key: "hr", className: "elev-overlay-hr" },
  { key: "cadence", className: "elev-overlay-cadence" },
];

/**
 * Graphe de profil altimétrique « façon app de rando » : aire dégradée, grille, axes,
 * repère de survol + infobulle (altitude / distance / pente). Rendu en pixels réels
 * (texte net), largeur responsive.
 */
export function ElevationChart({
  points,
  colorBySlope,
  series,
  onHover,
}: ElevationChartProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el === null) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  const hasData = points.length >= 2;
  const first = points[0];
  const last = points[points.length - 1];
  const maxDist = hasData && last !== undefined ? Math.max(1, last.distance) : 1;

  let minEle = Infinity;
  let maxEle = -Infinity;
  for (const p of points) {
    if (p.ele < minEle) minEle = p.ele;
    if (p.ele > maxEle) maxEle = p.ele;
  }
  if (!Number.isFinite(minEle)) {
    minEle = 0;
    maxEle = 100;
  }
  const margin = Math.max(10, (maxEle - minEle) * 0.12);
  const yMin = Math.floor((minEle - margin) / 10) * 10;
  const yMax = Math.ceil((maxEle + margin) / 10) * 10;
  const yRange = Math.max(1, yMax - yMin);

  const innerW = Math.max(1, width - PAD.left - PAD.right);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const baseY = PAD.top + innerH;
  const xOf = (d: number): number => PAD.left + (d / maxDist) * innerW;
  const yOf = (e: number): number => PAD.top + innerH - ((e - yMin) / yRange) * innerH;

  const linePoints = points.map((p) => `${xOf(p.distance)},${yOf(p.ele)}`);
  const areaPath =
    hasData && first !== undefined && last !== undefined
      ? `M${xOf(first.distance)},${baseY} L${linePoints.join(" L")} L${xOf(last.distance)},${baseY} Z`
      : "";

  const yTicks = niceTicks(yMin, yMax, 4);
  const xTicks = niceTicks(0, maxDist / 1000, 5);

  function onPointerMove(ev: PointerEvent<SVGSVGElement>): void {
    if (!hasData) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const d = clamp(((x - PAD.left) / innerW) * maxDist, 0, maxDist);
    let index = 0;
    let best = Infinity;
    for (let i = 0; i < points.length; i++) {
      const diff = Math.abs(points[i]!.distance - d);
      if (diff < best) {
        best = diff;
        index = i;
      }
    }
    setHoverIndex(index);
    onHover(points[index]!);
  }

  function onPointerLeave(): void {
    setHoverIndex(null);
    onHover(null);
  }

  const hp = hoverIndex !== null ? (points[hoverIndex] ?? null) : null;
  const grade =
    hp !== null && hoverIndex !== null && hoverIndex > 0
      ? gradeBetween(points[hoverIndex - 1]!, hp)
      : 0;

  return (
    <div className="elev-chart" ref={containerRef}>
      {!hasData ? (
        <p className="profile-empty">
          Pas d'altitude — menu « Outils ▸ Corriger l'altitude ».
        </p>
      ) : (
        <svg
          width={width}
          height={HEIGHT}
          className="elev-svg"
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
        >
          <defs>
            <linearGradient id="elevFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0077b6" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#0077b6" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {yTicks.map((t) => (
            <g key={`y${t}`}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={yOf(t)}
                y2={yOf(t)}
                className="elev-grid"
              />
              <text x={PAD.left - 6} y={yOf(t) + 3} textAnchor="end" className="elev-label">
                {t}
              </text>
            </g>
          ))}
          {xTicks.map((t, i) => (
            <text
              key={`x${t}`}
              x={xOf(t * 1000)}
              y={HEIGHT - 6}
              textAnchor="middle"
              className="elev-label"
            >
              {t}
              {i === xTicks.length - 1 ? " km" : ""}
            </text>
          ))}

          <path d={areaPath} fill="url(#elevFill)" />

          {colorBySlope ? (
            points.slice(1).map((p, i) => {
              const a = points[i]!;
              return (
                <line
                  key={i}
                  x1={xOf(a.distance)}
                  y1={yOf(a.ele)}
                  x2={xOf(p.distance)}
                  y2={yOf(p.ele)}
                  stroke={slopeColor(gradeBetween(a, p))}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
              );
            })
          ) : (
            <polyline
              points={linePoints.join(" ")}
              fill="none"
              stroke="#0077b6"
              strokeWidth={2}
              strokeLinejoin="round"
            />
          )}

          {OVERLAYS.filter((o) => series[o.key]).map((o) => {
            const path = overlayPath(points, o.key, xOf, PAD.top, innerH);
            return path === null ? null : (
              <polyline key={o.key} points={path} className={`elev-overlay ${o.className}`} />
            );
          })}

          {hp !== null && (
            <g>
              <line
                x1={xOf(hp.distance)}
                x2={xOf(hp.distance)}
                y1={PAD.top}
                y2={baseY}
                className="elev-cursor"
              />
              <circle cx={xOf(hp.distance)} cy={yOf(hp.ele)} r={4} className="elev-dot" />
            </g>
          )}
        </svg>
      )}

      {hp !== null && (
        <div
          className="elev-tooltip"
          style={{ left: `${clamp(xOf(hp.distance), 56, width - 56)}px` }}
        >
          <strong>{Math.round(hp.ele)} m</strong>
          <span>{(hp.distance / 1000).toFixed(2)} km</span>
          <span>
            {grade > 0 ? "+" : ""}
            {grade.toFixed(0)} %
          </span>
          {series.speed && hp.speed !== undefined && (
            <span className="tip-speed">{(hp.speed * 3.6).toFixed(1)} km/h</span>
          )}
          {series.hr && hp.hr !== undefined && (
            <span className="tip-hr">{Math.round(hp.hr)} bpm</span>
          )}
          {series.cadence && hp.cadence !== undefined && (
            <span className="tip-cadence">{Math.round(hp.cadence)} /min</span>
          )}
        </div>
      )}
    </div>
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Polyligne d'une métrique capteur, normalisée sur la hauteur du graphe
 * (min→bas, max→haut). `null` si moins de 2 points portent la métrique.
 */
function overlayPath(
  points: ProfilePoint[],
  key: "speed" | "hr" | "cadence",
  xOf: (d: number) => number,
  top: number,
  innerH: number,
): string | null {
  let min = Infinity;
  let max = -Infinity;
  let count = 0;
  for (const p of points) {
    const v = p[key];
    if (v === undefined) continue;
    count += 1;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (count < 2) return null;
  const range = Math.max(max - min, 1e-6);
  const parts: string[] = [];
  for (const p of points) {
    const v = p[key];
    if (v === undefined) continue;
    const y = top + innerH - ((v - min) / range) * innerH;
    parts.push(`${xOf(p.distance)},${y}`);
  }
  return parts.join(" ");
}

function gradeBetween(a: ProfilePoint, b: ProfilePoint): number {
  const run = b.distance - a.distance;
  return run > 0 ? ((b.ele - a.ele) / run) * 100 : 0;
}

function niceStep(rough: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const n = rough / pow;
  const step = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
  return step * pow;
}

function niceTicks(min: number, max: number, count: number): number[] {
  if (max <= min) return [min];
  const step = niceStep((max - min) / count);
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= max + step * 1e-6; t += step) {
    ticks.push(Math.round(t * 1000) / 1000);
  }
  return ticks;
}
