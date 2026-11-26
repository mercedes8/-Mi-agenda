import { getStroke } from 'perfect-freehand';
import type { Stroke } from './db';

/** Cantidad de números por punto: v2 guarda x,y,presión; los trazos viejos solo x,y */
export const strideOf = (s: Stroke) => (s.v === 2 ? 3 : 2);

/** Trazo "pluma": contorno relleno que varía con la presión (como tinta real) */
function freehandOutline(s: Stroke): string {
  const pts: number[][] = [];
  for (let i = 0; i < s.p.length; i += 3) pts.push([s.p[i], s.p[i + 1], s.p[i + 2]]);
  const pressureReal = !!s.pr;
  const outline = getStroke(pts, {
    size: s.w * 2.1,
    thinning: 0.6,
    smoothing: 0.55,
    streamline: 0.45,
    simulatePressure: !pressureReal,
    last: true,
  });
  if (outline.length < 2) return '';
  let d = `M${outline[0][0].toFixed(1)} ${outline[0][1].toFixed(1)}`;
  for (let i = 1; i < outline.length; i++) {
    const [x0, y0] = outline[i - 1];
    const [x1, y1] = outline[i];
    d += ` Q${x0.toFixed(1)} ${y0.toFixed(1)} ${((x0 + x1) / 2).toFixed(1)} ${((y0 + y1) / 2).toFixed(1)}`;
  }
  return d + ' Z';
}

/** Línea suavizada de ancho fijo (birome, resaltador y trazos viejos) */
function centerLine(s: Stroke): string {
  const st = strideOf(s);
  const p = s.p;
  const n = Math.floor(p.length / st);
  if (n === 0) return '';
  const X = (i: number) => p[i * st], Y = (i: number) => p[i * st + 1];
  if (n <= 2) {
    const x2 = n === 2 ? X(1) : X(0) + 0.5, y2 = n === 2 ? Y(1) : Y(0) + 0.5;
    return `M${X(0)} ${Y(0)} L${x2} ${y2}`;
  }
  let d = `M${X(0)} ${Y(0)}`;
  for (let i = 1; i < n - 1; i++) {
    d += ` Q${X(i)} ${Y(i)} ${(X(i) + X(i + 1)) / 2} ${(Y(i) + Y(i + 1)) / 2}`;
  }
  return d + ` L${X(n - 1)} ${Y(n - 1)}`;
}

export type StrokeGeom = { d: string; fill: boolean };

export function strokeGeom(s: Stroke): StrokeGeom {
  if (s.v === 2 && (s.k ?? 'pluma') === 'pluma') return { d: freehandOutline(s), fill: true };
  return { d: centerLine(s), fill: false };
}

/** ¿La goma en (x,y) toca el trazo? */
export function hits(s: Stroke, x: number, y: number, r = 12) {
  const st = strideOf(s);
  const rr = r + s.w / 2;
  for (let i = 0; i < s.p.length; i += st) {
    const dx = s.p[i] - x, dy = s.p[i + 1] - y;
    if (dx * dx + dy * dy < rr * rr) return true;
  }
  return false;
}
