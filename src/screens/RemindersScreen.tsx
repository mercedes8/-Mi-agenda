import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../AppState';
import { Btn, Check, Chip, Empty, Sheet, Title } from '../components/ui';
import { first, run } from '../db';
import { longDate, parseYmd, ymd } from '../dates';
import {
  ADVANCE_OPTIONS, exactAlarmStatus, Reminder, reminderFireDate, REPEAT_LABEL, requestExactAlarm, scheduleReminder,
} from '../notifications';
import { useReminders } from '../occurs';
import { C } from '../theme';

type Filter = 'proximos' | 'repetitivos' | 'pasados';

export function RemindersScreen() {
  const { openReminder } = useApp();
  const all = useReminders();
  const [filter, setFilter] = useState<Filter>('proximos');
  const [exactOk, setExactOk] = useState(true);
  useEffect(() => {
    exactAlarmStatus().then(setExactOk);
  }, []);

  const now = Date.now();
  const list = all
    .filter((r) => {
      if (filter === 'repetitivos') return r.repeat !== 'none';
      if (r.repeat !== 'none') return false;
      const future = reminderFireDate({ ...r, advance: 0 }).getTime() >= now;
      return filter === 'proximos' ? future && !r.done : !future || !!r.done;
    })
    .sort((a, b) => {
      const k = (r: Reminder) => r.date + r.time;
      return filter === 'pasados' ? k(b).localeCompare(k(a)) : k(a).localeCompare(k(b));
    });

  const toggle = async (r: Reminder) => {
    run('UPDATE reminders SET done=? WHERE id=?', [r.done ? 0 : 1, r.id]);
    const fresh = first<Reminder>('SELECT * FROM reminders WHERE id=?', [r.id]);
    if (fresh) await scheduleReminder(fresh);
  };

  return (
    <View style={s.wrap}>
      <Sheet style={{ flex: 1 }}>
        <View style={s.head}>
          <Title style={{ flex: 1, fontSize: 20 }}>🔔 Recordatorios</Title>
          <Chip label="Próximos" active={filter === 'proximos'} onPress={() => setFilter('proximos')} />
          <Chip label="Repetitivos" active={filter === 'repetitivos'} onPress={() => setFilter('repetitivos')} />
          <Chip label="Pasados / hechos" active={filter === 'pasados'} onPress={() => setFilter('pasados')} />
          <Btn label="＋ Nuevo" onPress={() => openReminder({ date: ymd(new Date()), time: '09:00' })} style={{ marginLeft: 8 }} />
        </View>
        {!exactOk && (
          <Pressable style={s.warn} onPress={async () => setExactOk(await requestExactAlarm())}>
            <Text style={s.warnText}>
              ⚠️ Android no permite todavía alarmas exactas para esta app, los avisos pueden llegar con demora. Tocá acá para habilitarlas.
            </Text>
          </Pressable>
        )}
        <FlatList
          data={list}
          keyExtractor={(r) => String(r.id)}
          ListEmptyComponent={<Empty text="No hay recordatorios en esta lista." />}
          renderItem={({ item: r }) => (
            <Pressable style={s.item} onPress={() => openReminder({ ...r })}>
              <View style={[s.dot, { backgroundColor: r.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.itemTitle, !!r.done && { textDecorationLine: 'line-through', color: C.inkSoft }]}>{r.title}</Text>
                <Text style={s.itemSub}>
                  {r.repeat === 'none' ? longDate(parseYmd(r.date)) : `${REPEAT_LABEL[r.repeat]} · desde ${r.date}`} · {r.time} hs
                  {r.advance ? ` · avisa ${ADVANCE_OPTIONS.find((a) => a[0] === r.advance)?.[1] ?? ''}` : ''}
                </Text>
                {r.notes ? <Text style={s.itemNotes}>{r.notes}</Text> : null}
              </View>
              {r.repeat === 'none' && <Check checked={!!r.done} onPress={() => toggle(r)} />}
            </Pressable>
          )}
        />
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.desk, padding: 14 },
  head: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 },
  warn: { backgroundColor: '#FFF3CD', borderRadius: 8, padding: 10, marginBottom: 8 },
  warnText: { color: '#7A5A00' },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line, gap: 12 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  itemTitle: { fontSize: 17, fontWeight: '700', color: C.ink },
  itemSub: { fontSize: 13, color: C.inkSoft },
  itemNotes: { fontSize: 13, color: C.ink, marginTop: 2 },
});
