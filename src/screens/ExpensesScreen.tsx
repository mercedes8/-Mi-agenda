import React, { useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, ToastAndroid, View } from 'react-native';
import { useApp } from '../AppState';
import { pickDate } from '../components/pickers';
import { Btn, Chip, Empty, Field, Sheet, Title } from '../components/ui';
import { run, useQuery } from '../db';
import { MESES, parseYmd, ym, ymd } from '../dates';
import { C } from '../theme';
import { DateNav } from './DayScreen';

type Exp = { id: number; date: string; kind: 'gasto' | 'ingreso'; category: string; description: string; amount: number };

const CAT_GASTO = ['Súper', 'Comida', 'Casa', 'Servicios', 'Transporte', 'Salud', 'Ropa', 'Ocio', 'Educación', 'Regalos', 'Otros'];
const CAT_INGRESO = ['Sueldo', 'Trabajos', 'Ventas', 'Otros'];

export const money = (n: number) =>
  '$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Acepta 1500, 1500,50, 1.500,50 y 1500.50 */
function parseAmount(t: string): number {
  const x = t.replace(/[^\d.,]/g, '');
  const lastC = x.lastIndexOf(','), lastD = x.lastIndexOf('.');
  const sep = Math.max(lastC, lastD);
  if (sep < 0) return Number(x);
  const dec = x.slice(sep + 1);
  const intp = x.slice(0, sep).replace(/[.,]/g, '');
  const onlyOne = (x.match(/[.,]/g) ?? []).length === 1;
  if (onlyOne && dec.length === 3) return Number(intp + dec); // 1.500 = mil quinientos
  return Number(intp + '.' + dec);
}

export function ExpensesScreen() {
  const { date, setDate } = useApp();
  const period = ym(date);
  const rows = useQuery<Exp>("SELECT * FROM expenses WHERE substr(date,1,7)=? ORDER BY date DESC, id DESC", [period]);
  const [kind, setKind] = useState<'gasto' | 'ingreso'>('gasto');
  const [cat, setCat] = useState('Súper');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState(() => ymd(new Date()));

  const totalIn = rows.filter((r) => r.kind === 'ingreso').reduce((a, r) => a + r.amount, 0);
  const totalOut = rows.filter((r) => r.kind === 'gasto').reduce((a, r) => a + r.amount, 0);
  const byCat: Record<string, number> = {};
  rows.filter((r) => r.kind === 'gasto').forEach((r) => (byCat[r.category] = (byCat[r.category] ?? 0) + r.amount));
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const max = cats[0]?.[1] ?? 1;

  const add = () => {
    const n = parseAmount(amount);
    if (!n || n <= 0) return Alert.alert('Monto inválido', 'Escribí un monto mayor a cero (podés usar coma para decimales).');
    run('INSERT INTO expenses (date, kind, category, description, amount) VALUES (?,?,?,?,?)', [day, kind, cat, desc.trim(), n]);
    setDesc('');
    setAmount('');
    // si el movimiento es de otro mes, mostramos ese mes para que se vea
    if (ym(parseYmd(day)) !== period) setDate(parseYmd(day));
    ToastAndroid.show(`${kind === 'gasto' ? 'Gasto' : 'Ingreso'} anotado: ${money(n)}`, ToastAndroid.SHORT);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={s.bar}>
        <DateNav unit="month" />
        <Text style={s.title}>
          Finanzas · {MESES[date.getMonth()]} {date.getFullYear()}
        </Text>
      </View>
      <View style={s.wrap}>
        <Sheet style={{ width: 380 }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Title>Nuevo movimiento</Title>
            <View style={s.wrapRow}>
              <Chip label="➖ Gasto" active={kind === 'gasto'} color={C.danger} onPress={() => { setKind('gasto'); setCat(CAT_GASTO[0]); }} />
              <Chip label="➕ Ingreso" active={kind === 'ingreso'} color={C.ok} onPress={() => { setKind('ingreso'); setCat(CAT_INGRESO[0]); }} />
            </View>
            <Btn outline small label={`📅 ${parseYmd(day).toLocaleDateString('es-AR')}`} onPress={() => pickDate(parseYmd(day), (d) => setDay(ymd(d)))} style={{ alignSelf: 'flex-start', marginBottom: 8 }} />
            <View style={s.wrapRow}>
              {(kind === 'gasto' ? CAT_GASTO : CAT_INGRESO).map((c) => (
                <Chip key={c} label={c} active={cat === c} onPress={() => setCat(c)} />
              ))}
            </View>
            <Field label="Descripción" value={desc} onChangeText={setDesc} placeholder="Ej: verdulería" />
            <Field label="Monto ($)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" onSubmitEditing={add} />
            <Btn label="Anotar" onPress={add} color={kind === 'gasto' ? C.danger : C.ok} />

            <View style={s.totals}>
              <Text style={[s.tot, { color: C.ok }]}>Ingresos: {money(totalIn)}</Text>
              <Text style={[s.tot, { color: C.danger }]}>Gastos: {money(totalOut)}</Text>
              <Text style={[s.tot, { fontSize: 18 }]}>Saldo: {money(totalIn - totalOut)}</Text>
            </View>
            {cats.length > 0 && <Title style={{ marginTop: 10 }}>Gastos por categoría</Title>}
            {cats.map(([c, v]) => (
              <View key={c} style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 13, color: C.ink }}>
                  {c} · {money(v)} ({Math.round((v / (totalOut || 1)) * 100)}%)
                </Text>
                <View style={s.barBg}>
                  <View style={[s.barFill, { width: `${(v / max) * 100}%` }]} />
                </View>
              </View>
            ))}
          </ScrollView>
        </Sheet>
        <Sheet style={{ flex: 1 }}>
          <Title>Movimientos del mes</Title>
          <FlatList
            data={rows}
            keyExtractor={(r) => String(r.id)}
            ListEmptyComponent={<Empty text="No hay movimientos este mes." />}
            renderItem={({ item: r }) => (
              <Pressable
                style={s.item}
                onLongPress={() =>
                  Alert.alert('Eliminar movimiento', `${r.description || r.category} ${money(r.amount)}`, [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Eliminar', style: 'destructive', onPress: () => run('DELETE FROM expenses WHERE id=?', [r.id]) },
                  ])
                }
              >
                <Text style={s.itemDate}>{r.date.slice(8)}/{r.date.slice(5, 7)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemDesc}>{r.description || r.category}</Text>
                  <Text style={s.itemCat}>{r.category}</Text>
                </View>
                <Text style={[s.itemAmt, { color: r.kind === 'gasto' ? C.danger : C.ok }]}>
                  {r.kind === 'gasto' ? '−' : '+'} {money(r.amount)}
                </Text>
              </Pressable>
            )}
          />
          <Text style={{ fontSize: 11, color: C.inkSoft }}>Mantené presionado un movimiento para eliminarlo</Text>
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
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  totals: { marginTop: 14, padding: 10, backgroundColor: '#F6EFE0', borderRadius: 8, gap: 2 },
  tot: { fontSize: 15, fontWeight: '800', color: C.ink },
  barBg: { height: 8, backgroundColor: '#EADFCB', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: C.accent },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line, gap: 12 },
  itemDate: { width: 48, fontWeight: '700', color: C.accent },
  itemDesc: { fontSize: 16, color: C.ink },
  itemCat: { fontSize: 12, color: C.inkSoft },
  itemAmt: { fontSize: 16, fontWeight: '800' },
});
