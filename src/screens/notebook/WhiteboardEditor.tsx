import { Canvas, Path } from '@shopify/react-native-skia';
import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { usePage, useInkHandlers } from '../../components/InkPage';
import { InkLayer, newPostIt, PostItView, useInkTools, Viewport } from '../../components/InkTools';
import { IconBtn } from '../../components/ui';
import { useSetting } from '../../db';
import { Note, notePageKey, touchNote } from '../../notebooks';
import { C } from '../../theme';
import { NoteHeader } from './common';

/** Fondo de puntos que se mueve y escala con el lienzo */
function DotGrid({ view, w, h }: { view: Viewport; w: number; h: number }) {
  const d = useMemo(() => {
    let g = 40 * view.s;
    while (g < 18) g *= 2;
    const ox = ((view.x % g) + g) % g, oy = ((view.y % g) + g) % g;
    let p = '';
    for (let y = oy; y < h; y += g) for (let x = ox; x < w; x += g) p += `M${x.toFixed(1)} ${y.toFixed(1)} L${(x + 0.1).toFixed(1)} ${y.toFixed(1)} `;
    return p;
  }, [view, w, h]);
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {d ? <Path path={d} color="#C9BFAE" style="stroke" strokeWidth={2.5} strokeCap="round" /> : null}
    </Canvas>
  );
}

/** Pizarra infinita: dos dedos para mover y hacer zoom, ✋ para arrastrar con un dedo */
export function WhiteboardEditor({ note, onBack }: { note: Note; onBack: () => void }) {
  const key = notePageKey(note.id);
  const api = usePage(key);
  const { page, setField } = api;
  const h = useInkHandlers(api, key);
  const [stylusOnly] = useSetting('stylusOnly', '0');
  const [size, setSize] = useState({ w: 1000, h: 700 });
  const [view, setViewS] = useState<Viewport>(() => {
    try {
      return JSON.parse(page.fields.view || '') as Viewport;
    } catch {
      return { x: 0, y: 0, s: 1 };
    }
  });
  const setView = (v: Viewport) => {
    setViewS(v);
    setField('view', JSON.stringify(v));
  };
  const zoom = (k: number) => {
    const s = Math.min(6, Math.max(0.15, view.s * k));
    const cx = size.w / 2, cy = size.h / 2;
    setView({ s, x: cx - (cx - view.x) * (s / view.s), y: cy - (cy - view.y) * (s / view.s) });
  };
  const center = () => {
    const wx = (size.w / 2 - view.x) / view.s, wy = (size.h / 2 - view.y) / view.s;
    return { x: wx - 95, y: wy - 85 };
  };

  const { tools, toolbar } = useInkTools({
    left: <NoteHeader note={note} onBack={onBack} width={180} />,
    typeIcon: '✋',
    typeTitle: 'Mover el lienzo',
    onUndo: h.undo,
    onClear: h.clear,
    onPostIt: () => {
      const c = center();
      h.addPostIt(newPostIt('note', c.x, c.y));
      touchNote(note.id);
    },
    onSticker: (e) => {
      const c = center();
      h.addPostIt(newPostIt('sticker', c.x + 70, c.y + 60, e));
    },
    right: (
      <>
        <View style={{ width: 1, height: 28, backgroundColor: '#CDBFA9', marginHorizontal: 6 }} />
        <IconBtn icon="➖" title="Alejar" onPress={() => zoom(1 / 1.25)} />
        <Text style={st.zoom}>{Math.round(view.s * 100)}%</Text>
        <IconBtn icon="➕" title="Acercar" onPress={() => zoom(1.25)} />
        <IconBtn icon="🎯" title="Volver al centro" onPress={() => setView({ x: 0, y: 0, s: 1 })} />
      </>
    ),
  });

  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  return (
    <View style={{ flex: 1 }}>
      {toolbar}
      <View style={st.board} onLayout={onLayout}>
        <DotGrid view={view} w={size.w} h={size.h} />
        <InkLayer
          strokes={page.strokes}
          tools={tools}
          stylusOnly={stylusOnly === '1'}
          onAdd={(s) => {
            h.onAdd(s);
          }}
          onErase={h.onErase}
          view={view}
          onViewChange={setView}
        />
        <View
          pointerEvents="box-none"
          style={[
            StyleSheet.absoluteFill,
            { transformOrigin: 'top left', transform: [{ translateX: view.x }, { translateY: view.y }, { scale: view.s }] },
          ]}
        >
          {page.postits.map((p) => (
            <PostItView key={p.id} p={p} scale={view.s} onChange={h.changePostIt} onDelete={() => h.deletePostIt(p.id)} />
          ))}
        </View>
        <Text style={st.help} pointerEvents="none">
          Dos dedos: mover y zoom · ✋ arrastrar con un dedo · ✒️ escribir
        </Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  board: { flex: 1, backgroundColor: '#FBF8F1', overflow: 'hidden' },
  zoom: { width: 48, textAlign: 'center', fontSize: 13, color: C.inkSoft, fontWeight: '700' },
  help: { position: 'absolute', bottom: 8, left: 12, fontSize: 11, color: C.inkSoft },
});
