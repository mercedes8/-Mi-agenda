import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../AppState';
import { usePage } from '../components/InkPage';
import { LineInput, Sheet, Title } from '../components/ui';
import { MESES, ym } from '../dates';
import { C } from '../theme';
import { DateNav } from './DayScreen';
import { GoalList } from './MonthScreen';

const AREAS = ['Salud', 'Trabajo', 'Dinero', 'Familia', 'Amigos', 'Aprendizaje', 'Ocio', 'Hogar'];

export function GoalsScreen() {
  const { date } = useApp();
  const y = String(date.getFullYear());
  const { page, setField } = usePage(`year:${y}`);

  return (
    <View style={{ flex: 1 }}>
      <View style={s.bar}>
        <DateNav unit="month" />
        <Text style={s.title}>Metas y objetivos</Text>
      </View>
      <View style={s.wrap}>
        <Sheet style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Title style={{ fontSize: 20 }}>🏔 Año {y}</Title>
            <Text style={s.label}>Mi palabra / intención del año</Text>
            <LineInput value={page.fields.palabra ?? ''} onChangeText={(v) => setField('palabra', v)} style={{ fontSize: 20, fontWeight: '700' }} />
            <Text style={[s.label, { marginTop: 12 }]}>Metas del año</Text>
            <GoalList period={y} />
            <Title style={{ marginTop: 18 }}>Por área de mi vida</Title>
            {AREAS.map((a) => (
              <View key={a} style={s.area}>
                <Text style={s.areaName}>{a}</Text>
                <LineInput style={{ flex: 1 }} value={page.fields[`area_${a}`] ?? ''} onChangeText={(v) => setField(`area_${a}`, v)} />
              </View>
            ))}
          </ScrollView>
        </Sheet>
        <Sheet style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Title style={{ fontSize: 20 }}>🗓 {MESES[date.getMonth()]} {y}</Title>
            <GoalList period={ym(date)} />
            <Title style={{ marginTop: 18 }}>Reflexión del mes</Title>
            {[
              ['logros', '¿Qué logré?'],
              ['aprendi', '¿Qué aprendí?'],
              ['mejorar', '¿Qué quiero mejorar?'],
            ].map(([k, l]) => (
              <View key={k} style={{ marginBottom: 8 }}>
                <Text style={s.label}>{l}</Text>
                <LineInput
                  multiline
                  value={page.fields[`${ym(date)}_${k}`] ?? ''}
                  onChangeText={(v) => setField(`${ym(date)}_${k}`, v)}
                />
              </View>
            ))}
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
  wrap: { flex: 1, flexDirection: 'row', backgroundColor: C.desk, padding: 14, gap: 12 },
  label: { fontSize: 12, color: C.inkSoft, fontWeight: '700', textTransform: 'uppercase' },
  area: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  areaName: { width: 110, fontWeight: '700', color: C.accent },
});
