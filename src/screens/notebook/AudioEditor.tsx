import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { usePage } from '../../components/InkPage';
import { Recorder } from '../../components/Recorder';
import { IconBtn, Sheet, Title } from '../../components/ui';
import { Note, notePageKey, touchNote } from '../../notebooks';
import { C } from '../../theme';
import { NoteHeader, shareText } from './common';

/** Grabación de audio con transcripción automática */
export function AudioEditor({ note, onBack }: { note: Note; onBack: () => void }) {
  const { page, setField } = usePage(notePageKey(note.id));
  const set = (k: string, v: string) => {
    setField(k, v);
    touchNote(note.id);
  };
  const f = page.fields;

  return (
    <View style={{ flex: 1, backgroundColor: C.desk }}>
      <View style={st.toolbar}>
        <NoteHeader note={note} onBack={onBack} width={260} />
        <View style={{ flex: 1 }} />
        <IconBtn
          icon="📤"
          title="Compartir transcripción"
          onPress={() =>
            shareText(note.title, `${note.title}\n\n${f.resumen ? `RESUMEN\n${f.resumen}\n\n` : ''}TRANSCRIPCIÓN\n${f.transcripcion ?? ''}`)
          }
        />
      </View>
      <View style={st.wrap}>
        <Sheet style={{ flex: 2 }}>
          <Title>🎙️ Grabación</Title>
          <Recorder fields={f} setField={set} />
        </Sheet>
        <Sheet style={{ flex: 1 }}>
          <Title>✎ Resumen y notas</Title>
          <Text style={st.hint}>Anotá lo importante mientras escuchás o después de grabar.</Text>
          <TextInput
            multiline
            value={f.resumen ?? ''}
            onChangeText={(v) => set('resumen', v)}
            style={st.notes}
            textAlignVertical="top"
            placeholder="• …"
            placeholderTextColor="#C8BFB0"
          />
        </Sheet>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  toolbar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFE4CF', borderBottomWidth: 1,
    borderBottomColor: '#D8C8AA', paddingHorizontal: 8, minHeight: 54,
  },
  wrap: { flex: 1, flexDirection: 'row', padding: 14, gap: 12 },
  hint: { fontSize: 12, color: C.inkSoft, marginBottom: 6 },
  notes: { flex: 1, fontSize: 16, lineHeight: 24, color: C.ink },
});
