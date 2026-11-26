export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DIAS_CORTOS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha local -> 'YYYY-MM-DD' */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function ym(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
export function sameDay(a: Date, b: Date) {
  return ymd(a) === ymd(b);
}
export function startOfWeek(d: Date): Date {
  // semana de lunes a domingo
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const wd = (r.getDay() + 6) % 7;
  r.setDate(r.getDate() - wd);
  return r;
}
export function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
export function dayOfYear(d: Date) {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - start.getTime()) / 86400000) + 1;
}
export function daysInYear(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
}
/** Número de semana ISO 8601 */
export function isoWeek(d: Date): { year: number; week: number } {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
  return { year: t.getUTCFullYear(), week };
}
export function weekKey(d: Date) {
  const w = isoWeek(d);
  return `${w.year}-W${pad(w.week)}`;
}
export function longDate(d: Date) {
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}
export function hm(h: number, m: number) {
  return `${pad(h)}:${pad(m)}`;
}

/** Matriz de semanas (lunes a domingo) para un mes; null = fuera del mes */
export function monthMatrix(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const total = daysInMonth(year, month);
  const cells: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/* ---------------- Feriados de Argentina ---------------- */

function easter(y: number): Date {
  // Algoritmo de Meeus/Jones/Butcher
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}

const holidayCache: Record<number, Record<string, string>> = {};

/** Feriados nacionales (fechas nominales; los trasladables pueden moverse por decreto). */
export function holidays(year: number): Record<string, string> {
  if (holidayCache[year]) return holidayCache[year];
  const h: Record<string, string> = {};
  const fixed: [number, number, string][] = [
    [1, 1, 'Año Nuevo'],
    [3, 24, 'Día de la Memoria por la Verdad y la Justicia'],
    [4, 2, 'Día del Veterano y de los Caídos en Malvinas'],
    [5, 1, 'Día del Trabajador'],
    [5, 25, 'Revolución de Mayo'],
    [6, 17, 'Paso a la Inmortalidad de Güemes (trasladable)'],
    [6, 20, 'Paso a la Inmortalidad de Belgrano'],
    [7, 9, 'Día de la Independencia'],
    [8, 17, 'Paso a la Inmortalidad de San Martín (trasladable)'],
    [10, 12, 'Día del Respeto a la Diversidad Cultural (trasladable)'],
    [11, 20, 'Día de la Soberanía Nacional (trasladable)'],
    [12, 8, 'Inmaculada Concepción de María'],
    [12, 25, 'Navidad'],
  ];
  for (const [m, d, n] of fixed) h[ymd(new Date(year, m - 1, d))] = n;
  const e = easter(year);
  const add = (d: Date, n: string) => {
    const k = ymd(d);
    h[k] = h[k] ? `${h[k]} · ${n}` : n;
  };
  add(addDays(e, -48), 'Carnaval');
  add(addDays(e, -47), 'Carnaval');
  add(addDays(e, -3), 'Jueves Santo (no laborable)');
  add(addDays(e, -2), 'Viernes Santo');
  add(e, 'Pascua');
  holidayCache[year] = h;
  return h;
}
export function holidayOf(d: Date): string | undefined {
  return holidays(d.getFullYear())[ymd(d)];
}

/* ---------------- Fases lunares ---------------- */

const SYNODIC = 29.530588853;
function moonAge(date: Date) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  let age = (jd - 2451550.1) % SYNODIC;
  if (age < 0) age += SYNODIC;
  return age / SYNODIC; // 0..1
}
const MOON_EMOJI = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
export function moonOf(d: Date): { emoji: string; name?: string } {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59);
  const a = moonAge(start), b = moonAge(end);
  const crosses = (p: number) => (a <= b ? a <= p && b > p : a <= p || b > p);
  if (crosses(0) || (a > b)) return { emoji: '🌑', name: 'Luna nueva' };
  if (crosses(0.25)) return { emoji: '🌓', name: 'Cuarto creciente' };
  if (crosses(0.5)) return { emoji: '🌕', name: 'Luna llena' };
  if (crosses(0.75)) return { emoji: '🌗', name: 'Cuarto menguante' };
  return { emoji: MOON_EMOJI[Math.round(a * 8) % 8] };
}
