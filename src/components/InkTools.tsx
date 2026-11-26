import { Canvas, Group, Path } from '@shopify/react-native-skia';
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  GestureDetector, PointerType, usePanGesture, usePinchGesture, useSimultaneousGestures,
} from 'react-native-gesture-handler';
import type { PostIt, Stroke } from '../db';
import { strokeGeom } from '../ink';
import { C, HIGHLIGHT_COLORS, PEN_COLORS, POSTIT_COLORS, STICKERS } from '../theme';
import ColorPanel from './ColorPanel';
import { IconBtn } from './ui';

/* =================== Herramientas =================== */

export type Tool = 'type' | 'pen' | 'highlighter' | 'eraser';
export type PenKind = 'pluma' | 'birome';

// Preferencias compartidas entre hojas mientras la app está abierta
const mem = { tool: 'type' as Tool, pen: PEN_COLORS[0], hl: HIGHLIGHT_COLORS[0], penW: 3, hlW: 18, kind: 'pluma' as PenKind };

export type InkTools = {
  tool: Tool;
  color: string;
  width: number;
  kind: PenKind;
};

export function useInkTools(opts: {
  left?: React.ReactNode;
  right?: React.ReactNode;
  onUndo: () => void;
  onClear: () => void;
  onPostIt?: () => void;
  onSticker?: (emoji: string) => void;
  typeIcon?: string;
  typeTitle?: string;
}) {
  const [tool, setToolS] = useState<Tool>(mem.tool);
  const [pen, setPen] = useState(mem.pen);
  const [hl, setHl] = useState(mem.hl);
  const [penW, setPenW] = useState(mem.penW);
  const [kind, setKindS] = useState<PenKind>(mem.kind);
  const [stickers, setStickers] = useState(false);
  const [colors, setColors] = useState(false);

  const setTool = (t: Tool) => {
    mem.tool = t;
    setToolS(t);
  };
  const setKind = (k: PenKind) => {
    mem.kind = k;
    setKindS(k);
    setTool('pen');
  };
  const color = tool === 'highlighter' ? hl : pen;
  const width = tool === 'highlighter' ? mem.hlW : penW;
  const palette = tool === 'highlighter' ? HIGHLIGHT_COLORS : PEN_COLORS;

  const toolbar = (
    <View>
      <View style={st.toolbar}>
        {opts.left ? <View style={st.tbLeft}>{opts.left}</View> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.tbTools}>
          <IconBtn icon={opts.typeIcon ?? '⌨️'} title={opts.typeTitle ?? 'Teclado'} active={tool === 'type'} onPress={() => setTool('type')} />
          <IconBtn icon="✒️" title="Pluma (varía con la presión)" active={tool === 'pen' && kind === 'pluma'} onPress={() => setKind('pluma')} />
          <IconBtn icon="🖊️" title="Birome (trazo parejo)" active={tool === 'pen' && kind === 'birome'} onPress={() => setKind('birome')} />
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
                      mem.hl = c;
                      setHl(c);
                    } else {
                      mem.pen = c;
                      setPen(c);
                    }
                  }}
                  style={[st.color, { backgroundColor: c }, color === c && st.colorActive]}
                />
              ))}
              <IconBtn icon="🎨" title="Más colores y crear color" active={colors} onPress={() => setColors((v) => !v)} />
              {tool === 'pen' && (
                <>
                  <View style={st.sep} />
                  {[1.5, 2.5, 4, 7].map((w) => (
                    <Pressable
                      key={w}
                      onPress={() => {
                        mem.penW = w;
                        setPenW(w);
                      }}
                      style={[st.width, penW === w && st.colorActive]}
                    >
                      <View style={{ width: w * 1.6 + 2, height: w * 1.6 + 2, borderRadius: 10, backgroundColor: pen }} />
                    </Pressable>
                  ))}
                </>
              )}
            </>
          )}
          <View style={st.sep} />
          <IconBtn icon="↶" title="Deshacer" onPress={opts.onUndo} />
          <IconBtn icon="🗑️" title="Borrar dibujos" onPress={opts.onClear} />
          {opts.onPostIt && (
            <>
              <View style={st.sep} />
              <IconBtn icon="🟨" title="Post-it" onPress={opts.onPostIt} />
            </>
          )}
          {opts.onSticker && <IconBtn icon="⭐" title="Stickers" active={stickers} onPress={() => setStickers((v) => !v)} />}
          {opts.right}
        </ScrollView>
      </View>
      {colors && (tool === 'pen' || tool === 'highlighter') && (
        <ColorPanel
          current={color}
          onClose={() => setColors(false)}
          onPick={(c) => {
            if (tool === 'highlighter') {
              mem.hl = c;
              setHl(c);
            } else {
              mem.pen = c;
              setPen(c);
            }
          }}
        />
      )}
      {stickers && opts.onSticker && (
        <View style={st.stickerBar}>
          {STICKERS.map((e) => (
            <Pressable
              key={e}
              onPress={() => {
                opts.onSticker!(e);
                setStickers(false);
              }}
              style={{ padding: 4 }}
            >
              <Text style={{ fontSize: 28 }}>{e}</Text>
            </Pressable>
          ))}
          <Text style={{ color: C.inkSoft, fontSize: 12, marginLeft: 8 }}>Mantené presionado un sticker para quitarlo</Text>
        </View>
      )}
    </View>
  );

  const tools: InkTools = { tool, color, width, kind };
  return { tools, setTool, toolbar };
}

/** Historial simple de trazos para deshacer */
export function useStrokeHistory(resetKey: string) {
  const h = useRef<Stroke[][]>([]);
  useEffect(() => {
    h.current = [];
  }, [resetKey]);
  return {
    push: (s: Stroke[]) => {
      h.current.push(s);
      if (h.current.length > 60) h.current.shift();
    },
    pop: () => h.current.pop(),
  };
}

export function confirmClear(onYes: () => void) {
  Alert.alert('Borrar dibujos', '¿Borrar todo lo escrito a mano en esta hoja?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Borrar', style: 'destructive', onPress: onYes },
  ]);
}

/* =================== Dibujo de trazos =================== */

export const StrokeView = memo(function StrokeView({ s }: { s: Stroke }) {
  const g = useMemo(() => strokeGeom(s), [s]);
  if (!g.d) return null;
  return g.fill ? (
    <Path path={g.d} color={s.c} opacity={s.o} style="fill" />
  ) : (
    <Path path={g.d} color={s.c} opacity={s.o} style="stroke" strokeWidth={s.w} strokeCap="round" strokeJoin="round" />
  );
});

export const Strokes = memo(function Strokes({ strokes }: { strokes: Stroke[] }) {
  return (
    <Group>
      {strokes.map((s, i) => (
        <StrokeView key={i} s={s} />
      ))}
    </Group>
  );
});

export type Viewport = { x: number; y: number; s: number };

/**
 * Capa de tinta. Si se pasa `view`, trabaja en coordenadas de "mundo" con zoom y
 * desplazamiento (pizarra infinita): dos dedos mueven y hacen zoom.
 */
export function InkLayer({
  strokes, tools, stylusOnly, onAdd, onErase, view, onViewChange,
}: {
  strokes: Stroke[];
  tools: InkTools;
  stylusOnly: boolean;
  onAdd: (s: Stroke) => void;
  onErase: (x: number, y: number) => void;
  view?: Viewport;
  onViewChange?: (v: Viewport) => void;
}) {
  const [cur, setCur] = useState<Stroke | null>(null);
  const pts = useRef<number[]>([]);
  const active = useRef(false);
  const pinching = useRef(false);
  const P = useRef({ tools, stylusOnly, onAdd, onErase, view, onViewChange });
  P.current = { tools, stylusOnly, onAdd, onErase, view, onViewChange };
  const pinchStart = useRef<{ v: Viewport; fx: number; fy: number } | null>(null);

  const drawing = tools.tool !== 'type';
  const pannable = !!view;

  const toWorld = (x: number, y: number): [number, number] => {
    const v = P.current.view;
    return v ? [(x - v.x) / v.s, (y - v.y) / v.s] : [x, y];
  };
  const makeStroke = (p: number[], pr: boolean): Stroke => {
    const t = P.current.tools;
    const v = P.current.view;
    const k = t.tool === 'highlighter' ? 'resaltador' : t.kind;
    return { c: t.color, w: t.width / (v?.s ?? 1), o: t.tool === 'highlighter' ? 0.4 : 1, p, v: 2, k, pr };
  };
  const isStylus = useRef(false);

  const draw = usePanGesture({
    runOnJS: true,
    minDistance: 0,
    maxPointers: 1,
    enabled: drawing,
    onBegin: (e) => {
      const T = P.current;
      const stylus = e.pointerType === PointerType.STYLUS;
      if (pinching.current || (T.stylusOnly && !stylus && e.pointerType !== PointerType.MOUSE)) {
        active.current = false;
        return;
      }
      active.current = true;
      isStylus.current = stylus;
      const [x, y] = toWorld(e.x, e.y);
      if (T.tools.tool === 'eraser') {
        T.onErase(x, y);
        return;
      }
      const pr = stylus && e.stylusData?.pressure ? e.stylusData.pressure : 0.5;
      pts.current = [x, y, pr];
      setCur(makeStroke(pts.current.slice(), stylus));
    },
    onUpdate: (e) => {
      if (!active.current) return;
      if (pinching.current) {
        active.current = false;
        setCur(null);
        return;
      }
      const T = P.current;
      const [x, y] = toWorld(e.x, e.y);
      if (T.tools.tool === 'eraser') {
        T.onErase(x, y);
        return;
      }
      const p = pts.current;
      const lx = p[p.length - 3], ly = p[p.length - 2];
      const min = 1.2 / (T.view?.s ?? 1);
      if (Math.abs(x - lx) + Math.abs(y - ly) < min) return;
      const pr = isStylus.current && e.stylusData?.pressure ? e.stylusData.pressure : 0.5;
      p.push(x, y, pr);
      setCur(makeStroke(p.slice(), isStylus.current));
    },
    onFinalize: () => {
      if (!active.current) return;
      active.current = false;
      const T = P.current;
      if (T.tools.tool !== 'eraser' && pts.current.length >= 3) {
        const s = makeStroke(pts.current.map((v) => Math.round(v * 100) / 100), isStylus.current);
        T.onAdd(s);
      }
      pts.current = [];
      setCur(null);
    },
  });

  const pinch = usePinchGesture({
    runOnJS: true,
    enabled: pannable,
    onActivate: (e) => {
      pinching.current = true;
      const v = P.current.view!;
      pinchStart.current = { v, fx: e.focalX, fy: e.focalY };
    },
    onUpdate: (e) => {
      const st0 = pinchStart.current;
      if (!st0 || !('focalX' in e)) return;
      const s = Math.min(6, Math.max(0.15, st0.v.s * e.scale));
      const k = s / st0.v.s;
      // el punto bajo los dedos queda fijo y además sigue el movimiento de los dedos
      const x = st0.fx - (st0.fx - st0.v.x) * k + (e.focalX - st0.fx);
      const y = st0.fy - (st0.fy - st0.v.y) * k + (e.focalY - st0.fy);
      P.current.onViewChange?.({ x, y, s });
    },
    onFinalize: () => {
      pinchStart.current = null;
      setTimeout(() => (pinching.current = false), 50);
    },
  });

  // En la pizarra, con la "mano" se arrastra el lienzo con un dedo
  const moveStart = useRef<Viewport | null>(null);
  const move = usePanGesture({
    runOnJS: true,
    maxPointers: 1,
    enabled: pannable && !drawing,
    onActivate: () => {
      moveStart.current = P.current.view ?? null;
    },
    onUpdate: (e) => {
      const v0 = moveStart.current;
      if (!v0 || pinching.current || !('translationX' in e)) return;
      P.current.onViewChange?.({ ...v0, x: v0.x + e.translationX, y: v0.y + e.translationY });
    },
    onFinalize: () => {
      moveStart.current = null;
    },
  });

  const both = useSimultaneousGestures(draw, pinch, move);
  const transform = view ? [{ translateX: view.x }, { translateY: view.y }, { scale: view.s }] : undefined;

  return (
    <GestureDetector gesture={pannable ? both : draw}>
      <View style={StyleSheet.absoluteFill} pointerEvents={drawing || pannable ? 'auto' : 'none'}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Group transform={transform}>
            <Strokes strokes={strokes} />
            {cur && <StrokeView s={cur} />}
          </Group>
        </Canvas>
      </View>
    </GestureDetector>
  );
}

/* =================== Post-its y stickers =================== */

export function newPostIt(kind: 'note' | 'sticker', x: number, y: number, text = ''): PostIt {
  return {
    id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
    x, y, w: 190, h: 170,
    color: POSTIT_COLORS[Math.floor(Math.random() * POSTIT_COLORS.length)],
    text, kind,
  };
}

export function PostItView({
  p, onChange, onDelete, scale = 1,
}: { p: PostIt; onChange: (p: PostIt) => void; onDelete: () => void; scale?: number }) {
  const [pos, setPos] = useState({ x: p.x, y: p.y, w: p.w, h: p.h });
  const start = useRef(pos);
  const cur = useRef(pos);
  cur.current = pos;
  const pRef = useRef(p);
  pRef.current = p;
  const sc = useRef(scale);
  sc.current = scale;

  useEffect(() => setPos({ x: p.x, y: p.y, w: p.w, h: p.h }), [p.x, p.y, p.w, p.h]);

  // Gestos nativos: tienen prioridad sobre el deslizar para pasar de hoja
  const mover = usePanGesture({
    runOnJS: true,
    minDistance: 2,
    onActivate: () => {
      start.current = cur.current;
    },
    onUpdate: (e) => {
      if (!('translationX' in e)) return;
      setPos({ ...start.current, x: start.current.x + e.translationX / sc.current, y: start.current.y + e.translationY / sc.current });
    },
    onDeactivate: () => onChange({ ...pRef.current, ...cur.current }),
  });
  const resizer = usePanGesture({
    runOnJS: true,
    minDistance: 1,
    onActivate: () => {
      start.current = cur.current;
    },
    onUpdate: (e) => {
      if (!('translationX' in e)) return;
      setPos({
        ...start.current,
        w: Math.max(110, start.current.w + e.translationX / sc.current),
        h: Math.max(90, start.current.h + e.translationY / sc.current),
      });
    },
    onDeactivate: () => onChange({ ...pRef.current, ...cur.current }),
  });

  if (p.kind === 'sticker') {
    return (
      <GestureDetector gesture={mover}>
        <View style={{ position: 'absolute', left: pos.x, top: pos.y }}>
          <Pressable onLongPress={onDelete} delayLongPress={500}>
            <Text style={{ fontSize: 40 }}>{p.text}</Text>
          </Pressable>
        </View>
      </GestureDetector>
    );
  }

  const nextColor = () => {
    const i = POSTIT_COLORS.indexOf(p.color);
    onChange({ ...p, ...cur.current, color: POSTIT_COLORS[(i + 1) % POSTIT_COLORS.length] });
  };

  return (
    <View style={[st.postit, { left: pos.x, top: pos.y, width: pos.w, height: pos.h, backgroundColor: p.color }]}>
      <GestureDetector gesture={mover}>
      <View style={st.postitBar}>
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
      </GestureDetector>
      <TextInput
        multiline
        value={p.text}
        onChangeText={(t) => onChange({ ...p, ...cur.current, text: t })}
        placeholder="Escribí acá…"
        placeholderTextColor="#00000055"
        style={st.postitText}
        textAlignVertical="top"
      />
      <GestureDetector gesture={resizer}>
        <View style={st.resize}>
          <Text style={{ fontSize: 14, color: '#0006' }}>◢</Text>
        </View>
      </GestureDetector>
    </View>
  );
}

export const st = StyleSheet.create({
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
