import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FlipDir, useFlip } from '../../components/PageFlip';
import { IconBtn } from '../../components/ui';
import { run } from '../../db';
import { dir, Note, touchNote } from '../../notebooks';
import { C } from '../../theme';

/** Botón volver + título editable de la nota, para la barra de herramientas */
export function NoteHeader({ note, onBack, width = 220 }: { note: Note; onBack: () => void; width?: number }) {
  const [title, setTitle] = useState(note.title);
  useEffect(() => setTitle(note.title), [note.id, note.title]);
  return (
    <View style={s.row}>
      <Pressable onPress={onBack} style={s.back} hitSlop={6}>
        <Text style={s.backText}>‹ Cuadernos</Text>
      </Pressable>
      <TextInput
        value={title}
        onChangeText={setTitle}
        onEndEditing={() => {
          run('UPDATE notes SET title=? WHERE id=?', [title.trim() || 'Sin título', note.id]);
          touchNote(note.id);
        }}
        style={[s.title, { width }]}
        placeholder="Título"
        placeholderTextColor="#B8AFA2"
      />
    </View>
  );
}

/** Botón que pasa de hoja con la animación (debe estar dentro de la barra de InkPage) */
export function FlipButton({ icon, title, dir, onTurn, disabled }: { icon: string; title: string; dir: FlipDir; onTurn: () => void; disabled?: boolean }) {
  const flip = useFlip();
  return (
    <IconBtn
      icon={icon}
      title={title}
      style={disabled ? { opacity: 0.3 } : undefined}
      onPress={() => {
        if (disabled) return;
        if (flip) flip(dir, onTurn);
        else onTurn();
      }}
    />
  );
}

/** Comparte texto como archivo .txt / .md */
export async function shareText(name: string, text: string, ext: 'txt' | 'md' = 'txt') {
  try {
    const safe = name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'nota';
    const f = new File(dir('export'), `${safe}.${ext}`);
    if (f.exists) f.delete();
    f.create();
    f.writeSync(text);
    await Sharing.shareAsync(f.uri, { mimeType: ext === 'md' ? 'text/markdown' : 'text/plain', dialogTitle: 'Compartir' });
  } catch (e) {
    Alert.alert('No se pudo compartir', String(e));
  }
}

export const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  back: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: C.accent, borderRadius: 8, marginRight: 8 },
  backText: { color: '#fff', fontWeight: '800' },
  title: {
    fontSize: 17, fontWeight: '800', color: C.ink, borderBottomWidth: 1, borderBottomColor: '#CDBFA9', paddingVertical: 4,
  },
  pageInfo: { fontSize: 13, color: C.inkSoft, marginHorizontal: 6, fontWeight: '700' },
});
