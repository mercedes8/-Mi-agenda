import React, { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { InkPage } from '../components/InkPage';
import { Paper, PaperBg, PAPERS } from '../components/PaperBg';
import { Btn, Chip, Empty, Sheet, Title } from '../components/ui';
import { run, useQuery } from '../db';
import { C } from '../theme';

type Note = { id: number; title: string; paper: Paper; updated: number };

export function NotesScreen() {
  const notes = useQuery<Note>('SELECT * FROM notes ORDER BY updated DESC');
  const [sel, setSel] = useState<number | null>(null);
  const current = notes.find((n) => n.id === sel) ?? notes[0];

  const create = () => {
    const id = run('INSERT INTO notes (title, paper, updated) VALUES (?, ?, ?)', [
      'Nota ' + new Date().toLocaleDateString('es-AR'), 'rayado', Date.now(),
    ]).lastInsertRowId;
    setSel(id);
  };
  const remove = (n: Note) =>
    Alert.alert('Eliminar hoja', `¿Eliminar "${n.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          run('DELETE FROM pages WHERE key=?', [`note:${n.id}`]);
          run('DELETE FROM notes WHERE id=?', [n.id]);
          setSel(null);
        },
      },
    ]);

  return (
    <View style={s.wrap}>
      <Sheet style={s.left}>
        <Title style={{ fontSize: 20 }}>📝 Notas</Title>
        <Btn small label="＋ Hoja nueva" onPress={create} style={{ marginBottom: 8 }} />
        <FlatList
          data={notes}
          keyExtractor={(n) => String(n.id)}
          ListEmptyComponent={<Empty text="Sin notas todavía" />}
          renderItem={({ item: n }) => (
            <Pressable
              style={[s.item, current?.id === n.id && { backgroundColor: C.accentSoft }]}
              onPress={() => setSel(n.id)}
              onLongPress={() => remove(n)}
            >
              <Text style={s.itemTitle} numberOfLines={1}>
                {n.title}
              </Text>
              <Text style={s.itemSub}>
                {PAPERS.find((p) => p[0] === n.paper)?.[1]} · {new Date(n.updated).toLocaleDateString('es-AR')}
              </Text>
            </Pressable>
          )}
        />
        <Text style={s.hint}>Mantené presionada una hoja para eliminarla</Text>
      </Sheet>
      <View style={s.right}>
        {current ? (
          <InkPage
            pageKey={`note:${current.id}`}
            left={
              <View style={{ flexDirection: 'row' }}>
                {PAPERS.map(([p, l]) => (
                  <Chip key={p} label={l} active={current.paper === p} onPress={() => run('UPDATE notes SET paper=? WHERE id=?', [p, current.id])} />
                ))}
              </View>
            }
            pageStyle={s.paper}
          >
            {({ page, setField }) => (
              <>
                <PaperBg paper={current.paper} gap={32} top={56} />
                <TextInput
                  style={s.title}
                  value={current.title}
                  onChangeText={(t) => run('UPDATE notes SET title=?, updated=? WHERE id=?', [t, Date.now(), current.id])}
                  placeholder="Título"
                />
                <TextInput
                  multiline
                  style={[s.body, current.paper === 'rayado' && { paddingLeft: 66 }]}
                  value={page.fields.texto ?? ''}
                  onChangeText={(v) => setField('texto', v)}
                  textAlignVertical="top"
                />
              </>
            )}
          </InkPage>
        ) : (
          <Sheet style={{ flex: 1 }}>
            <Empty text="Creá una hoja para escribir, dibujar o pegar post-its." />
          </Sheet>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row', backgroundColor: C.desk, padding: 14, gap: 12 },
  left: { width: 280 },
  right: { flex: 1, borderRadius: 6, overflow: 'hidden' },
  paper: { backgroundColor: C.paper },
  item: { paddingVertical: 8, paddingHorizontal: 6, borderRadius: 6, borderBottomWidth: 1, borderBottomColor: C.line },
  itemTitle: { fontSize: 16, fontWeight: '600', color: C.ink },
  itemSub: { fontSize: 12, color: C.inkSoft },
  hint: { fontSize: 11, color: C.inkSoft, marginTop: 6 },
  title: { height: 56, fontSize: 24, fontWeight: '800', color: C.ink, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: C.accent },
  body: { flex: 1, fontSize: 18, lineHeight: 32, color: C.ink, paddingHorizontal: 16, paddingTop: 6 },
});
