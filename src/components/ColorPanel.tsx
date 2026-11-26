import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getSetting, setSetting } from '../db';
import { C } from '../theme';

/** Paleta grande: filas por tono, de claros a oscuros */
const HUES = [0, 15, 30, 45, 60, 90, 120, 150, 175, 200, 220, 245, 270, 295, 320, 345];
const BIG_PALETTE: string[] = [
  '#000000', '#2B2B2B', '#555555', '#808080', '#AAAAAA', '#D0D0D0', '#EEEEEE', '#FFFFFF',
  '#5D4037', '#8D6E63', '#BCAAA4', '#1F2A44', '#37474F', '#78909C', '#B0BEC5', '#ECEFF1',
  ...HUES.flatMap((h) => [hsv(h, 0.85, 0.55), hsv(h, 0.85, 0.85), hsv(h, 0.45, 1)]),
];

export function hsv(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    const x = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(x * 255).toString(16).padStart(2, '0');
  };
  return `#${f(5)}${f(3)}${f(1)}`.toUpperCase();
}

function toHsv(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [0, 1, 1];
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx];
}

/** Barra deslizable simple (0..1) */
function Bar({ value, onChange, colors }: { value: number; onChange: (v: number) => void; colors: string[] }) {
  const w = useRef(1);
  const set = (x: number) => onChange(Math.max(0, Math.min(1, x / w.current)));
  return (
    <View
      style={st.bar}
      onLayout={(e) => (w.current = e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => set(e.nativeEvent.locationX)}
      onResponderMove={(e) => set(e.nativeEvent.locationX)}
    >
      <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', borderRadius: 11, overflow: 'hidden' }]} pointerEvents="none">
        {colors.map((c, i) => <View key={i} style={{ flex: 1, backgroundColor: c }} />)}
      </View>
      <View pointerEvents="none" style={[st.knob, { left: `${value * 100}%` }]} />
    </View>
  );
}

export function loadCustomColors(): string[] {
  try {
    const a = JSON.parse(getSetting('customColors', '[]'));
    return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export default function ColorPanel({
  current, onPick, onClose,
}: { current: string; onPick: (c: string) => void; onClose: () => void }) {
  const [custom, setCustom] = useState(loadCustomColors);
  const [h0, s0, v0] = toHsv(current);
  const [h, setH] = useState(h0);
  const [s, setS] = useState(s0);
  const [v, setV] = useState(v0);
  const [hex, setHex] = useState(current.toUpperCase());
  const mine = hsv(h, s, v);

  const apply = (nh: number, ns: number, nv: number) => {
    setH(nh); setS(ns); setV(nv);
    const c = hsv(nh, ns, nv);
    setHex(c);
    onPick(c);
  };
  const save = () => {
    const next = [mine, ...custom.filter((c) => c !== mine)].slice(0, 24);
    setCustom(next);
    setSetting('customColors', JSON.stringify(next));
  };
  const remove = (c: string) => {
    const next = custom.filter((x) => x !== c);
    setCustom(next);
    setSetting('customColors', JSON.stringify(next));
  };
  const typeHex = (t: string) => {
    const x = t.startsWith('#') ? t : '#' + t;
    setHex(x.toUpperCase());
    if (/^#[0-9a-f]{6}$/i.test(x)) {
      const [nh, ns, nv] = toHsv(x);
      setH(nh); setS(ns); setV(nv);
      onPick(x.toUpperCase());
    }
  };
  const Sw = ({ c, onLong }: { c: string; onLong?: () => void }) => (
    <Pressable
      onPress={() => {
        const [nh, ns, nv] = toHsv(c);
        setH(nh); setS(ns); setV(nv); setHex(c); onPick(c);
      }}
      onLongPress={onLong}
      style={[st.sw, { backgroundColor: c }, current.toUpperCase() === c.toUpperCase() && st.swOn]}
    />
  );

  return (
    <View style={st.panel}>
      <View style={st.left}>
        <Text style={st.title}>Colores</Text>
        <View style={st.grid}>{BIG_PALETTE.map((c) => <Sw key={c} c={c} />)}</View>
      </View>
      <View style={st.right}>
        <Text style={st.title}>Crear color</Text>
        <Bar value={h / 360} onChange={(x) => apply(x * 360, s, v)} colors={HUES.concat(360).map((x) => hsv(x % 360, 1, 1))} />
        <Bar value={s} onChange={(x) => apply(h, x, v)} colors={[hsv(h, 0, v), hsv(h, 1, v)]} />
        <Bar value={v} onChange={(x) => apply(h, s, x)} colors={[hsv(h, s, 0), hsv(h, s, 1)]} />
        <View style={st.row}>
          <View style={[st.preview, { backgroundColor: mine }]} />
          <TextInput value={hex} onChangeText={typeHex} autoCapitalize="characters" maxLength={7} style={st.hex} />
          <Pressable onPress={save} style={st.btn}><Text style={st.btnT}>＋ Guardar</Text></Pressable>
          <Pressable onPress={onClose} style={[st.btn, { backgroundColor: '#8886' }]}><Text style={st.btnT}>Listo</Text></Pressable>
        </View>
        {custom.length > 0 && (
          <>
            <Text style={st.hint}>Mis colores (mantené presionado para borrar)</Text>
            <View style={st.grid}>{custom.map((c) => <Sw key={c} c={c} onLong={() => remove(c)} />)}</View>
          </>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  panel: {
    flexDirection: 'row', backgroundColor: '#FFF8E7', padding: 10, gap: 16,
    borderBottomWidth: 1, borderBottomColor: '#E5D6B8',
  },
  left: { flex: 1.2 },
  right: { flex: 1, gap: 8 },
  title: { fontWeight: '700', color: C.ink, marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  sw: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#0003' },
  swOn: { borderWidth: 3, borderColor: C.accent },
  bar: { height: 24, borderRadius: 12, justifyContent: 'center' },
  knob: {
    position: 'absolute', width: 8, height: 30, marginLeft: -4, borderRadius: 4,
    backgroundColor: '#fff', borderWidth: 2, borderColor: '#333', top: -3,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  preview: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#0004' },
  hex: { width: 92, borderWidth: 1, borderColor: '#CDBFA9', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, color: C.ink, backgroundColor: '#fff' },
  btn: { backgroundColor: C.accent, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  btnT: { color: '#fff', fontWeight: '700' },
  hint: { color: C.inkSoft, fontSize: 12 },
});
