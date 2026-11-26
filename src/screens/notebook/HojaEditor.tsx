import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { InkPage } from '../../components/InkPage';
import { Menu, MenuItem } from '../../components/Menu';
import { PaperBg, PAPERS } from '../../components/PaperBg';
import { IconBtn } from '../../components/ui';
import { loadPage, run } from '../../db';
import { Note, notePageKey, touchNote } from '../../notebooks';
import { C } from '../../theme';
import { FlipButton, NoteHeader, s as cs, shareText } from './common';

/** Cuaderno de varias hojas (también se usa para las notas rápidas) */
export function HojaEditor({ note, onBack }: { note: Note; onBack: () => void }) {
  const [idx, setIdx] = useState(0);
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const pages = Math.max(1, note.pages || 1);
  const key = notePageKey(note.id, idx);

  const go = (n: number) => {
    if (n >= pages) run('UPDATE notes SET pages=? WHERE id=?', [n + 1, note.id]);
    setIdx(Math.max(0, n));
    touchNote(note.id);
  };

  const shareAll = () => {
    const parts: string[] = [];
    for (let i = 0; i < pages; i++) {
      const t = loadPage(notePageKey(note.id, i)).fields.texto;
      if (t) parts.push(pages > 1 ? `— Hoja ${i + 1} —\n${t}` : t);
    }
    shareText(note.title, `${note.title}\n\n${parts.join('\n\n')}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.desk }}>
      <InkPage
        pageKey={key}
        flipAxis="left"
        canTurn={(d) => d === 'next' || idx > 0}
        turn={(d) => go(d === 'next' ? idx + 1 : idx - 1)}
        left={<NoteHeader note={note} onBack={onBack} width={200} />}
        right={
          <>
            <View style={{ width: 1, height: 28, backgroundColor: '#CDBFA9', marginHorizontal: 6 }} />
            <FlipButton icon="◀" title="Hoja anterior" dir="prev" disabled={idx === 0} onTurn={() => go(idx - 1)} />
            <Text style={cs.pageInfo}>
              Hoja {idx + 1}/{pages}
            </Text>
            <FlipButton icon="▶" title="Hoja siguiente (crea una nueva al final)" dir="next" onTurn={() => go(idx + 1)} />
            <IconBtn
              icon="📃"
              title="Tipo de papel"
              onPress={() =>
                setMenu(
                  PAPERS.map(([p, l]) => ({
                    label: l + (note.paper === p ? '  ✓' : ''),
                    onPress: () => run('UPDATE notes SET paper=? WHERE id=?', [p, note.id]),
                  })),
                )
              }
            />
            <IconBtn icon="📤" title="Compartir texto" onPress={shareAll} />
          </>
        }
        pageStyle={st.paper}
      >
        {({ page, setField }) => (
          <>
            <PaperBg paper={note.paper} gap={32} top={8} />
            <TextInput
              multiline
              style={[st.body, note.paper === 'rayado' && { paddingLeft: 66 }]}
              value={page.fields.texto ?? ''}
              onChangeText={(v) => setField('texto', v)}
              textAlignVertical="top"
              placeholder={idx === 0 ? 'Escribí con el teclado o elegí ✒️ para escribir a mano…' : ''}
              placeholderTextColor="#C8BFB0"
            />
            <Text style={st.pageNum}>{idx + 1}</Text>
          </>
        )}
      </InkPage>
      <Menu title="Papel" items={menu} onClose={() => setMenu(null)} />
    </View>
  );
}

const st = StyleSheet.create({
  paper: { backgroundColor: C.paper, margin: 12, borderRadius: 6, elevation: 4 },
  body: { flex: 1, fontSize: 19, lineHeight: 32, color: C.ink, paddingHorizontal: 16, paddingTop: 13 },
  pageNum: { position: 'absolute', bottom: 8, alignSelf: 'center', color: C.inkSoft, fontSize: 12 },
});
