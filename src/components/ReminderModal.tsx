import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../AppState';
import { first, run } from '../db';
import { hm, longDate, parseYmd, ymd } from '../dates';
import {
  ADVANCE_OPTIONS, cancelReminder, Reminder, REPEAT_LABEL, Repeat, scheduleReminder,
} from '../notifications';
import { C, TAB_COLORS } from '../theme';
import { pickDate, pickTime } from './pickers';
import { Btn, Chip, Field, Sheet, Title } from './ui';

export function ReminderModal() {
  const { reminderDraft, closeReminder } = useApp();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(ymd(new Date()));
  const [time, setTime] = useState('09:00');
  const [repeat, setRepeat] = useState<Repeat>('none');
  const [advance, setAdvance] = useState(0);
  const [color, setColor] = useState<string>(C.accent);

  useEffect(() => {
    if (!reminderDraft) return;
    setTitle(reminderDraft.title ?? '');
    setNotes(reminderDraft.notes ?? '');
    setDate(reminderDraft.date);
    setTime(reminderDraft.time ?? '09:00');
    setRepeat((reminderDraft.repeat as Repeat) ?? 'none');
    setAdvance(reminderDraft.advance ?? 0);
    setColor(reminderDraft.color ?? C.accent);
  }, [reminderDraft]);

  if (!reminderDraft) return null;
  const editing = !!reminderDraft.id;
  const [hh, mm] = time.split(':').map(Number);
  const timeDate = new Date(2000, 0, 1, hh, mm);

  const save = async () => {
    if (!title.trim()) {
      Alert.alert('Falta el título', 'Escribí qué querés recordar.');
      return;
    }
    let id = reminderDraft.id;
    if (id) {
      run('UPDATE reminders SET title=?, notes=?, date=?, time=?, repeat=?, advance=?, color=?, done=0 WHERE id=?', [
        title.trim(), notes, date, time, repeat, advance, color, id,
      ]);
    } else {
      id = run('INSERT INTO reminders (title, notes, date, time, repeat, advance, color) VALUES (?,?,?,?,?,?,?)', [
        title.trim(), notes, date, time, repeat, advance, color,
      ]).lastInsertRowId;
    }
    const r = first<Reminder>('SELECT * FROM reminders WHERE id=?', [id!]);
    if (r) {
      const ids = await scheduleReminder(r);
      if (!ids.length && repeat === 'none') {
        Alert.alert('Guardado', 'El recordatorio quedó anotado, pero la hora ya pasó así que no va a sonar.');
      }
    }
    closeReminder();
  };

  const remove = () =>
    Alert.alert('Eliminar recordatorio', '¿Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const r = first<Reminder>('SELECT * FROM reminders WHERE id=?', [reminderDraft.id!]);
          if (r) await cancelReminder(r);
          run('DELETE FROM reminders WHERE id=?', [reminderDraft.id!]);
          closeReminder();
        },
      },
    ]);

  return (
    <Modal transparent animationType="fade" visible onRequestClose={closeReminder}>
      <View style={st.backdrop}>
        <Sheet style={st.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Title>{editing ? '🔔 Editar recordatorio' : '🔔 Nuevo recordatorio'}</Title>
            <Field label="¿Qué hay que recordar?" value={title} onChangeText={setTitle} placeholder="Ej: Turno con el médico" autoFocus={!editing} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 2 }}>
                <Text style={st.label}>Día</Text>
                <Btn outline label={`📅 ${longDate(parseYmd(date))}`} onPress={() => pickDate(parseYmd(date), (d) => setDate(ymd(d)))} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.label}>Hora</Text>
                <Btn outline label={`⏰ ${time}`} onPress={() => pickTime(timeDate, (d) => setTime(hm(d.getHours(), d.getMinutes())))} />
              </View>
            </View>
            <Text style={[st.label, { marginTop: 12 }]}>Repetir</Text>
            <View style={st.wrap}>
              {(Object.keys(REPEAT_LABEL) as Repeat[]).map((r) => (
                <Chip key={r} label={REPEAT_LABEL[r]} active={repeat === r} onPress={() => setRepeat(r)} />
              ))}
            </View>
            <Text style={st.label}>Avisar</Text>
            <View style={st.wrap}>
              {ADVANCE_OPTIONS.map(([v, l]) => (
                <Chip key={v} label={l} active={advance === v} onPress={() => setAdvance(v)} />
              ))}
            </View>
            <Text style={st.label}>Color</Text>
            <View style={[st.wrap, { marginBottom: 8 }]}>
              {[C.accent, ...TAB_COLORS.slice(0, 8)].map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={[st.swatch, { backgroundColor: c }, color === c && st.swatchActive]}
                />
              ))}
            </View>
            <Field label="Notas" value={notes} onChangeText={setNotes} multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
            <View style={st.actions}>
              {editing && <Btn label="Eliminar" color={C.danger} outline onPress={remove} />}
              <View style={{ flex: 1 }} />
              <Btn label="Cancelar" outline color={C.inkSoft} onPress={closeReminder} />
              <Btn label="Guardar" onPress={save} />
            </View>
          </ScrollView>
        </Sheet>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0007', alignItems: 'center', justifyContent: 'center', padding: 20 },
  sheet: { width: 620, maxWidth: '100%', maxHeight: '95%' },
  label: { fontSize: 12, color: C.inkSoft, marginBottom: 4, fontWeight: '600' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  swatch: { width: 30, height: 30, borderRadius: 15, marginRight: 8, marginBottom: 6, borderWidth: 1, borderColor: '#0002' },
  swatchActive: { borderWidth: 3, borderColor: C.ink },
});
