import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../AppState';
import { DIAS_CORTOS, holidayOf, MESES, monthMatrix, sameDay } from '../dates';
import { birthdaysOn, remindersOn, useContacts, useReminders } from '../occurs';
import { C } from '../theme';
import { DateNav, st as day } from './DayScreen';

export function YearScreen() {
  const { date, setDate, setSection, goToDay } = useApp();
  const year = date.getFullYear();
  const reminders = useReminders();
  const contacts = useContacts();
  const today = new Date();

  return (
    <View style={{ flex: 1 }}>
      <View style={s.bar}>
        <DateNav unit="year" />
        <Text style={s.title}>Año {year}</Text>
        <Text style={s.legend}>  ● recordatorio   🎂 cumpleaños   rojo = feriado</Text>
      </View>
      <View style={[day.desk, { flex: 1 }]}>
        <View style={[day.page, { borderRadius: 8, flexDirection: 'row', flexWrap: 'wrap', padding: 8 }]}>
          {MESES.map((m, mi) => (
            <View key={m} style={s.month}>
              <Pressable
                onPress={() => {
                  setDate(new Date(year, mi, 1));
                  setSection('mes');
                }}
              >
                <Text style={s.monthName}>{m}</Text>
              </Pressable>
              <View style={s.row}>
                {DIAS_CORTOS.map((d) => (
                  <Text key={d} style={s.wd}>
                    {d[0]}
                  </Text>
                ))}
              </View>
              {monthMatrix(year, mi).map((row, ri) => (
                <View key={ri} style={s.row}>
                  {row.map((d, ci) => {
                    if (!d) return <View key={ci} style={s.day} />;
                    const has = remindersOn(reminders, d).length > 0;
                    const bd = birthdaysOn(contacts, d).length > 0;
                    const hol = !!holidayOf(d) || ci === 6;
                    const isToday = sameDay(d, today);
                    return (
                      <Pressable key={ci} style={[s.day, isToday && s.today]} onPress={() => goToDay(d)}>
                        <Text style={[s.dayText, hol && { color: C.holiday }, isToday && { color: '#fff' }]}>
                          {d.getDate()}
                        </Text>
                        <Text style={s.mark}>{bd ? '🎂' : has ? '●' : ' '}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          ))}
        </View>
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
  legend: { fontSize: 12, color: C.inkSoft },
  month: { width: '25%', height: '33.3%', padding: 6 },
  monthName: { fontWeight: '800', color: C.accent, textTransform: 'uppercase', marginBottom: 2 },
  row: { flexDirection: 'row', flex: 1 },
  wd: { flex: 1, textAlign: 'center', fontSize: 10, color: C.inkSoft, fontWeight: '700' },
  day: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  today: { backgroundColor: C.accent, borderRadius: 10 },
  dayText: { fontSize: 11, color: C.ink, fontWeight: '600' },
  mark: { fontSize: 6, color: C.accent, lineHeight: 7 },
});
