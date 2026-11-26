import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../AppState';
import { Empty, LineInput, Sheet } from '../components/ui';
import { addDays, daysInMonth, MESES, ymd } from '../dates';
import { all, run, useDbVersion, useQuery } from '../db';
import { C, TAB_COLORS } from '../theme';
import { DateNav } from './DayScreen';

type Habit = { id: number; name: string; color: string };

function streak(done: Set<string>) {
  let d = new Date();
  if (!done.has(ymd(d))) d = addDays(d, -1);
  let n = 0;
  while (done.has(ymd(d))) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function HabitsScreen() {
  const { date } = useApp();
  useDbVersion();
  const habits = useQuery<Habit>('SELECT * FROM habits ORDER BY id');
  const [name, setName] = useState('');
  const y = date.getFullYear(), m = date.getMonth();
  const n = daysInMonth(y, m);
  const days = Array.from({ length: n }, (_, i) => new Date(y, m, i + 1));
  const todayKey = ymd(new Date());

  const add = () => {
    if (!name.trim()) return;
    run('INSERT INTO habits (name, color) VALUES (?, ?)', [name.trim(), TAB_COLORS[(habits.length * 3 + 6) % TAB_COLORS.length]]);
    setName('');
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={s.bar}>
        <DateNav unit="month" />
        <Text style={s.title}>
          Hábitos · {MESES[m]} {y}
        </Text>
      </View>
      <View style={s.wrap}>
        <Sheet style={{ flex: 1 }}>
          <ScrollView>
            <View style={s.row}>
              <Text style={[s.name, { fontWeight: '800', color: C.accent }]}>HÁBITO</Text>
              {days.map((d) => (
                <Text key={d.getDate()} style={[s.dayHead, ymd(d) === todayKey && { color: C.accent, fontWeight: '900' }]}>
                  {d.getDate()}
                </Text>
              ))}
              <Text style={s.stat}>Mes</Text>
              <Text style={s.stat}>Racha</Text>
            </View>
            {habits.length === 0 && <Empty text="Agregá hábitos para seguirlos día a día (ej: leer 20 min, caminar, tomar agua)." />}
            {habits.map((h) => {
              const logs = new Set(all<{ date: string }>('SELECT date FROM habit_logs WHERE habit_id=?', [h.id]).map((r) => r.date));
              const monthCount = days.filter((d) => logs.has(ymd(d))).length;
              return (
                <View key={h.id} style={s.row}>
                  <Pressable
                    style={s.nameBox}
                    onLongPress={() =>
                      Alert.alert('Eliminar hábito', `¿Eliminar "${h.name}" y su historial?`, [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                          text: 'Eliminar',
                          style: 'destructive',
                          onPress: () => {
                            run('DELETE FROM habit_logs WHERE habit_id=?', [h.id]);
                            run('DELETE FROM habits WHERE id=?', [h.id]);
                          },
                        },
                      ])
                    }
                  >
                    <Text style={s.name} numberOfLines={1}>
                      {h.name}
                    </Text>
                  </Pressable>
                  {days.map((d) => {
                    const k = ymd(d);
                    const on = logs.has(k);
                    return (
                      <Pressable
                        key={k}
                        style={[s.cell, on && { backgroundColor: h.color, borderColor: h.color }, k === todayKey && { borderColor: C.accent, borderWidth: 2 }]}
                        onPress={() =>
                          on
                            ? run('DELETE FROM habit_logs WHERE habit_id=? AND date=?', [h.id, k])
                            : run('INSERT OR IGNORE INTO habit_logs (habit_id, date) VALUES (?, ?)', [h.id, k])
                        }
                      >
                        {on && <Text style={s.tick}>✓</Text>}
                      </Pressable>
                    );
                  })}
                  <Text style={s.stat}>
                    {monthCount}/{n}
                  </Text>
                  <Text style={s.stat}>🔥{streak(logs)}</Text>
                </View>
              );
            })}
            <View style={[s.row, { marginTop: 10 }]}>
              <LineInput style={{ width: 300 }} placeholder="＋ Nuevo hábito…" value={name} onChangeText={setName} onSubmitEditing={add} />
            </View>
            <Text style={s.hint}>Tocá un casillero para marcar el día · mantené presionado el nombre para eliminar</Text>
          </ScrollView>
        </Sheet>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFE4CF', minHeight: 54, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: '#D8C8AA',
  },
  title: { fontSize: 20, fontWeight: '800', color: C.ink, marginLeft: 8 },
  wrap: { flex: 1, backgroundColor: C.desk, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  nameBox: { width: 160 },
  name: { width: 160, fontSize: 15, color: C.ink, fontWeight: '600' },
  dayHead: { width: 24, textAlign: 'center', fontSize: 11, color: C.inkSoft, marginHorizontal: 1 },
  cell: {
    width: 24, height: 24, marginHorizontal: 1, borderWidth: 1, borderColor: C.line, borderRadius: 4,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  tick: { color: '#fff', fontWeight: '900', fontSize: 13 },
  stat: { width: 52, textAlign: 'center', fontSize: 12, color: C.inkSoft },
  hint: { fontSize: 12, color: C.inkSoft, marginTop: 6 },
});
