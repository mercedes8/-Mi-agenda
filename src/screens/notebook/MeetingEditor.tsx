import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApp } from '../../AppState';
import { InkPage } from '../../components/InkPage';
import { Spine } from '../../components/PageFlip';
import { PaperBg, Rings } from '../../components/PaperBg';
import { pickDate, pickTime } from '../../components/pickers';
import { Recorder } from '../../components/Recorder';
import { Check, IconBtn, LineInput, Title } from '../../components/ui';
import { hm, longDate, parseYmd, ymd } from '../../dates';
import { Note, notePageKey, touchNote } from '../../notebooks';
import { C } from '../../theme';
import { st as day } from '../DayScreen';
import { NoteHeader, shareText } from './common';

type Action = { t: string; who: string; when: string; d: boolean };

/** Notas de reunión: plantilla completa + grabación con transcripción */
export function MeetingEditor({ note, onBack }: { note: Note; onBack: () => void }) {
  const { openReminder } = useApp();
  const key = notePageKey(note.id);

  return (
    <View style={{ flex: 1 }}>
      <InkPage
        pageKey={key}
        left={<NoteHeader note={note} onBack={onBack} width={220} />}
        pageStyle={day.desk}
      >
        {({ page, setField }) => {
          const f = page.fields;
          const set = (k: string, v: string) => {
            setField(k, v);
            touchNote(note.id);
          };
          const date = f.fecha || ymd(new Date(note.created ?? Date.now()));
          const time = f.hora || '';
          let actions: Action[] = [];
          try {
            actions = JSON.parse(f.acciones || '[]');
          } catch {}
          while (actions.length < 5 || actions[actions.length - 1].t) actions.push({ t: '', who: '', when: '', d: false });
          const setAction = (i: number, p: Partial<Action>) => {
            const a = actions.map((x, j) => (j === i ? { ...x, ...p } : x));
            set('acciones', JSON.stringify(a.filter((x) => x.t || x.who || x.when)));
          };
          const share = () => {
            const acts = actions.filter((a) => a.t).map((a) => `- [${a.d ? 'x' : ' '}] ${a.t}${a.who ? ` (${a.who})` : ''}${a.when ? ` → ${a.when}` : ''}`);
            shareText(
              note.title,
              [
                `# ${note.title}`,
                `Fecha: ${longDate(parseYmd(date))}${time ? ` · ${time} hs` : ''}${f.lugar ? ` · ${f.lugar}` : ''}`,
                f.asistentes && `Asistentes: ${f.asistentes}`,
                f.objetivo && `## Objetivo\n${f.objetivo}`,
                f.notas && `## Notas\n${f.notas}`,
                f.decisiones && `## Decisiones\n${f.decisiones}`,
                acts.length && `## Tareas\n${acts.join('\n')}`,
                f.proxima && `Próxima reunión: ${f.proxima}`,
                f.transcripcion && `## Transcripción\n${f.transcripcion}`,
              ].filter(Boolean).join('\n\n'),
              'md',
            );
          };
          return (
            <View style={day.spread}>
              <View style={[day.page, day.pageLeft]}>
                <View style={st.head}>
                  <Text style={st.big}>👥 Reunión</Text>
                  <IconBtn icon="📤" title="Compartir acta" onPress={share} size={34} />
                </View>
                <View style={st.metaRow}>
                  <Pressable onPress={() => pickDate(parseYmd(date), (d) => set('fecha', ymd(d)))}>
                    <Text style={st.meta}>📅 {longDate(parseYmd(date))}</Text>
                  </Pressable>
                  <Pressable onPress={() => pickTime(new Date(), (d) => set('hora', hm(d.getHours(), d.getMinutes())))}>
                    <Text style={st.meta}>⏰ {time || 'hora'}</Text>
                  </Pressable>
                </View>
                <Field label="Lugar / link" value={f.lugar} onChange={(v) => set('lugar', v)} />
                <Field label="Asistentes" value={f.asistentes} onChange={(v) => set('asistentes', v)} />
                <Field label="Objetivo" value={f.objetivo} onChange={(v) => set('objetivo', v)} />
                <Title style={{ marginTop: 8 }}>✎ Notas y temas</Title>
                <View style={{ flex: 1 }}>
                  <PaperBg paper="rayado" gap={28} margin={false} />
                  <TextInput multiline style={day.notes} value={f.notas ?? ''} onChangeText={(v) => set('notas', v)} textAlignVertical="top" />
                </View>
              </View>
              <Spine style={day.spine}>
                <Rings count={9} />
              </Spine>
              <View style={[day.page, day.pageRight]}>
                <Title>✔ Decisiones</Title>
                <TextInput
                  multiline
                  style={st.decisions}
                  value={f.decisiones ?? ''}
                  onChangeText={(v) => set('decisiones', v)}
                  textAlignVertical="top"
                  placeholder="• …"
                  placeholderTextColor="#C8BFB0"
                />
                <Title style={{ marginTop: 6 }}>☑ Tareas</Title>
                <View style={st.actHead}>
                  <Text style={[st.actCol, { flex: 1, marginLeft: 30 }]}>Qué</Text>
                  <Text style={[st.actCol, { width: 110 }]}>Quién</Text>
                  <Text style={[st.actCol, { width: 90 }]}>Cuándo</Text>
                  <View style={{ width: 30 }} />
                </View>
                <ScrollView style={{ maxHeight: 190 }} keyboardShouldPersistTaps="handled">
                  {actions.map((a, i) => (
                    <View key={i} style={st.act}>
                      <Check checked={a.d} onPress={() => setAction(i, { d: !a.d })} size={20} />
                      <LineInput style={[{ flex: 1, marginLeft: 8, fontSize: 14 }, a.d && { textDecorationLine: 'line-through' }]} value={a.t} onChangeText={(v) => setAction(i, { t: v })} />
                      <LineInput style={{ width: 110, fontSize: 14 }} value={a.who} onChangeText={(v) => setAction(i, { who: v })} />
                      <LineInput style={{ width: 90, fontSize: 14 }} value={a.when} onChangeText={(v) => setAction(i, { when: v })} />
                      <Pressable
                        hitSlop={6}
                        style={{ width: 30, alignItems: 'center', opacity: a.t ? 1 : 0.2 }}
                        disabled={!a.t}
                        onPress={() => openReminder({ date: ymd(new Date()), time: '09:00', title: a.t, notes: `De la reunión: ${note.title}` })}
                      >
                        <Text>🔔</Text>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
                <Field label="Próxima reunión" value={f.proxima} onChange={(v) => set('proxima', v)} />
                <Title style={{ marginTop: 6 }}>🎙️ Grabación</Title>
                <View style={{ flex: 1 }}>
                  <Recorder fields={f} setField={set} compact />
                </View>
              </View>
            </View>
          );
        }}
      </InkPage>
    </View>
  );
}

function Field({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <View style={st.field}>
      <Text style={st.fieldLabel}>{label}</Text>
      <LineInput style={{ flex: 1 }} value={value ?? ''} onChangeText={onChange} />
    </View>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: C.accent, paddingBottom: 4 },
  big: { flex: 1, fontSize: 24, fontWeight: '900', color: C.ink },
  metaRow: { flexDirection: 'row', gap: 18, marginVertical: 6 },
  meta: { fontSize: 15, color: C.accent, fontWeight: '700' },
  field: { flexDirection: 'row', alignItems: 'center' },
  fieldLabel: { width: 100, fontSize: 12, fontWeight: '800', color: C.accent, textTransform: 'uppercase' },
  decisions: { minHeight: 60, maxHeight: 90, fontSize: 15, color: C.ink, borderBottomWidth: 1, borderBottomColor: C.line },
  actHead: { flexDirection: 'row' },
  actCol: { fontSize: 11, color: C.inkSoft, fontWeight: '700' },
  act: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
