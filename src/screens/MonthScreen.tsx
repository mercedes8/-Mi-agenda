import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApp } from '../AppState';
import { InkPage } from '../components/InkPage';
import { PaperBg, Rings } from '../components/PaperBg';
import { Check, LineInput, Title } from '../components/ui';
import { pageFields, run, useDbVersion, useQuery } from '../db';
import { DIAS_CORTOS, holidayOf, MESES, monthMatrix, sameDay, ym, ymd } from '../dates';
import { birthdaysOn, remindersOn, useContacts, useReminders } from '../occurs';
import { C } from '../theme';
import { DateNav, st as day } from './DayScreen';

type Goal = { id: number; text: string; done: number; progress: number };

export function GoalList({ period, compact }: { period: string; compact?: boolean }) {
  const goals = useQuery<Goal>('SELECT * FROM goals WHERE period=? ORDER BY id', [period]);
  const [text, setText] = useState('');
  const add = () => {
    if (!text.trim()) return;
    run('INSERT INTO goals (period, text) VALUES (?, ?)', [period, text.trim()]);
    setText('');
  };
  return (
    <View>
      {goals.map((g) => (
        <View key={g.id} style={s.goal}>
          <Check checked={!!g.done} onPress={() => run('UPDATE goals SET done=?, progress=? WHERE id=?', [g.done ? 0 : 1, g.done ? g.progress : 100, g.id])} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={[s.goalText, !!g.done && { textDecorationLine: 'line-through', color: C.inkSoft }]}>{g.text}</Text>
            {!compact && (
              <View style={s.progressRow}>
                <Pressable onPress={() => run('UPDATE goals SET progress=MAX(0,progress-10) WHERE id=?', [g.id])} hitSlop={6}>
                  <Text style={s.pm}>−</Text>
                </Pressable>
                <View style={s.bar}>
                  <View style={[s.fill, { width: `${g.progress}%` }]} />
                </View>
                <Pressable onPress={() => run('UPDATE goals SET progress=MIN(100,progress+10) WHERE id=?', [g.id])} hitSlop={6}>
                  <Text style={s.pm}>＋</Text>
                </Pressable>
                <Text style={s.pct}>{g.progress}%</Text>
              </View>
            )}
          </View>
          <Pressable onPress={() => run('DELETE FROM goals WHERE id=?', [g.id])} hitSlop={8}>
            <Text style={{ color: C.inkSoft }}>✕</Text>
          </Pressable>
        </View>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <LineInput style={{ flex: 1 }} placeholder="＋ Nueva meta…" value={text} onChangeText={setText} onSubmitEditing={add} returnKeyType="done" />
      </View>
    </View>
  );
}

export function MonthScreen() {
  const { date, goToDay, openReminder } = useApp();
  useDbVersion();
  const reminders = useReminders();
  const contacts = useContacts();
  const rows = monthMatrix(date.getFullYear(), date.getMonth());
  const period = ym(date);

  return (
    <InkPage
      pageKey={`month:${period}`}
      left={
        <>
          <DateNav unit="month" />
          <Text style={s.title}>
            {MESES[date.getMonth()]} {date.getFullYear()}
          </Text>
        </>
      }
      pageStyle={day.desk}
    >
      {({ page, setField }) => (
        <View style={day.spread}>
          <View style={[day.page, day.pageLeft, { flex: 2.3, paddingHorizontal: 10 }]}>
            <View style={s.weekHead}>
              {DIAS_CORTOS.map((d, i) => (
                <Text key={d} style={[s.weekHeadText, i === 6 && { color: C.holiday }]}>
                  {d}
                </Text>
              ))}
            </View>
            {rows.map((row, ri) => (
              <View key={ri} style={s.gridRow}>
                {row.map((d, ci) => {
                  if (!d) return <View key={ci} style={[s.cell, { backgroundColor: '#F5EEDF' }]} />;
                  const rs = remindersOn(reminders, d);
                  const bs = birthdaysOn(contacts, d);
                  const hol = holidayOf(d);
                  const p1 = pageFields(`day:${ymd(d)}`).p1;
                  const today = sameDay(d, new Date());
                  return (
                    <Pressable
                      key={ci}
                      style={[s.cell, today && s.todayCell]}
                      onPress={() => goToDay(d)}
                      onLongPress={() => openReminder({ date: ymd(d), time: '09:00' })}
                    >
                      <Text style={[s.num, (hol || ci === 6) && { color: C.holiday }]}>
                        {d.getDate()} {bs.length ? '🎂' : ''}
                      </Text>
                      {hol && (
                        <Text style={s.hol} numberOfLines={1}>
                          {hol}
                        </Text>
                      )}
                      {p1 ? (
                        <Text style={s.item} numberOfLines={1}>
                          ★ {p1}
                        </Text>
                      ) : null}
                      {rs.slice(0, 3).map((r) => (
                        <Text key={r.id} style={s.item} numberOfLines={1}>
                          <Text style={{ color: r.color }}>●</Text> {r.time} {r.title}
                        </Text>
                      ))}
                      {rs.length > 3 && <Text style={s.more}>+{rs.length - 3} más</Text>}
                    </Pressable>
                  );
                })}
              </View>
            ))}
            <Text style={s.hint}>Tocá un día para abrir su hoja · mantené presionado para agregar un recordatorio</Text>
          </View>
          <View style={day.spine}>
            <Rings count={9} />
          </View>
          <View style={[day.page, day.pageRight]}>
            <Title>🎯 Metas del mes</Title>
            <GoalList period={period} compact />
            <Title style={{ marginTop: 14 }}>✎ Notas del mes</Title>
            <View style={{ flex: 1 }}>
              <PaperBg paper="rayado" gap={28} margin={false} />
              <TextInput
                multiline
                style={day.notes}
                value={page.fields.notas ?? ''}
                onChangeText={(v) => setField('notas', v)}
                textAlignVertical="top"
              />
            </View>
          </View>
        </View>
      )}
    </InkPage>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: C.ink, marginLeft: 8 },
  weekHead: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: C.accent, marginBottom: 2 },
  weekHeadText: { flex: 1, textAlign: 'center', fontWeight: '800', color: C.accent },
  gridRow: { flex: 1, flexDirection: 'row' },
  cell: { flex: 1, borderWidth: 0.5, borderColor: C.line, padding: 3, overflow: 'hidden' },
  todayCell: { backgroundColor: '#FFF0D0', borderColor: C.accent, borderWidth: 1.5 },
  num: { fontWeight: '800', fontSize: 15, color: C.ink },
  hol: { fontSize: 9, color: C.holiday },
  item: { fontSize: 10, color: C.ink },
  more: { fontSize: 9, color: C.inkSoft },
  hint: { fontSize: 11, color: C.inkSoft, textAlign: 'center', marginTop: 4 },
  goal: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.line },
  goalText: { fontSize: 15, color: C.ink },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 },
  pm: { fontSize: 18, fontWeight: '800', color: C.accent, width: 20, textAlign: 'center' },
  bar: { flex: 1, height: 8, backgroundColor: '#EADFCB', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: C.ok },
  pct: { width: 40, fontSize: 12, color: C.inkSoft },
});
