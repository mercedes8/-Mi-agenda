import React, { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Btn, Check, Empty, LineInput, Sheet, Title } from '../components/ui';
import { run, useQuery } from '../db';
import { C, TAB_COLORS } from '../theme';

type List = { id: number; name: string; color: string; total: number; hechos: number };
type Item = { id: number; text: string; done: number };

const TEMPLATES = ['Compras del súper', 'Pendientes', 'Películas para ver', 'Libros para leer', 'Ideas', 'Regalos'];

export function ListsScreen() {
  const lists = useQuery<List>(
    `SELECT l.*, (SELECT COUNT(*) FROM list_items i WHERE i.list_id=l.id) total,
            (SELECT COUNT(*) FROM list_items i WHERE i.list_id=l.id AND i.done=1) hechos
     FROM lists l ORDER BY l.id`,
  );
  const [sel, setSel] = useState<number | null>(null);
  const [newList, setNewList] = useState('');
  const [newItem, setNewItem] = useState('');
  const current = lists.find((l) => l.id === sel) ?? lists[0];
  const items = useQuery<Item>('SELECT * FROM list_items WHERE list_id=? ORDER BY done, pos, id', [current?.id ?? -1]);

  const addList = (name: string) => {
    if (!name.trim()) return;
    const id = run('INSERT INTO lists (name, color) VALUES (?, ?)', [
      name.trim(), TAB_COLORS[lists.length % TAB_COLORS.length],
    ]).lastInsertRowId;
    setSel(id);
    setNewList('');
  };
  const addItem = () => {
    if (!newItem.trim() || !current) return;
    run('INSERT INTO list_items (list_id, text, pos) VALUES (?, ?, ?)', [current.id, newItem.trim(), Date.now()]);
    setNewItem('');
  };
  const removeList = () =>
    current &&
    Alert.alert('Eliminar lista', `¿Eliminar "${current.name}" y todos sus ítems?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          run('DELETE FROM list_items WHERE list_id=?', [current.id]);
          run('DELETE FROM lists WHERE id=?', [current.id]);
          setSel(null);
        },
      },
    ]);

  return (
    <View style={s.wrap}>
      <Sheet style={s.left}>
        <Title style={{ fontSize: 20 }}>☑ Listas</Title>
        <FlatList
          data={lists}
          keyExtractor={(l) => String(l.id)}
          ListEmptyComponent={<Empty text="Creá tu primera lista" />}
          renderItem={({ item: l }) => (
            <Pressable
              onPress={() => setSel(l.id)}
              style={[s.list, { borderLeftColor: l.color }, current?.id === l.id && { backgroundColor: C.accentSoft }]}
            >
              <Text style={s.listName}>{l.name}</Text>
              <Text style={s.count}>
                {l.hechos}/{l.total}
              </Text>
            </Pressable>
          )}
        />
        <LineInput placeholder="＋ Nueva lista…" value={newList} onChangeText={setNewList} onSubmitEditing={() => addList(newList)} />
        <View style={s.templates}>
          {TEMPLATES.filter((t) => !lists.some((l) => l.name === t)).map((t) => (
            <Pressable key={t} onPress={() => addList(t)} style={s.tpl}>
              <Text style={{ fontSize: 12 }}>＋ {t}</Text>
            </Pressable>
          ))}
        </View>
      </Sheet>
      <Sheet style={s.right}>
        {current ? (
          <>
            <View style={s.head}>
              <Title style={{ flex: 1, fontSize: 22 }} color={C.ink}>
                {current.name}
              </Title>
              {items.some((i) => i.done) && (
                <Btn small outline label="Quitar tachados" onPress={() => run('DELETE FROM list_items WHERE list_id=? AND done=1', [current.id])} />
              )}
              <Btn small outline color={C.danger} label="Eliminar lista" onPress={removeList} style={{ marginLeft: 8 }} />
            </View>
            <LineInput
              placeholder="＋ Agregar ítem y presioná Enter"
              value={newItem}
              onChangeText={setNewItem}
              onSubmitEditing={addItem}
              blurOnSubmit={false}
              returnKeyType="next"
              style={{ fontSize: 18, marginBottom: 8 }}
            />
            <FlatList
              data={items}
              keyExtractor={(i) => String(i.id)}
              renderItem={({ item: i }) => (
                <View style={s.item}>
                  <Check checked={!!i.done} onPress={() => run('UPDATE list_items SET done=? WHERE id=?', [i.done ? 0 : 1, i.id])} />
                  <Text style={[s.itemText, !!i.done && { textDecorationLine: 'line-through', color: C.inkSoft }]}>{i.text}</Text>
                  <Pressable onPress={() => run('DELETE FROM list_items WHERE id=?', [i.id])} hitSlop={8}>
                    <Text style={{ color: C.inkSoft, fontSize: 16 }}>✕</Text>
                  </Pressable>
                </View>
              )}
            />
          </>
        ) : (
          <Empty text="Elegí o creá una lista a la izquierda." />
        )}
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row', backgroundColor: C.desk, padding: 14, gap: 12 },
  left: { width: 320 },
  right: { flex: 1 },
  list: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderLeftWidth: 6, marginBottom: 4, borderRadius: 4 },
  listName: { flex: 1, fontSize: 16, color: C.ink, fontWeight: '600' },
  count: { color: C.inkSoft, fontSize: 13 },
  templates: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 },
  tpl: { borderWidth: 1, borderColor: '#DDD2BF', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line, gap: 12 },
  itemText: { flex: 1, fontSize: 17, color: C.ink },
});
