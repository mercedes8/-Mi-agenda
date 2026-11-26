import { Directory, File, Paths } from 'expo-file-system';
import { all, first, loadPage, run, savePage } from './db';
import type { Paper } from './components/PaperBg';

export type NoteKind = 'hoja' | 'reunion' | 'pizarra' | 'documento' | 'pdf' | 'audio' | 'rapida';

export type Note = {
  id: number; title: string; paper: Paper; updated: number; kind: NoteKind; folder_id: number | null;
  pages: number; file: string | null; extra: string; created: number | null; pinned: number;
};
export type Folder = { id: number; name: string; color: string };

export const KINDS: Record<NoteKind, { icon: string; label: string; desc: string }> = {
  hoja: { icon: '✍️', label: 'Cuaderno', desc: 'Hojas para escribir a mano o con teclado' },
  reunion: { icon: '👥', label: 'Reunión', desc: 'Plantilla con asistentes, temas, decisiones, tareas y grabación' },
  pizarra: { icon: '🧑‍🏫', label: 'Pizarra', desc: 'Lienzo infinito con zoom para ideas visuales' },
  documento: { icon: '📄', label: 'Documento', desc: 'Texto con títulos, listas y formato' },
  pdf: { icon: '📕', label: 'PDF', desc: 'Importá un PDF y escribí encima' },
  audio: { icon: '🎙️', label: 'Grabación', desc: 'Grabá audio y se transcribe solo' },
  rapida: { icon: '⚡', label: 'Nota rápida', desc: 'Una idea al vuelo' },
};

/** Clave de la página n (0 = primera) de una nota */
export const notePageKey = (id: number, n = 0) => (n === 0 ? `note:${id}` : `note:${id}:p${n}`);

export function dir(name: 'pdf' | 'audio' | 'export') {
  const d = new Directory(Paths.document, name);
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

export function createNote(kind: NoteKind, opts: { title?: string; folder?: number | null; file?: string; pages?: number; extra?: object } = {}) {
  const now = Date.now();
  const fecha = new Date().toLocaleDateString('es-AR');
  const title = opts.title ?? `${KINDS[kind].label} ${fecha}`;
  const paper = kind === 'rapida' ? 'liso' : 'rayado';
  return Number(
    run(
      'INSERT INTO notes (title, paper, updated, kind, folder_id, pages, file, extra, created) VALUES (?,?,?,?,?,?,?,?,?)',
      [title, paper, now, kind, opts.folder ?? null, opts.pages ?? 1, opts.file ?? null, JSON.stringify(opts.extra ?? {}), now],
    ).lastInsertRowId,
  );
}

export function getNote(id: number) {
  return first<Note>('SELECT * FROM notes WHERE id=?', [id]);
}

export function touchNote(id: number) {
  run('UPDATE notes SET updated=? WHERE id=?', [Date.now(), id]);
}

export function noteExtra<T extends object>(n: Note): T {
  try {
    return JSON.parse(n.extra || '{}') as T;
  } catch {
    return {} as T;
  }
}
export function setNoteExtra(id: number, extra: object) {
  run('UPDATE notes SET extra=? WHERE id=?', [JSON.stringify(extra), id]);
}

function deleteFile(uri: string | null | undefined) {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {}
}

export function deleteNote(n: Note) {
  // archivos asociados: PDF original y páginas renderizadas, audios
  deleteFile(n.file);
  const extra = noteExtra<{ pageImages?: { uri: string }[] }>(n);
  extra.pageImages?.forEach((p) => deleteFile(p.uri));
  for (const row of all<{ data: string }>("SELECT data FROM pages WHERE key = ? OR key LIKE ?", [`note:${n.id}`, `note:${n.id}:%`])) {
    try {
      const d = JSON.parse(row.data);
      const segs: { uri: string }[] = JSON.parse(d?.fields?.audio || '[]');
      segs.forEach((s) => deleteFile(s.uri));
    } catch {}
  }
  run('DELETE FROM pages WHERE key = ? OR key LIKE ?', [`note:${n.id}`, `note:${n.id}:%`]);
  run('DELETE FROM notes WHERE id=?', [n.id]);
}

/** Guarda una nota rápida (texto) */
export function saveQuickNote(text: string, folder: number | null = null) {
  const firstLine = text.trim().split('\n')[0].slice(0, 60) || 'Nota rápida';
  const id = createNote('rapida', { title: firstLine, folder });
  const p = loadPage(notePageKey(id));
  savePage(notePageKey(id), { ...p, fields: { ...p.fields, texto: text } });
  return id;
}

/** Texto plano de una página (para compartir) */
export function pageText(key: string, fields: string[]) {
  const f = loadPage(key).fields;
  return fields.map((k) => f[k]).filter(Boolean).join('\n\n');
}
