import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import React, { useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PdfRenderer } from '../../modules/pdf-renderer';
import { Menu, MenuItem } from '../components/Menu';
import { Empty, Sheet, Title } from '../components/ui';
import { run, useQuery } from '../db';
import { createNote, deleteNote, dir, Folder, KINDS, Note, NoteKind } from '../notebooks';
import { C, TAB_COLORS } from '../theme';
import { AudioEditor } from './notebook/AudioEditor';
import { DocumentEditor } from './notebook/DocumentEditor';
import { HojaEditor } from './notebook/HojaEditor';
import { MeetingEditor } from './notebook/MeetingEditor';
import { PdfEditor } from './notebook/PdfEditor';
import { WhiteboardEditor } from './notebook/WhiteboardEditor';

type Filter = { type: 'all' } | { type: 'pinned' } | { type: 'kind'; kind: NoteKind } | { type: 'folder'; id: number };

export function Editor({ note, onBack }: { note: Note; onBack: () => void }) {
  switch (note.kind) {
    case 'reunion':
      return <MeetingEditor note={note} onBack={onBack} />;
    case 'pizarra':
      return <WhiteboardEditor note={note} onBack={onBack} />;
    case 'documento':
      return <DocumentEditor note={note} onBack={onBack} />;
    case 'pdf':
      return <PdfEditor note={note} onBack={onBack} />;
    case 'audio':
      return <AudioEditor note={note} onBack={onBack} />;
    default:
      return <HojaEditor note={note} onBack={onBack} />;
  }
}

const fmt = (t: number) =>
  new Date(t).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) +
  ' ' +
  new Date(t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

export function NotebooksScreen() {
  const folders = useQuery<Folder & { n: number }>(
    'SELECT f.*, (SELECT COUNT(*) FROM notes WHERE folder_id=f.id) n FROM folders f ORDER BY name COLLATE NOCASE',
  );
  const [filter, setFilter] = useState<Filter>({ type: 'all' });
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ title: string; items: MenuItem[] } | null>(null);
  const [newFolder, setNewFolder] = useState('');

  let where = '1=1';
  const params: (string | number)[] = [];
  if (filter.type === 'pinned') where = 'n.pinned=1';
  if (filter.type === 'kind') {
    where = 'n.kind=?';
    params.push(filter.kind);
  }
  if (filter.type === 'folder') {
    where = 'n.folder_id=?';
    params.push(filter.id);
  }
  if (q.trim()) {
    where += ` AND (n.title LIKE ? OR EXISTS (SELECT 1 FROM pages p WHERE (p.key = 'note:' || n.id OR p.key LIKE 'note:' || n.id || ':%') AND p.data LIKE ?))`;
    params.push(`%${q.trim()}%`, `%${q.trim()}%`);
  }
  const notes = useQuery<Note>(`SELECT n.* FROM notes n WHERE ${where} ORDER BY n.pinned DESC, n.updated DESC`, params);
  const open = useQuery<Note>('SELECT * FROM notes WHERE id=?', [openId ?? -1])[0];

  if (open) return <Editor note={open} onBack={() => setOpenId(null)} />;

  const folderId = filter.type === 'folder' ? filter.id : null;

  const create = async (kind: NoteKind) => {
    if (kind === 'pdf') return importPdf();
    const id = createNote(kind, { folder: folderId });
    setOpenId(id);
  };

  const importPdf = async () => {
    if (!PdfRenderer) {
      Alert.alert('No disponible', 'Esta versión de la app no tiene el lector de PDF.');
      return;
    }
    const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    try {
      const dest = new File(dir('pdf'), `doc_${Date.now()}.pdf`);
      await new File(asset.uri).copy(dest);
      const pages = await PdfRenderer.getPageCount(dest.uri);
      const id = createNote('pdf', {
        title: asset.name.replace(/\.pdf$/i, ''),
        folder: folderId,
        file: dest.uri,
        pages,
      });
      setOpenId(id);
    } catch (e) {
      Alert.alert('No se pudo abrir el PDF', String(e));
    }
  };

  const noteMenu = (n: Note) =>
    setMenu({
      title: n.title,
      items: [
        { icon: n.pinned ? '📌' : '⭐', label: n.pinned ? 'Quitar de fijadas' : 'Fijar arriba', onPress: () => run('UPDATE notes SET pinned=? WHERE id=?', [n.pinned ? 0 : 1, n.id]) },
        { icon: '📁', label: 'Mover a carpeta…', onPress: () => moveMenu(n) },
        {
          icon: '🗑️',
          label: 'Eliminar',
          danger: true,
          onPress: () =>
            Alert.alert('Eliminar', `¿Eliminar "${n.title}"? No se puede deshacer.`, [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Eliminar', style: 'destructive', onPress: () => deleteNote(n) },
            ]),
        },
      ],
    });
  const moveMenu = (n: Note) =>
    setTimeout(
      () =>
        setMenu({
          title: 'Mover a…',
          items: [
            { icon: '📂', label: 'Sin carpeta', onPress: () => run('UPDATE notes SET folder_id=NULL WHERE id=?', [n.id]) },
            ...folders.map((f) => ({ icon: '📁', label: f.name, onPress: () => run('UPDATE notes SET folder_id=? WHERE id=?', [f.id, n.id]) })),
          ],
        }),
      250,
    );
  const folderMenu = (f: Folder) =>
    setMenu({
      title: f.name,
      items: [
        {
          icon: '🗑️',
          label: 'Eliminar carpeta (las notas quedan sin carpeta)',
          danger: true,
          onPress: () => {
            run('UPDATE notes SET folder_id=NULL WHERE folder_id=?', [f.id]);
            run('DELETE FROM folders WHERE id=?', [f.id]);
            setFilter({ type: 'all' });
          },
        },
      ],
    });
  const addFolder = () => {
    if (!newFolder.trim()) return;
    run('INSERT INTO folders (name, color) VALUES (?, ?)', [newFolder.trim(), TAB_COLORS[folders.length % TAB_COLORS.length]]);
    setNewFolder('');
  };

  const side = ({ f, label, icon, count, onLongPress, k }: { f: Filter; label: string; icon: string; count?: number; onLongPress?: () => void; k?: string | number }) => {
    const active = JSON.stringify(f) === JSON.stringify(filter);
    return (
      <Pressable key={k} style={[s.side, active && { backgroundColor: C.accentSoft }]} onPress={() => setFilter(f)} onLongPress={onLongPress}>
        <Text style={s.sideText}>
          {icon} {label}
        </Text>
        {count !== undefined && <Text style={s.count}>{count}</Text>}
      </Pressable>
    );
  };

  const title =
    filter.type === 'all' ? 'Todas las notas'
      : filter.type === 'pinned' ? 'Fijadas'
        : filter.type === 'kind' ? KINDS[filter.kind].label + 's'
          : folders.find((f) => f.id === filter.id)?.name ?? '';

  return (
    <View style={s.wrap}>
      <Sheet style={s.left}>
        <Title style={{ fontSize: 20 }}>📚 Cuadernos</Title>
        <TextInput style={s.search} placeholder="🔎 Buscar en todo…" value={q} onChangeText={setQ} placeholderTextColor="#B8AFA2" />
        <ScrollView>
          {side({ f: { type: 'all' }, label: 'Todas', icon: '🗂️' })}
          {side({ f: { type: 'pinned' }, label: 'Fijadas', icon: '⭐' })}
          <Text style={s.group}>Por tipo</Text>
          {(Object.keys(KINDS) as NoteKind[]).map((k) => (
            side({ k, f: { type: 'kind', kind: k }, label: KINDS[k].label, icon: KINDS[k].icon })
          ))}
          <Text style={s.group}>Carpetas</Text>
          {folders.map((f) => (
            side({ k: f.id, f: { type: 'folder', id: f.id }, label: f.name, icon: '📁', count: f.n, onLongPress: () => folderMenu(f) })
          ))}
          <TextInput
            style={s.newFolder}
            placeholder="＋ Nueva carpeta"
            value={newFolder}
            onChangeText={setNewFolder}
            onSubmitEditing={addFolder}
            placeholderTextColor="#B8AFA2"
          />
        </ScrollView>
      </Sheet>
      <Sheet style={{ flex: 1 }}>
        <Text style={s.mainTitle}>{title}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 10 }}>
          {(['hoja', 'reunion', 'pizarra', 'documento', 'pdf', 'audio'] as NoteKind[]).map((k) => (
            <Pressable key={k} style={s.newBtn} onPress={() => create(k)}>
              <Text style={{ fontSize: 26 }}>{KINDS[k].icon}</Text>
              <Text style={s.newLabel}>＋ {KINDS[k].label}</Text>
              <Text style={s.newDesc} numberOfLines={2}>
                {KINDS[k].desc}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <FlatList
          data={notes}
          key="grid4"
          numColumns={4}
          keyExtractor={(n) => String(n.id)}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ gap: 10, paddingBottom: 20 }}
          ListEmptyComponent={<Empty text={q ? 'Nada coincide con la búsqueda.' : 'Todavía no hay notas acá. Creá una con los botones de arriba.'} />}
          renderItem={({ item: n }) => {
            const folder = folders.find((f) => f.id === n.folder_id);
            return (
              <Pressable style={s.card} onPress={() => setOpenId(n.id)} onLongPress={() => noteMenu(n)}>
                <View style={[s.cardTop, { backgroundColor: folder?.color ?? '#EFE4CF' }]}>
                  <Text style={{ fontSize: 30 }}>{KINDS[n.kind]?.icon ?? '📝'}</Text>
                  {n.pinned ? <Text style={s.pin}>⭐</Text> : null}
                </View>
                <Text style={s.cardTitle} numberOfLines={2}>
                  {n.title}
                </Text>
                <Text style={s.cardSub}>
                  {KINDS[n.kind]?.label} · {fmt(n.updated)}
                </Text>
                {folder ? <Text style={s.cardSub}>📁 {folder.name}</Text> : null}
              </Pressable>
            );
          }}
        />
        <Text style={s.hint}>Mantené presionada una nota para fijarla, moverla o eliminarla</Text>
      </Sheet>
      <Menu title={menu?.title} items={menu?.items ?? null} onClose={() => setMenu(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row', backgroundColor: C.desk, padding: 14, gap: 12 },
  left: { width: 250 },
  search: { borderWidth: 1, borderColor: '#DDD2BF', borderRadius: 8, padding: 8, marginVertical: 8, backgroundColor: '#fff', fontSize: 15 },
  side: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 8, borderRadius: 6 },
  sideText: { flex: 1, fontSize: 15, color: C.ink },
  count: { color: C.inkSoft, fontSize: 12 },
  group: { marginTop: 12, marginBottom: 2, fontSize: 11, fontWeight: '900', color: C.accent, textTransform: 'uppercase', letterSpacing: 1 },
  newFolder: { borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 6, paddingHorizontal: 8, fontSize: 15, color: C.ink },
  mainTitle: { fontSize: 22, fontWeight: '800', color: C.ink, marginBottom: 8 },
  newBtn: {
    width: 150, borderWidth: 1, borderColor: '#DDD2BF', borderRadius: 10, padding: 10, marginRight: 8, backgroundColor: '#fff',
  },
  newLabel: { fontWeight: '800', color: C.accent, marginTop: 2 },
  newDesc: { fontSize: 11, color: C.inkSoft },
  card: { flex: 1, maxWidth: '24%', backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E6DAC3', overflow: 'hidden' },
  cardTop: { height: 70, alignItems: 'center', justifyContent: 'center' },
  pin: { position: 'absolute', top: 4, right: 6 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.ink, paddingHorizontal: 8, paddingTop: 6 },
  cardSub: { fontSize: 11, color: C.inkSoft, paddingHorizontal: 8, paddingBottom: 4 },
  hint: { fontSize: 11, color: C.inkSoft, marginTop: 4 },
});

