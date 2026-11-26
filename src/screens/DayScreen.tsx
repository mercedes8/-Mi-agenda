import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApp } from '../AppState';
import { InkPage } from '../components/InkPage';
import { PaperBg, Rings } from '../components/PaperBg';
import { Spine, useFlip } from '../components/PageFlip';
import { pickDate } from '../components/pickers';
import { Check, IconBtn, LineInput, Title } from '../components/ui';
import { Task, useSetting } from '../db';
import {
  addDays, dayOfYear, daysInYear, DIAS, holidayOf, hm, isoWeek, MESES, moonOf, sameDay, ymd,
} from '../dates';
import { birthdaysOn, remindersOn, useContacts, useReminders } from '../occurs';
import { C } from '../theme';

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 07 a 22
const TASKS = 7;
const MOODS = ['😄', '🙂', '😐', '😕', '😢'];

export function DateNav({ step = 1, unit = 'day' }: { step?: number; unit?: 'day' | 'month' | 'year' }) {
  const { date, setDate } = useApp();
  const flip = useFlip();
  /** Cambia de fecha; si la pantalla lo permite, pasando la hoja con animación */
  const go = (d: Date) => {
    if (ymd(d) === ymd(date)) return;
    if (flip) flip(d > date ? 'next' : 'prev', () => setDate(d));
    else setDate(d);
  };
  const move = (n: number) => {
    if (unit === 'day') go(addDays(date, n * step));
    else if (unit === 'month') go(new Date(date.getFullYear(), date.getMonth() + n, 1));
    else go(new Date(date.getFullYear() + n, 0, 1));
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <IconBtn icon="◀" title="Anterior" onPress={() => move(-1)} />
      <Pressable onPress={() => go(new Date())} style={st.today}>
        <Text style={st.todayText}>Hoy</Text>
      </Pressable>
      <IconBtn icon="▶" title="Siguiente" onPress={() => move(1)} />
      <IconBtn icon="📅" title="Elegir fecha" onPress={() => pickDate(date, go)} />
    </View>
  );
}

export function DayScreen() {
  const { date, setDate, openReminder } = useApp();
  const [ownerName] = useSetting('ownerName', '');
  const reminders = remindersOn(useReminders(), date);
  const birthdays = birthdaysOn(useContacts(), date);
  const holiday = holidayOf(date);
  const moon = moonOf(date);
  const week = isoWeek(date);
  const doy = dayOfYear(date);
  const isToday = sameDay(date, new Date());
  const key = `day:${ymd(date)}`;
  const outOfRange = reminders.filter((r) => {
    const h = Number(r.time.slice(0, 2));
    return h < HOURS[0] || h > HOURS[HOURS.length - 1];
  });

  return (
    <InkPage
      pageKey={key}
      turn={(d) => setDate(addDays(date, d === 'next' ? 1 : -1))}
      left={<DateNav />}
      right={
        <IconBtn icon="🔔" title="Nuevo recordatorio" onPress={() => openReminder({ date: ymd(date), time: '09:00' })} />
      }
      pageStyle={st.desk}
    >
      {({ page, update, setField }) => {
        const tasks: Task[] = Array.from({ length: TASKS }, (_, i) => page.tasks[i] ?? { t: '', d: false });
        const setTask = (i: number, t: Partial<Task>) =>
          update((p) => {
            const arr = Array.from({ length: TASKS }, (_, j) => p.tasks[j] ?? { t: '', d: false });
            arr[i] = { ...arr[i], ...t };
            return { ...p, tasks: arr };
          });
        const water = Number(page.fields.agua || 0);
        return (
          <View style={st.spread}>
            {/* ---------- Página izquierda: horario ---------- */}
            <View style={[st.page, st.pageLeft]}>
              <View style={st.header}>
                <Text style={[st.bigDay, holiday && { color: C.holiday }, date.getDay() === 0 && { color: C.holiday }]}>
                  {date.getDate()}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={st.weekday}>
                    {DIAS[date.getDay()]} {isToday && <Text style={st.todayBadge}> HOY </Text>}
                  </Text>
                  <Text style={st.month}>
                    {MESES[date.getMonth()]} {date.getFullYear()}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={st.meta}>
                    {moon.emoji} {moon.name ?? ''}
                  </Text>
                  <Text style={st.meta}>Semana {week.week}</Text>
                  <Text style={st.meta}>
                    Día {doy} · faltan {daysInYear(date.getFullYear()) - doy}
                  </Text>
                </View>
              </View>
              {holiday && <Text style={st.holiday}>🇦🇷 Feriado: {holiday}</Text>}
              {birthdays.length > 0 && (
                <Text style={st.bday}>🎂 Cumpleaños: {birthdays.map((b) => b.name).join(', ')}</Text>
              )}
              {outOfRange.length > 0 && (
                <Text style={st.meta}>
                  Otros horarios: {outOfRange.map((r) => `${r.time} ${r.title}`).join(' · ')}
                </Text>
              )}
              <View style={{ flex: 1 }}>
                {HOURS.map((h) => {
                  const k = `h${String(h).padStart(2, '0')}`;
                  const rs = reminders.filter((r) => Number(r.time.slice(0, 2)) === h);
                  return (
                    <View key={h} style={st.hourRow}>
                      <Pressable onPress={() => openReminder({ date: ymd(date), time: hm(h, 0) })} style={st.hourLabel}>
                        <Text style={st.hourText}>{hm(h, 0)}</Text>
                      </Pressable>
                      <TextInput
                        style={st.hourInput}
                        value={page.fields[k] ?? ''}
                        onChangeText={(v) => setField(k, v)}
                        placeholderTextColor="#C8BFB0"
                      />
                      {rs.map((r) => (
                        <Pressable
                          key={r.id}
                          onPress={() => openReminder({ ...r })}
                          style={[st.remChip, { backgroundColor: r.color + '33', borderColor: r.color }, r.done ? { opacity: 0.45 } : null]}
                        >
                          <Text style={st.remChipText} numberOfLines={1}>
                            🔔 {r.time} {r.title}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  );
                })}
              </View>
            </View>

            <Spine style={st.spine}>
              <Rings count={9} />
            </Spine>

            {/* ---------- Página derecha ---------- */}
            <View style={[st.page, st.pageRight]}>
              <Title>★ Prioridades</Title>
              {[1, 2, 3].map((n) => (
                <View key={n} style={st.row}>
                  <Text style={st.num}>{n}.</Text>
                  <LineInput style={{ flex: 1 }} value={page.fields[`p${n}`] ?? ''} onChangeText={(v) => setField(`p${n}`, v)} />
                </View>
              ))}

              <Title style={{ marginTop: 10 }}>✓ Tareas</Title>
              {tasks.map((t, i) => (
                <View key={i} style={st.row}>
                  <Check checked={t.d} onPress={() => setTask(i, { d: !t.d })} />
                  <LineInput
                    style={[{ flex: 1, marginLeft: 8 }, t.d && st.doneText]}
                    value={t.t}
                    onChangeText={(v) => setTask(i, { t: v })}
                  />
                </View>
              ))}

              <Title style={{ marginTop: 10 }}>✎ Notas</Title>
              <View style={st.notesBox}>
                <PaperBg paper="rayado" gap={28} margin={false} />
                <TextInput
                  multiline
                  style={st.notes}
                  value={page.fields.notas ?? ''}
                  onChangeText={(v) => setField('notas', v)}
                  textAlignVertical="top"
                />
              </View>

              <View style={st.trackers}>
                <View style={{ flex: 1 }}>
                  <Text style={st.trackTitle}>Agua</Text>
                  <View style={{ flexDirection: 'row' }}>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Pressable key={i} onPress={() => setField('agua', String(water === i + 1 ? i : i + 1))}>
                        <Text style={[st.glass, i >= water && { opacity: 0.25 }]}>💧</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View>
                  <Text style={st.trackTitle}>Ánimo</Text>
                  <View style={{ flexDirection: 'row' }}>
                    {MOODS.map((m) => (
                      <Pressable key={m} onPress={() => setField('animo', page.fields.animo === m ? '' : m)}>
                        <Text style={[st.glass, page.fields.animo !== m && { opacity: 0.3 }]}>{m}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
              <View style={st.row}>
                <Text style={st.trackTitle}>Agradezco: </Text>
                <LineInput style={{ flex: 1 }} value={page.fields.gratitud ?? ''} onChangeText={(v) => setField('gratitud', v)} />
              </View>
              {ownerName ? <Text style={st.owner}>Agenda de {ownerName}</Text> : null}
            </View>
          </View>
        );
      }}
    </InkPage>
  );
}

export const st = StyleSheet.create({
  desk: { backgroundColor: C.desk, padding: 14 },
  spread: { flex: 1, flexDirection: 'row' },
  page: {
    flex: 1, backgroundColor: C.paper, paddingHorizontal: 18, paddingVertical: 12,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  pageLeft: { borderTopLeftRadius: 8, borderBottomLeftRadius: 8, marginRight: 0 },
  pageRight: { borderTopRightRadius: 8, borderBottomRightRadius: 8 },
  spine: { width: 10, backgroundColor: C.paperShade, zIndex: 2 },
  header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: C.accent, paddingBottom: 4 },
  bigDay: { fontSize: 54, fontWeight: '900', color: C.ink, marginRight: 12, lineHeight: 58 },
  weekday: { fontSize: 22, fontWeight: '700', color: C.ink },
  todayBadge: { backgroundColor: C.accent, color: '#fff', fontSize: 13, fontWeight: '800' },
  month: { fontSize: 15, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 1 },
  meta: { fontSize: 12, color: C.inkSoft },
  holiday: { color: C.holiday, fontWeight: '700', marginTop: 4 },
  bday: { color: '#8E44AD', fontWeight: '700', marginTop: 2 },
  hourRow: { flex: 1, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.line },
  hourLabel: { width: 54, borderRightWidth: 1.5, borderRightColor: C.margin, height: '100%', justifyContent: 'center' },
  hourText: { color: C.accent, fontWeight: '700', fontSize: 13 },
  hourInput: { flex: 1, fontSize: 15, color: C.ink, paddingVertical: 0, paddingHorizontal: 8 },
  remChip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 4, maxWidth: 170 },
  remChipText: { fontSize: 11, color: C.ink },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  num: { width: 22, color: C.accent, fontWeight: '800', fontSize: 16 },
  doneText: { textDecorationLine: 'line-through', color: C.inkSoft },
  notesBox: { flex: 1, minHeight: 60, borderRadius: 4, overflow: 'hidden' },
  notes: { flex: 1, fontSize: 16, lineHeight: 28, color: C.ink, paddingTop: 4, paddingHorizontal: 4 },
  trackers: { flexDirection: 'row', marginTop: 6, gap: 12 },
  trackTitle: { fontSize: 12, fontWeight: '800', color: C.accent, textTransform: 'uppercase' },
  glass: { fontSize: 22, marginRight: 2 },
  today: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.accent, borderRadius: 8, marginHorizontal: 2 },
  todayText: { color: '#fff', fontWeight: '800' },
  owner: { fontSize: 11, color: C.inkSoft, fontStyle: 'italic', textAlign: 'right', marginTop: 2, marginRight: 30 },
});
