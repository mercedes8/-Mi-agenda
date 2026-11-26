import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApp } from '../AppState';
import { bump, updatePageAnywhere } from '../db';
import { ymd } from '../dates';
import { saveQuickNote } from '../notebooks';
import { C } from '../theme';
import { newPostIt } from './InkTools';
import { Btn } from './ui';

/** Nota rápida: se abre con un toque desde cualquier sección */
export function QuickNoteModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { openReminder, coverVisible } = useApp();
  const [text, setText] = useState('');
  const [saved, setSaved] = useState('');

  const close = () => {
    setText('');
    onClose();
  };
  const done = (msg: string) => {
    setSaved(msg);
    setText('');
    setTimeout(() => {
      setSaved('');
      onClose();
    }, 900);
  };

  const save = () => {
    if (!text.trim()) return;
    saveQuickNote(text.trim());
    bump();
    done('✔ Guardada en Cuadernos › Notas rápidas');
  };
  const toToday = () => {
    if (!text.trim()) return;
    const t = text.trim();
    updatePageAnywhere(`day:${ymd(new Date())}`, (p) => ({
      ...p,
      postits: [...p.postits, newPostIt('note', 520 + Math.random() * 120, 120 + Math.random() * 160, t)],
    }));
    bump();
    done('✔ Pegada como post-it en la hoja de hoy');
  };
  const toReminder = () => {
    if (!text.trim()) return;
    const t = text.trim();
    close();
    setTimeout(() => openReminder({ date: ymd(new Date()), time: '09:00', title: t.split('\n')[0], notes: t.split('\n').slice(1).join('\n') }), 200);
  };

  return (
    <Modal transparent visible={visible && !coverVisible} animationType="fade" onRequestClose={close}>
      <Pressable style={s.backdrop} onPress={close}>
        <Pressable style={s.note} onPress={() => {}}>
          <View style={s.tape} />
          <Text style={s.title}>⚡ Nota rápida</Text>
          {saved ? (
            <Text style={s.saved}>{saved}</Text>
          ) : (
            <>
              <TextInput
                autoFocus
                multiline
                value={text}
                onChangeText={setText}
                placeholder="Anotá la idea antes de que se escape…"
                placeholderTextColor="#00000055"
                style={s.input}
                textAlignVertical="top"
              />
              <View style={s.actions}>
                <Btn label="Guardar" onPress={save} disabled={!text.trim()} />
                <Btn label="🟨 Post-it en hoy" outline onPress={toToday} disabled={!text.trim()} />
                <Btn label="🔔 Recordatorio" outline onPress={toReminder} disabled={!text.trim()} />
                <View style={{ flex: 1 }} />
                <Btn label="Cerrar" outline color={C.inkSoft} onPress={close} />
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0006', alignItems: 'center', justifyContent: 'center' },
  note: {
    width: 640, maxWidth: '92%', backgroundColor: '#FFF59D', padding: 18, paddingTop: 26, borderRadius: 3,
    elevation: 12, transform: [{ rotate: '-0.8deg' }],
  },
  tape: { position: 'absolute', top: -10, alignSelf: 'center', width: 120, height: 24, backgroundColor: '#FFFFFFAA', transform: [{ rotate: '2deg' }] },
  title: { fontSize: 18, fontWeight: '900', color: '#6D5A00', marginBottom: 6 },
  input: { minHeight: 200, fontSize: 19, lineHeight: 28, color: '#333' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  saved: { fontSize: 17, fontWeight: '700', color: '#2E7D32', paddingVertical: 40, textAlign: 'center' },
});
