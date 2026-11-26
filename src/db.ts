import * as SQLite from 'expo-sqlite';
import { useMemo, useSyncExternalStore } from 'react';

export const db = SQLite.openDatabaseSync('agenda.db');

db.execSync(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS pages (key TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, updated INTEGER);
CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, notes TEXT DEFAULT '',
  date TEXT NOT NULL, time TEXT NOT NULL, repeat TEXT DEFAULT 'none', advance INTEGER DEFAULT 0,
  color TEXT DEFAULT '#B5651D', done INTEGER DEFAULT 0, notif_ids TEXT DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT DEFAULT '', email TEXT DEFAULT '',
  address TEXT DEFAULT '', bday_day INTEGER, bday_month INTEGER, bday_year INTEGER,
  notes TEXT DEFAULT '', notif_id TEXT
);
CREATE TABLE IF NOT EXISTS lists (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, color TEXT DEFAULT '#FFD54F');
CREATE TABLE IF NOT EXISTS list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, list_id INTEGER NOT NULL, text TEXT NOT NULL, done INTEGER DEFAULT 0, pos INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS habits (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, color TEXT DEFAULT '#81C784');
CREATE TABLE IF NOT EXISTS habit_logs (habit_id INTEGER NOT NULL, date TEXT NOT NULL, PRIMARY KEY (habit_id, date));
CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT, period TEXT NOT NULL, text TEXT NOT NULL, progress INTEGER DEFAULT 0, done INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, paper TEXT DEFAULT 'rayado', updated INTEGER
);
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, kind TEXT DEFAULT 'gasto', category TEXT DEFAULT 'Otros',
  description TEXT DEFAULT '', amount REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT);
`);

/* ---------- Migraciones (columnas nuevas para Cuadernos) ---------- */
db.execSync(`CREATE TABLE IF NOT EXISTS folders (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, color TEXT DEFAULT '#7986CB');`);
const noteCols = db.getAllSync<{ name: string }>('PRAGMA table_info(notes)').map((c) => c.name);
for (const [col, def] of [
  ['kind', "TEXT DEFAULT 'hoja'"],
  ['folder_id', 'INTEGER'],
  ['pages', 'INTEGER DEFAULT 1'],
  ['file', 'TEXT'],
  ['extra', "TEXT DEFAULT '{}'"],
  ['created', 'INTEGER'],
  ['pinned', 'INTEGER DEFAULT 0'],
] as const) {
  if (!noteCols.includes(col)) db.execSync(`ALTER TABLE notes ADD COLUMN ${col} ${def}`);
}

export const TABLES = [
  'pages', 'reminders', 'contacts', 'lists', 'list_items', 'habits', 'habit_logs', 'goals', 'notes', 'expenses', 'settings',
  'folders',
] as const;

/* ---------- Mini store: avisa a las pantallas cuando cambian los datos ---------- */
let version = 0;
const listeners = new Set<() => void>();
export function bump() {
  version++;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function useDbVersion() {
  return useSyncExternalStore(subscribe, () => version);
}
/** Ejecuta una consulta y la vuelve a ejecutar cuando cambia la base. */
export function useQuery<T>(sql: string, params: SQLite.SQLiteBindValue[] = []): T[] {
  const v = useDbVersion();
  const key = JSON.stringify(params);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => db.getAllSync<T>(sql, params), [v, sql, key]);
}
export function run(sql: string, params: SQLite.SQLiteBindValue[] = []) {
  const r = db.runSync(sql, params);
  bump();
  return r;
}
export function all<T>(sql: string, params: SQLite.SQLiteBindValue[] = []) {
  return db.getAllSync<T>(sql, params);
}
export function first<T>(sql: string, params: SQLite.SQLiteBindValue[] = []) {
  return db.getFirstSync<T>(sql, params);
}

/* ---------- Ajustes ---------- */
export function getSetting(key: string, def: string) {
  return first<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])?.value ?? def;
}
export function setSetting(key: string, value: string) {
  run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}
export function useSetting(key: string, def: string): [string, (v: string) => void] {
  useDbVersion();
  return [getSetting(key, def), (v: string) => setSetting(key, v)];
}

/* ---------- Páginas (dibujo + post-its + campos de texto) ---------- */
/**
 * Trazo a mano. c=color, w=ancho, o=opacidad.
 * p = puntos: x,y,x,y… (trazos viejos) o x,y,presión,… cuando v=2.
 * k = tipo de lápiz ('pluma' varía con la presión, 'birome' y 'resaltador' son de ancho fijo).
 * pr = true si la presión vino de un lápiz óptico real.
 */
export type Stroke = { c: string; w: number; o: number; p: number[]; v?: 2; k?: 'pluma' | 'birome' | 'resaltador'; pr?: boolean };
export type PostIt = {
  id: string; x: number; y: number; w: number; h: number; color: string; text: string; kind: 'note' | 'sticker';
};
export type Task = { t: string; d: boolean };
export type PageData = {
  strokes: Stroke[];
  postits: PostIt[];
  fields: Record<string, string>;
  tasks: Task[];
};
export const emptyPage = (): PageData => ({ strokes: [], postits: [], fields: {}, tasks: [] });

export function loadPage(key: string): PageData {
  const row = first<{ data: string }>('SELECT data FROM pages WHERE key = ?', [key]);
  if (!row) return emptyPage();
  try {
    return { ...emptyPage(), ...JSON.parse(row.data) };
  } catch {
    return emptyPage();
  }
}
export function savePage(key: string, data: PageData) {
  db.runSync('INSERT OR REPLACE INTO pages (key, data, updated) VALUES (?, ?, ?)', [key, JSON.stringify(data), Date.now()]);
}
/* Editores abiertos: permiten modificar una página desde afuera sin pisar cambios */
const openPages = new Map<string, (fn: (p: PageData) => PageData) => void>();
export function registerOpenPage(key: string, update: (fn: (p: PageData) => PageData) => void) {
  openPages.set(key, update);
  return () => {
    if (openPages.get(key) === update) openPages.delete(key);
  };
}
/** Modifica una página: si está abierta en pantalla usa su editor, si no la guarda directo */
export function updatePageAnywhere(key: string, fn: (p: PageData) => PageData) {
  const open = openPages.get(key);
  if (open) open(fn);
  else savePage(key, fn(loadPage(key)));
}

/** Lee solo los campos de una página (para vistas resumen) */
export function pageFields(key: string): Record<string, string> {
  return loadPage(key).fields;
}

/* ---------- Backup ---------- */
export function exportAll(): string {
  const out: Record<string, unknown[]> = {};
  for (const t of TABLES) out[t] = db.getAllSync(`SELECT * FROM ${t}`);
  return JSON.stringify({ app: 'mi-agenda', version: 1, exported: new Date().toISOString(), data: out });
}
export function importAll(json: string) {
  const parsed = JSON.parse(json);
  if (parsed?.app !== 'mi-agenda') throw new Error('El archivo no es un backup de Mi Agenda');
  db.withTransactionSync(() => {
    for (const t of TABLES) {
      db.runSync(`DELETE FROM ${t}`);
      const rows = (parsed.data?.[t] ?? []) as Record<string, SQLite.SQLiteBindValue>[];
      for (const r of rows) {
        const cols = Object.keys(r);
        if (!cols.length) continue;
        db.runSync(
          `INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
          cols.map((c) => r[c]),
        );
      }
    }
  });
  bump();
}
