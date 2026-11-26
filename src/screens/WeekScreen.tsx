import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApp } from '../AppState';
import { InkPage } from '../components/InkPage';
import { Spine } from '../components/PageFlip';
import { Rings } from '../components/PaperBg';
import { pageFields, useDbVersion } from '../db';
import { addDays, DIAS, holidayOf, isoWeek, MESES, sameDay, startOfWeek, weekKey, ymd } from '../dates';
import { birthdaysOn, remindersOn, useContacts, useReminders } from '../occurs';
import { C } from '../theme';
import { DateNav, st as day } from './DayScreen';

export function WeekScreen() {
  const { date, setDate, goToDay, openReminder } = useApp();
  useDbVersion();
  const start = startOfWeek(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const end = days[6];
  const reminders = useReminders();
  const contacts = useContacts();
  const w = isoWeek(date);
  const title =
    start.getMonth() === end.getMonth()
      ? `${start.getDate()} al ${end.getDate()} de ${MESES[start.getMonth()]}`
      : `${start.getDate()} ${MESES[start.getMonth()].slice(0, 3)} al ${end.getDate()} ${MESES[end.getMonth()].slice(0, 3)}`;

  return (
    <InkPage
      pageKey={`week:${weekKey(date)}`}
      turn={(d) => setDate(addDays(date, d === 'next' ? 7 : -7))}
      left={
        <>
          <DateNav step={7} />
          <Text style={s.title}>
            Semana {w.week} · {title}
          </Text>
        </>
      }
      pageStyle={day.desk}
    >
      {({ page, setField }) => {
        const box = (d: Date, i: number) => {
          const rs = remindersOn(reminders, d);
          const bs = birthdaysOn(contacts, d);
          const hol = holidayOf(d);
          const f = pageFields(`day:${ymd(d)}`);
          const today = sameDay(d, new Date());
          return (
            <View key={i} style={[s.box, today && { backgroundColor: '#FFF3DC' }]}>
              <Pressable onPress={() => goToDay(d)} style={s.boxHead}>
                <Text style={[s.boxDay, (hol || d.getDay() === 0) && { color: C.holiday }]}>{d.getDate()}</Text>
                <Text style={s.boxName}>{DIAS[d.getDay()]}</Text>
                <Pressable onPress={() => openReminder({ date: ymd(d), time: '09:00' })} hitSlop={6}>
                  <Text>＋🔔</Text>
                </Pressable>
              </Pressable>
              <ScrollView style={{ maxHeight: 74 }}>
                {hol && <Text style={s.hol}>🇦🇷 {hol}</Text>}
                {bs.map((b) => (
                  <Text key={b.id} style={s.bd}>
                    🎂 {b.name}
                  </Text>
                ))}
                {f.p1 ? <Text style={s.item}>★ {f.p1}</Text> : null}
                {rs.map((r) => (
                  <Text key={r.id} style={[s.item, r.done ? { textDecorationLine: 'line-through' } : null]} onPress={() => openReminder({ ...r })}>
                    <Text style={{ color: r.color }}>●</Text> {r.time} {r.title}
                  </Text>
                ))}
              </ScrollView>
              <TextInput
                multiline
                style={s.input}
                value={page.fields[`d${i}`] ?? ''}
                onChangeText={(v) => setField(`d${i}`, v)}
                textAlignVertical="top"
              />
            </View>
          );
        };
        return (
          <View style={day.spread}>
            <View style={[day.page, day.pageLeft, s.col]}>
              {days.slice(0, 3).map((d, i) => box(d, i))}
              <View style={[s.box, { flex: 1 }]}>
                <Text style={s.goalTitle}>🎯 Objetivos de la semana</Text>
                <TextInput
                  multiline
                  style={s.input}
                  value={page.fields.objetivos ?? ''}
                  onChangeText={(v) => setField('objetivos', v)}
                  textAlignVertical="top"
                  placeholder="1. …"
                  placeholderTextColor="#C8BFB0"
                />
              </View>
            </View>
            <Spine style={day.spine}>
              <Rings count={9} />
            </Spine>
            <View style={[day.page, day.pageRight, s.col]}>{days.slice(3).map((d, i) => box(d, i + 3))}</View>
          </View>
        );
      }}
    </InkPage>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '700', color: C.ink, marginLeft: 8 },
  col: { gap: 6, paddingVertical: 10 },
  box: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 4, padding: 6 },
  boxHead: { flexDirection: 'row', alignItems: 'baseline', borderBottomWidth: 1, borderBottomColor: C.accent, marginBottom: 2 },
  boxDay: { fontSize: 22, fontWeight: '900', color: C.ink, marginRight: 8 },
  boxName: { flex: 1, fontSize: 14, fontWeight: '700', color: C.inkSoft, textTransform: 'uppercase' },
  hol: { color: C.holiday, fontSize: 12, fontWeight: '700' },
  bd: { color: '#8E44AD', fontSize: 12 },
  item: { fontSize: 12, color: C.ink },
  input: { flex: 1, fontSize: 14, color: C.ink, padding: 2 },
  goalTitle: { fontWeight: '800', color: C.accent },
});
