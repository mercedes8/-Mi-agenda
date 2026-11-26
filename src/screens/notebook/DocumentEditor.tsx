import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { usePage } from '../../components/InkPage';
import { Check } from '../../components/ui';
import { Note, notePageKey, touchNote } from '../../notebooks';
import { C } from '../../theme';
import { NoteHeader, shareText } from './common';

type BlockType = 'p' | 'h1' | 'h2' | 'li' | 'ol' | 'todo' | 'quote';
type Block = { id: string; t: BlockType; text: string; done?: boolean; b?: boolean; i?: boolean; u?: boolean };

const uid = () => Math.random().toString(36).slice(2, 10);
const TYPES: [BlockType, string, string][] = [
  ['p', '¶', 'Texto'],
  ['h1', 'T1', 'Título'],
  ['h2', 'T2', 'Subtítulo'],
  ['li', '•', 'Viñeta'],
  ['ol', '1.', 'Numerada'],
  ['todo', '☑', 'Casilla'],
  ['quote', '❝', 'Cita'],
];

function toMarkdown(title: string, blocks: Block[]) {
  let n = 0;
  const lines = blocks.map((b) => {
    n = b.t === 'ol' ? n + 1 : 0;
    let t = b.text;
    if (b.b) t = `**${t}**`;
    if (b.i) t = `_${t}_`;
    switch (b.t) {
      case 'h1': return `# ${t}`;
      case 'h2': return `## ${t}`;
      case 'li': return `- ${t}`;
      case 'ol': return `${n}. ${t}`;
      case 'todo': return `- [${b.done ? 'x' : ' '}] ${t}`;
      case 'quote': return `> ${t}`;
      default: return t;
    }
  });
  return `# ${title}\n\n${lines.join('\n\n')}`;
}

/** Documento de texto por bloques: títulos, listas, casillas, citas, negrita/cursiva/subrayado */
export function DocumentEditor({ note, onBack }: { note: Note; onBack: () => void }) {
  const { page, setField } = usePage(notePageKey(note.id));
  const [blocks, setBlocksS] = useState<Block[]>(() => {
    try {
      const b = JSON.parse(page.fields.doc || '[]') as Block[];
      return b.length ? b : [{ id: uid(), t: 'p', text: '' }];
    } catch {
      return [{ id: uid(), t: 'p', text: '' }];
    }
  });
  const [focus, setFocus] = useState<string | null>(null);
  const [fs, setFs] = useState(Number(page.fields.fs || 18));
  const refs = useRef<Record<string, React.ComponentRef<typeof TextInput> | null>>({});
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    if (pendingFocus.current) {
      refs.current[pendingFocus.current]?.focus();
      pendingFocus.current = null;
    }
  });

  const setBlocks = (b: Block[]) => {
    setBlocksS(b);
    setField('doc', JSON.stringify(b));
    touchNote(note.id);
  };
  const cur = blocks.find((b) => b.id === focus);
  const patch = (id: string, p: Partial<Block>) => setBlocks(blocks.map((b) => (b.id === id ? { ...b, ...p } : b)));

  const onText = (b: Block, text: string) => {
    if (!text.includes('\n')) return patch(b.id, { text });
    // Enter: corta el bloque y crea uno nuevo (las listas continúan)
    const i = blocks.findIndex((x) => x.id === b.id);
    const [before, ...rest] = text.split('\n');
    const cont: BlockType = ['li', 'ol', 'todo'].includes(b.t) ? b.t : 'p';
    if (!before && ['li', 'ol', 'todo'].includes(b.t) && !rest.join('')) {
      // Enter en un ítem vacío: sale de la lista
      return patch(b.id, { t: 'p', text: '' });
    }
    const nb: Block = { id: uid(), t: cont, text: rest.join('\n') };
    const next = [...blocks];
    next[i] = { ...b, text: before };
    next.splice(i + 1, 0, nb);
    pendingFocus.current = nb.id;
    setBlocks(next);
  };
  const onKey = (b: Block, key: string) => {
    if (key !== 'Backspace' || b.text !== '') return;
    const i = blocks.findIndex((x) => x.id === b.id);
    if (b.t !== 'p') return patch(b.id, { t: 'p' });
    if (i === 0) return;
    pendingFocus.current = blocks[i - 1].id;
    setBlocks(blocks.filter((x) => x.id !== b.id));
  };

  const words = blocks.reduce((n, b) => n + (b.text.trim() ? b.text.trim().split(/\s+/).length : 0), 0);
  const olNum: number[] = [];
  blocks.forEach((b, i) => olNum.push(b.t === 'ol' ? (blocks[i - 1]?.t === 'ol' ? olNum[i - 1] + 1 : 1) : 0));

  const fmt = (k: 'b' | 'i' | 'u', label: string, style: object) => (
    <Pressable
      key={k}
      onPress={() => cur && patch(cur.id, { [k]: !cur[k] })}
      style={[st.tb, cur?.[k] && st.tbOn]}
    >
      <Text style={[st.tbText, style]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.desk }}>
      <View style={st.toolbar}>
        <NoteHeader note={note} onBack={onBack} width={200} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', gap: 4, paddingLeft: 10 }}>
          {TYPES.map(([t, icon, label]) => (
            <Pressable key={t} onPress={() => cur && patch(cur.id, { t })} style={[st.tb, cur?.t === t && st.tbOn]} accessibilityLabel={label}>
              <Text style={st.tbText}>{icon}</Text>
            </Pressable>
          ))}
          <View style={st.sep} />
          {fmt('b', 'B', { fontWeight: '900' })}
          {fmt('i', 'I', { fontStyle: 'italic' })}
          {fmt('u', 'U', { textDecorationLine: 'underline' })}
          <View style={st.sep} />
          <Pressable style={st.tb} onPress={() => { const v = Math.max(13, fs - 2); setFs(v); setField('fs', String(v)); }}>
            <Text style={st.tbText}>A−</Text>
          </Pressable>
          <Pressable style={st.tb} onPress={() => { const v = Math.min(30, fs + 2); setFs(v); setField('fs', String(v)); }}>
            <Text style={st.tbText}>A+</Text>
          </Pressable>
          <View style={st.sep} />
          <Pressable style={st.tb} onPress={() => shareText(note.title, toMarkdown(note.title, blocks), 'md')}>
            <Text style={st.tbText}>📤</Text>
          </Pressable>
          <Text style={st.words}>{words} palabras</Text>
        </ScrollView>
      </View>
      <ScrollView style={st.page} contentContainerStyle={{ padding: 40, paddingBottom: 300 }} keyboardShouldPersistTaps="handled">
        {blocks.map((b, bi) => {
          const ol = olNum[bi];
          const size = b.t === 'h1' ? fs * 1.7 : b.t === 'h2' ? fs * 1.3 : fs;
          return (
            <View key={b.id} style={[st.block, b.t === 'quote' && st.quote]}>
              {b.t === 'li' && <Text style={[st.bullet, { fontSize: fs }]}>•</Text>}
              {b.t === 'ol' && <Text style={[st.bullet, { fontSize: fs }]}>{ol}.</Text>}
              {b.t === 'todo' && (
                <View style={{ marginTop: 6, marginRight: 8 }}>
                  <Check checked={!!b.done} onPress={() => patch(b.id, { done: !b.done })} />
                </View>
              )}
              <TextInput
                ref={(r) => {
                  refs.current[b.id] = r;
                }}
                multiline
                value={b.text}
                onFocus={() => setFocus(b.id)}
                onChangeText={(t) => onText(b, t)}
                onKeyPress={(e) => onKey(b, e.nativeEvent.key)}
                placeholder={blocks.length === 1 ? 'Empezá a escribir… (elegí arriba título, lista, casillas…)' : ''}
                placeholderTextColor="#C8BFB0"
                style={[
                  st.input,
                  { fontSize: size, lineHeight: size * 1.4 },
                  (b.t === 'h1' || b.t === 'h2' || b.b) && { fontWeight: '800' },
                  b.i && { fontStyle: 'italic' },
                  b.u && { textDecorationLine: 'underline' },
                  b.t === 'todo' && b.done && { textDecorationLine: 'line-through', color: C.inkSoft },
                  b.t === 'quote' && { fontStyle: 'italic', color: C.inkSoft },
                ]}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  toolbar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFE4CF', borderBottomWidth: 1,
    borderBottomColor: '#D8C8AA', paddingHorizontal: 8, minHeight: 54,
  },
  tb: { minWidth: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  tbOn: { backgroundColor: C.accentSoft, borderWidth: 1.5, borderColor: C.accent },
  tbText: { fontSize: 17, color: C.ink, fontWeight: '700' },
  sep: { width: 1, height: 28, backgroundColor: '#CDBFA9', marginHorizontal: 6 },
  words: { fontSize: 12, color: C.inkSoft, marginLeft: 8 },
  page: { flex: 1, backgroundColor: '#fff', margin: 12, borderRadius: 6, elevation: 3 },
  block: { flexDirection: 'row', alignItems: 'flex-start' },
  quote: { borderLeftWidth: 4, borderLeftColor: C.accent, paddingLeft: 12, marginVertical: 4 },
  bullet: { color: C.accent, fontWeight: '800', marginRight: 8, marginTop: 4, minWidth: 18 },
  input: { flex: 1, color: C.ink, paddingVertical: 4 },
});
