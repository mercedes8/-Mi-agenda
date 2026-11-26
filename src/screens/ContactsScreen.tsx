import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Btn, Empty, Field, Sheet, Title } from '../components/ui';
import { first, run } from '../db';
import { MESES } from '../dates';
import { Contact, scheduleBirthday } from '../notifications';
import { useContacts } from '../occurs';
import { C } from '../theme';

const blank = { name: '', phone: '', email: '', address: '', day: '', month: '', year: '', notes: '' };

function daysUntil(c: Contact) {
  if (!c.bday_day || !c.bday_month) return 9999;
  const t = new Date();
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  let next = new Date(t.getFullYear(), c.bday_month - 1, c.bday_day);
  if (next < today) next = new Date(t.getFullYear() + 1, c.bday_month - 1, c.bday_day);
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

export function ContactsScreen() {
  const contacts = useContacts();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<number | null>(null);
  const [f, setF] = useState(blank);

  useEffect(() => {
    const c = contacts.find((x) => x.id === sel);
    setF(
      c
        ? {
            name: c.name, phone: c.phone, email: c.email, address: c.address, notes: c.notes,
            day: c.bday_day ? String(c.bday_day) : '', month: c.bday_month ? String(c.bday_month) : '',
            year: c.bday_year ? String(c.bday_year) : '',
          }
        : blank,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  const filtered = contacts.filter((c) => (c.name + c.phone + c.email).toLowerCase().includes(q.toLowerCase()));
  const upcoming = useMemo(
    () => contacts.filter((c) => daysUntil(c) <= 30).sort((a, b) => daysUntil(a) - daysUntil(b)),
    [contacts],
  );

  const save = async () => {
    if (!f.name.trim()) return Alert.alert('Falta el nombre');
    const d = Number(f.day) || null, m = Number(f.month) || null, y = Number(f.year) || null;
    if ((d && (d < 1 || d > 31)) || (m && (m < 1 || m > 12))) return Alert.alert('Fecha de cumpleaños inválida');
    const vals = [f.name.trim(), f.phone, f.email, f.address, d, m, y, f.notes];
    let id = sel;
    if (id) run('UPDATE contacts SET name=?, phone=?, email=?, address=?, bday_day=?, bday_month=?, bday_year=?, notes=? WHERE id=?', [...vals, id]);
    else id = run('INSERT INTO contacts (name, phone, email, address, bday_day, bday_month, bday_year, notes) VALUES (?,?,?,?,?,?,?,?)', vals).lastInsertRowId;
    const c = first<Contact>('SELECT * FROM contacts WHERE id=?', [id!]);
    if (c) await scheduleBirthday(c);
    setSel(id);
  };
  const remove = () =>
    Alert.alert('Eliminar contacto', `¿Eliminar a ${f.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const c = contacts.find((x) => x.id === sel);
          if (c) await scheduleBirthday({ ...c, bday_day: null, bday_month: null });
          run('DELETE FROM contacts WHERE id=?', [sel!]);
          setSel(null);
        },
      },
    ]);
  const up = (k: keyof typeof blank) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  return (
    <View style={s.wrap}>
      <Sheet style={s.left}>
        <Title style={{ fontSize: 20 }}>📇 Contactos</Title>
        <TextInput style={s.search} placeholder="🔎 Buscar…" value={q} onChangeText={setQ} placeholderTextColor="#B8AFA2" />
        <Btn small label="＋ Nuevo contacto" onPress={() => setSel(null)} style={{ marginBottom: 6 }} />
        <FlatList
          data={filtered}
          keyExtractor={(c) => String(c.id)}
          ListEmptyComponent={<Empty text="Todavía no cargaste contactos." />}
          renderItem={({ item: c, index }) => {
            const letter = c.name[0]?.toUpperCase();
            const showLetter = index === 0 || filtered[index - 1].name[0]?.toUpperCase() !== letter;
            return (
              <View>
                {showLetter && <Text style={s.letter}>{letter}</Text>}
                <Pressable style={[s.item, sel === c.id && { backgroundColor: C.accentSoft }]} onPress={() => setSel(c.id)}>
                  <Text style={s.itemName}>{c.name}</Text>
                  {c.phone ? <Text style={s.itemSub}>{c.phone}</Text> : null}
                </Pressable>
              </View>
            );
          }}
        />
      </Sheet>
      <Sheet style={s.right}>
        <ScrollView keyboardShouldPersistTaps="handled">
          {upcoming.length > 0 && (
            <View style={s.bdBox}>
              <Text style={s.bdTitle}>🎂 Próximos cumpleaños</Text>
              {upcoming.map((c) => {
                const n = daysUntil(c);
                return (
                  <Text key={c.id} style={s.bdItem}>
                    {c.bday_day} de {MESES[c.bday_month! - 1]} — {c.name} {n === 0 ? '¡HOY!' : `(en ${n} días)`}
                  </Text>
                );
              })}
            </View>
          )}
          <Title>{sel ? 'Editar contacto' : 'Nuevo contacto'}</Title>
          <Field label="Nombre y apellido" value={f.name} onChangeText={up('name')} />
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Field label="Teléfono" value={f.phone} onChangeText={up('phone')} keyboardType="phone-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Email" value={f.email} onChangeText={up('email')} keyboardType="email-address" autoCapitalize="none" />
            </View>
          </View>
          <Field label="Dirección" value={f.address} onChangeText={up('address')} />
          <Text style={s.label}>Cumpleaños (suena un aviso ese día a las 9:00)</Text>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Field label="Día" value={f.day} onChangeText={up('day')} keyboardType="number-pad" maxLength={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Mes (1-12)" value={f.month} onChangeText={up('month')} keyboardType="number-pad" maxLength={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Año (opcional)" value={f.year} onChangeText={up('year')} keyboardType="number-pad" maxLength={4} />
            </View>
          </View>
          <Field label="Notas" value={f.notes} onChangeText={up('notes')} multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
          <View style={[s.row, { marginTop: 6 }]}>
            {sel && f.phone ? <Btn outline label="📞 Llamar" onPress={() => Linking.openURL(`tel:${f.phone}`)} /> : null}
            {sel && f.phone ? (
              <Btn outline label="💬 WhatsApp" onPress={() => Linking.openURL(`https://wa.me/${f.phone.replace(/\D/g, '')}`)} />
            ) : null}
            {sel && f.email ? <Btn outline label="✉️ Email" onPress={() => Linking.openURL(`mailto:${f.email}`)} /> : null}
            <View style={{ flex: 1 }} />
            {sel && <Btn outline color={C.danger} label="Eliminar" onPress={remove} />}
            <Btn label="Guardar" onPress={save} />
          </View>
        </ScrollView>
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row', backgroundColor: C.desk, padding: 14, gap: 12 },
  left: { width: 320 },
  right: { flex: 1 },
  search: { borderWidth: 1, borderColor: '#DDD2BF', borderRadius: 8, padding: 8, marginVertical: 8, backgroundColor: '#fff', fontSize: 15 },
  letter: { fontWeight: '900', color: C.accent, fontSize: 16, marginTop: 6, borderBottomWidth: 1, borderBottomColor: C.accent },
  item: { paddingVertical: 8, paddingHorizontal: 6, borderRadius: 6 },
  itemName: { fontSize: 16, color: C.ink, fontWeight: '600' },
  itemSub: { fontSize: 12, color: C.inkSoft },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  label: { fontSize: 12, color: C.inkSoft, fontWeight: '600', marginBottom: 4 },
  bdBox: { backgroundColor: '#F6EAF8', borderRadius: 8, padding: 10, marginBottom: 12 },
  bdTitle: { fontWeight: '800', color: '#8E44AD', marginBottom: 4 },
  bdItem: { color: C.ink },
});
