import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../AppState';
import { getSetting, PostIt, setSetting, useDbVersion } from '../db';
import { newPostIt, PostItView } from './InkTools';

/** Secciones que no son una hoja con tinta: ahí los post-its viven en esta capa */
const SECTIONS = ['anio', 'recordatorios', 'contactos', 'listas', 'habitos', 'cuadernos', 'gastos', 'ajustes'];

function load(section: string): PostIt[] {
  try {
    const a = JSON.parse(getSetting('gpostits:' + section, '[]'));
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

export function GlobalPostIts() {
  const { section } = useApp();
  useDbVersion();
  if (!SECTIONS.includes(section)) return null;
  const items = load(section);
  const save = (next: PostIt[]) => setSetting('gpostits:' + section, JSON.stringify(next));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {items.map((p) => (
        <PostItView
          key={p.id}
          p={p}
          onChange={(np) => save(load(section).map((x) => (x.id === np.id ? np : x)))}
          onDelete={() => save(load(section).filter((x) => x.id !== p.id))}
        />
      ))}
      <Pressable
        style={s.btn}
        accessibilityLabel="Agregar post-it"
        onPress={() => save([...load(section), newPostIt('note', 80 + (items.length % 5) * 24, 90 + (items.length % 5) * 24)])}
      >
        <Text style={{ fontSize: 22 }}>🟨</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  btn: {
    position: 'absolute', right: 12, bottom: 12, width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#FFF3B0', alignItems: 'center', justifyContent: 'center', elevation: 6,
    borderWidth: 1, borderColor: '#0002',
  },
});
