import { Canvas, Group, Path } from '@shopify/react-native-skia';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, LayoutChangeEvent, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { GestureDetector, PointerType, usePanGesture } from 'react-native-gesture-handler';
import { loadPage, PageData, PostIt, savePage, Stroke, useSetting } from '../db';
import { C, HIGHLIGHT_COLORS, PEN_COLORS, POSTIT_COLORS, STICKERS } from '../theme';
import { IconBtn } from './ui';

/* =================== Persistencia de la página =================== */

export function usePage(key: string) {
  const [page, setPage] = useState<PageData>(() => loadPage(key));
  const pending = useRef<{ key: string; data: PageData } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef(key);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (pending.current) {
      savePage(pending.current.key, pending.current.data);
      pending.current = null;
    }
  }, []);

  useEffect(() => {
    if (keyRef.current !== key) {
      flush();
      keyRef.current = key;
      setPage(loadPage(key));
    }
  }, [key, flush]);

  useEffect(() => flush, [flush]);

  const update = useCallback(
    (fn: (p: PageData) => PageData) => {
      setPage((prev) => {
        const next = fn(prev);
        pending.current = { key: keyRef.current, data: next };
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, 600);
        return next;
      });
    },
    [flush],
  );

  const setField = useCallback(
    (k: string, v: string) => update((p) => ({ ...p, fields: { ...p.fields, [k]: v } })),
    [update],
  );

  return { page, update, setField };
}

/* =================== Trazos =================== */

function pointsToPath(p: number[]): string {
  if (p.length < 2) return '';
  if (p.length <= 4) {
    const x = p[0], y = p[1];
    const x2 = p.length === 4 ? p[2] : x + 0.5, y2 = p.length === 4 ? p[3] : y + 0.5;
    return `M${x} ${y} L${x2} ${y2}`;
  }
  let d = `M${p[0]} ${p[1]}`;
  for (let i = 2; i < p.length - 2; i += 2) {
    const mx = (p[i] + p[i + 2]) / 2, my = (p[i + 1] + p[i + 3]) / 2;
    d += ` Q${p[i]} ${p[i + 1]} ${mx} ${my}`;
  }
  d += ` L${p[p.length - 2]} ${p[p.length - 1]}`;
  return d;
}

const StrokeView = memo(function StrokeView({ s }: { s: Stroke }) {
  const d = useMemo(() => pointsToPath(s.p), [s.p]);
  return (
    <Path path={d} color={s.c} opacity={s.o} style="stroke" strokeWidth={s.w} strokeCap="round" strokeJoin="round" />
  );
});

const Strokes = memo(function Strokes({ strokes }: { strokes: Stroke[] }) {
  return (
    <Group>
      {strokes.map((s, i) => (
        <StrokeView key={i} s={s} />
      ))}
    </Group>
  );
});

export type Tool = 'type' | 'pen' | 'highlighter' | 'eraser';

// Preferencias de herramienta compartidas entre páginas mientras la app está abierta
const toolMemory = { tool: 'type' as Tool, pen: PEN_COLORS[0], hl: HIGHLIGHT_COLORS[0], penW: 3, hlW: 18 };

function InkLayer({
  strokes, tool, color, width, stylusOnly, onAdd, onErase,
}: {
  strokes: Stroke[]; tool: Tool; color: string; width: number; stylusOnly: boolean;
  onAdd: (s: Stroke) => void; onErase: (x: number, y: number) => void;
}) {
  const [cur, setCur] = useState<number[] | null>(null);
  const pts = useRef<number[]>([]);
  const active = useRef(false);
  const props = useRef({ tool, color, width, stylusOnly, onAdd, onErase });
  props.current = { tool, color, width, stylusOnly, onAdd, onErase };

  const drawing = tool !== 'type';

  const pan = usePanGesture({
    runOnJS: true,
    minDistance: 0,
    enabled: drawing,
    onBegin: (e) => {
      const P = props.current;
      if (P.stylusOnly && e.pointerType !== PointerType.STYLUS && e.pointerType !== PointerType.MOUSE) {
        active.current = false;
        return;
      }
      active.current = true;
      if (P.tool === 'eraser') {
        P.onErase(e.x, e.y);
        return;
      }
      pts.current = [e.x, e.y];
      setCur([e.x, e.y]);
    },
    onUpdate: (e) => {
      if (!active.current) return;
      const P = props.current;
      if (P.tool === 'eraser') {
        P.onErase(e.x, e.y);
        return;
      }
      const p = pts.current;
      const lx = p[p.length - 2], ly = p[p.length - 1];
      if (Math.abs(e.x - lx) + Math.abs(e.y - ly) < 1.5) return;
      p.push(e.x, e.y);
      setCur(p.slice());
    },
    onFinalize: () => {
      if (!active.current) return;
      active.current = false;
      const P = props.current;
      if (P.tool === 'pen' || P.tool === 'highlighter') {
        if (pts.current.length >= 2) {
          P.onAdd({
            c: P.color,
            w: P.width,
            o: P.tool === 'highlighter' ? 0.4 : 1,
            p: pts.current.map((v) => Math.round(v * 10) / 10),
          });
        }
      }
      pts.current = [];
      setCur(null);
    },
  });

  return (
    <GestureDetector gesture={pan}>
      <View style={StyleSheet.absoluteFill} pointerEvents={drawing ? 'auto' : 'none'}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Strokes strokes={strokes} />
          {cur && (
            <Path
              path={pointsToPath(cur)}
              color={color}
              opacity={tool === 'highlighter' ? 0.4 : 1}
              style="stroke"
              strokeWidth={width}
              strokeCap="round"
              strokeJoin="round"
            />
          )}
        </Canvas>
      </View>
    </GestureDetector>
  );
}

/* =================== Post-its y stickers =================== */

function PostItView({
  p, onChange, onDelete,
}: { p: PostIt; onChange: (p: PostIt) => void; onDelete: () => void }) {
  const [pos, setPos] = useState({ x: p.x, y: p.y, w: p.w, h: p.h });
  const start = useRef(pos);
  const cur = useRef(pos);
  cur.current = pos;
  const pRef = useRef(p);
  pRef.current = p;

  useEffect(() => setPos({ x: p.x, y: p.y, w: p.w, h: p.h }), [p.x, p.y, p.w, p.h]);

  const mover = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => (start.current = cur.current),
        onPanResponderMove: (_, g) =>
          setPos({ ...start.current, x: Math.max(0, start.current.x + g.dx), y: Math.max(0, start.current.y + g.dy) }),
        onPanResponderRelease: () => onChange({ ...pRef.current, ...cur.current }),
        onPanResponderTerminationRequest: () => false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const resizer = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => (start.current = cur.current),
        onPanResponderMove: (_, g) =>
          setPos({ ...start.current, w: Math.max(110, start.current.w + g.dx), h: Math.max(90, start.current.h + g.dy) }),
        onPanResponderRelease: () => onChange({ ...pRef.current, ...cur.current }),
        onPanResponderTerminationRequest: () => false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (p.kind === 'sticker') {
    return (
      <View {...mover.panHandlers} style={{ position: 'absolute', left: pos.x, top: pos.y }}>
        <Pressable onLongPress={onDelete} delayLongPress={500}>
          <Text style={{ fontSize: 40 }}>{p.text}</Text>
        </Pressable>
      </View>
    );
  }

  const nextColor = () => {
    const i = POSTIT_COLORS.indexOf(p.color);
    onChange({ ...p, ...cur.current, color: POSTIT_COLORS[(i + 1) % POSTIT_COLORS.length] });
  };

  return (
    <View style={[st.postit, { left: pos.x, top: pos.y, width: pos.w, height: pos.h, backgroundColor: p.color }]}>
      <View style={st.postitBar} {...mover.panHandlers}>
        <Text style={st.postitGrip}>⠿⠿⠿</Text>
        <Pressable onPress={nextColor} hitSlop={8}>
          <Text style={st.postitBtn}>🎨</Text>
        </Pressable>
        <Pressable
          hitSlop={8}
          onPress={() =>
            Alert.alert('Quitar post-it', '¿Querés despegar este post-it?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Quitar', style: 'destructive', onPress: onDelete },
            ])
          }
        >
          <Text style={st.postitBtn}>✕</Text>
        </Pressable>
      </View>
      <TextInput
        multiline
        value={p.text}
        onChangeText={(t) => onChange({ ...p, ...cur.current, text: t })}
        placeholder="Escribí acá…"
        placeholderTextColor="#00000055"
        style={st.postitText}
        textAlignVertical="top"
      />
      <View style={st.resize} {...resizer.panHandlers}>
        <Text style={{ fontSize: 14, color: '#0006' }}>◢</Text>
      </View>
    </View>
  );
}

/* =================== Página con tinta =================== */

type Props = {
  pageKey: string;
  /** Contenido de la barra a la izquierda (navegación de fechas, título) */
  left?: React.ReactNode;
  /** Botones extra a la derecha de la barra */
  right?: React.ReactNode;
  /** Fondo/contenido de la hoja. Recibe la página para leer/escribir campos */
  children: (api: ReturnType<typeof usePage>) => React.ReactNode;
  pageStyle?: object;
};

export function InkPage({ pageKey, left, right, children, pageStyle }: Props) {
  const api = usePage(pageKey);
  const { page, update } = api;
  const [stylusOnly] = useSetting('stylusOnly', '0');
  const [tool, setToolState] = useState<Tool>(toolMemory.tool);
  const [pen, setPen] = useState(toolMemory.pen);
  const [hl, setHl] = useState(toolMemory.hl);
  const [penW, setPenW] = useState(toolMemory.penW);
  const [stickers, setStickers] = useState(false);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const history = useRef<PageData['strokes'][]>([]);

  useEffect(() => {
    history.current = [];
  }, [pageKey]);

  const setTool = (t: Tool) => {
    toolMemory.tool = t;
    setToolState(t);
  };
  const color = tool === 'highlighter' ? hl : pen;
  const width = tool === 'highlighter' ? toolMemory.hlW : penW;

  const pushHistory = (s: PageData['strokes']) => {
    history.current.push(s);
    if (history.current.length > 60) history.current.shift();
  };

  const onAdd = useCallback(
    (s: Stroke) =>
      update((p) => {
        pushHistory(p.strokes);
        return { ...p, strokes: [...p.strokes, s] };
      }),
    [update],
  );
  const onErase = useCallback(
    (x: number, y: number) =>
      update((p) => {
        const r = 12;
        const keep = p.strokes.filter((s) => {
          const rr = r + s.w / 2;
          for (let i = 0; i < s.p.length; i += 2) {
            const dx = s.p[i] - x, dy = s.p[i + 1] - y;
            if (dx * dx + dy * dy < rr * rr) return false;
          }
          return true;
        });
        if (keep.length === p.strokes.length) return p;
        pushHistory(p.strokes);
        return { ...p, strokes: keep };
      }),
    [update],
  );

  const undo = () => {
    const prev = history.current.pop();
    if (prev) update((p) => ({ ...p, strokes: prev }));
  };
  const clearInk = () =>
    Alert.alert('Borrar dibujos', '¿Borrar todo lo escrito a mano en esta hoja?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () =>
          update((p) => {
            pushHistory(p.strokes);
            return { ...p, strokes: [] };
          }),
      },
    ]);

  const addPostIt = (kind: 'note' | 'sticker', text = '') => {
    const x = Math.round(size.w * 0.35 + Math.random() * 120);
    const y = Math.round(size.h * 0.2 + Math.random() * 120);
    const p: PostIt = {
      id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
      x, y, w: 190, h: 170,
      color: POSTIT_COLORS[Math.floor(Math.random() * POSTIT_COLORS.length)],
      text, kind,
    };
    update((pg) => ({ ...pg, postits: [...pg.postits, p] }));
    setStickers(false);
  };
  const changePostIt = (np: PostIt) =>
    update((pg) => ({ ...pg, postits: pg.postits.map((p) => (p.id === np.id ? np : p)) }));
  const deletePostIt = (id: string) => update((pg) => ({ ...pg, postits: pg.postits.filter((p) => p.id !== id) }));

  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const palette = tool === 'highlighter' ? HIGHLIGHT_COLORS : PEN_COLORS;

  return (
    <View style={{ flex: 1 }}>
      <View style={st.toolbar}>
        <View style={st.tbLeft}>{left}</View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.tbTools}>
          <IconBtn icon="⌨️" title="Teclado" active={tool === 'type'} onPress={() => setTool('type')} />
          <IconBtn icon="✏️" title="Lápiz" active={tool === 'pen'} onPress={() => setTool('pen')} />
          <IconBtn icon="🖍️" title="Resaltador" active={tool === 'highlighter'} onPress={() => setTool('highlighter')} />
          <IconBtn icon="🧽" title="Goma" active={tool === 'eraser'} onPress={() => setTool('eraser')} />
          {(tool === 'pen' || tool === 'highlighter') && (
            <>
              <View style={st.sep} />
              {palette.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => {
                    if (tool === 'highlighter') {
                      toolMemory.hl = c;
                      setHl(c);
                    } else {
                      toolMemory.pen = c;
                      setPen(c);
                    }
                  }}
                  style={[st.color, { backgroundColor: c }, color === c && st.colorActive]}
                />
              ))}
              {tool === 'pen' && (
                <>
                  <View style={st.sep} />
                  {[2, 3, 5, 8].map((w) => (
                    <Pressable
                      key={w}
                      onPress={() => {
                        toolMemory.penW = w;
                        setPenW(w);
                      }}
                      style={[st.width, penW === w && st.colorActive]}
                    >
                      <View style={{ width: w + 2, height: w + 2, borderRadius: 10, backgroundColor: pen }} />
                    </Pressable>
                  ))}
                </>
              )}
            </>
          )}
          <View style={st.sep} />
          <IconBtn icon="↶" title="Deshacer" onPress={undo} />
          <IconBtn icon="🗑️" title="Borrar dibujos" onPress={clearInk} />
          <View style={st.sep} />
          <IconBtn icon="🟨" title="Post-it" onPress={() => addPostIt('note')} />
          <IconBtn icon="⭐" title="Stickers" active={stickers} onPress={() => setStickers((v) => !v)} />
          {right}
        </ScrollView>
      </View>
      {stickers && (
        <View style={st.stickerBar}>
          {STICKERS.map((e) => (
            <Pressable key={e} onPress={() => addPostIt('sticker', e)} style={{ padding: 4 }}>
              <Text style={{ fontSize: 28 }}>{e}</Text>
            </Pressable>
          ))}
          <Text style={{ color: C.inkSoft, fontSize: 12, marginLeft: 8 }}>Mantené presionado un sticker para quitarlo</Text>
        </View>
      )}
      <View style={[{ flex: 1 }, pageStyle]} onLayout={onLayout}>
        {children(api)}
        <InkLayer
          strokes={page.strokes}
          tool={tool}
          color={color}
          width={width}
          stylusOnly={stylusOnly === '1'}
          onAdd={onAdd}
          onErase={onErase}
        />
        {page.postits.map((p) => (
          <PostItView key={p.id} p={p} onChange={changePostIt} onDelete={() => deletePostIt(p.id)} />
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  toolbar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFE4CF', borderBottomWidth: 1,
    borderBottomColor: '#D8C8AA', paddingHorizontal: 8, minHeight: 54,
  },
  tbLeft: { flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  tbTools: { alignItems: 'center', gap: 2, paddingRight: 8 },
  sep: { width: 1, height: 28, backgroundColor: '#CDBFA9', marginHorizontal: 6 },
  color: { width: 26, height: 26, borderRadius: 13, marginHorizontal: 3, borderWidth: 1, borderColor: '#0002' },
  colorActive: { borderWidth: 3, borderColor: C.accent },
  width: {
    width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginHorizontal: 2,
    backgroundColor: '#fff',
  },
  stickerBar: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#FFF8E7',
    paddingHorizontal: 10, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#E5D6B8',
  },
  postit: {
    position: 'absolute', borderRadius: 2, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5,
    shadowOffset: { width: 2, height: 3 }, elevation: 6, transform: [{ rotate: '-1deg' }],
  },
  postitBar: {
    height: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
    paddingHorizontal: 8, backgroundColor: '#00000010',
  },
  postitGrip: { flex: 1, color: '#0005', fontSize: 12 },
  postitBtn: { fontSize: 15 },
  postitText: { flex: 1, padding: 8, fontSize: 16, color: '#333' },
  resize: { position: 'absolute', right: 2, bottom: 0, padding: 4 },
});
