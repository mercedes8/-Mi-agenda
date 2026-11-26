import { Canvas, Image as SkiaImage, makeImageFromView, SkImage } from '@shopify/react-native-skia';
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { C } from '../theme';

export type FlipDir = 'next' | 'prev';
type FlipFn = (dir: FlipDir, change: () => void) => void;

type ViewRef = React.ComponentRef<typeof View>;
type Ctx = { flip: FlipFn; spineRef: React.RefObject<ViewRef | null> };
// makeImageFromView acepta cualquier instancia nativa (usa findNodeHandle)
const snapshot = (ref: React.RefObject<ViewRef | null>) =>
  makeImageFromView(ref as unknown as React.RefObject<number | null>);
const FlipCtx = createContext<Ctx | null>(null);

/** Devuelve la función para pasar de hoja con animación (o null si la pantalla no la soporta) */
export function useFlip(): FlipFn | null {
  return useContext(FlipCtx)?.flip ?? null;
}

/** Lomo central de la agenda: marca el eje sobre el que gira la hoja */
export function Spine({ children, style }: { children?: React.ReactNode; style?: object }) {
  const ctx = useContext(FlipCtx);
  return (
    <View ref={ctx?.spineRef} collapsable={false} style={style}>
      {children}
    </View>
  );
}

const measure = (ref: React.RefObject<ViewRef | null>) =>
  new Promise<{ x: number; y: number; w: number; h: number } | null>((resolve) => {
    if (!ref.current) return resolve(null);
    ref.current.measureInWindow((x, y, w, h) => resolve({ x, y, w, h }));
  });

type FlipState = {
  dir: FlipDir;
  old: SkImage;
  nu: SkImage | null;
  w: number;
  h: number;
  axis: number;
  phase: 1 | 2;
};

const PHASE_MS = 330;

/**
 * Controlador del pase de hoja: saca una "foto" de la página antes de cambiar la fecha
 * y anima una hoja que gira en 3D sobre el lomo, como una agenda de papel.
 */
export function usePageFlip(axisMode: 'center' | 'left' = 'center') {
  const pageRef = useRef<ViewRef | null>(null);
  const spineRef = useRef<ViewRef | null>(null);
  const busy = useRef(false);
  const [st, setSt] = useState<FlipState | null>(null);
  const a = useRef(new Animated.Value(0)).current;

  const flip = useCallback<FlipFn>(
    async (dir, change) => {
      if (busy.current) return;
      busy.current = true;
      let old: SkImage | null = null;
      try {
        old = await snapshot(pageRef);
      } catch {
        old = null;
      }
      const page = await measure(pageRef);
      if (!old || !page) {
        change();
        busy.current = false;
        return;
      }
      const spine = await measure(spineRef);
      const axis = spine ? spine.x + spine.w / 2 - page.x : axisMode === 'left' ? 0 : page.w / 2;
      a.setValue(0);
      setSt({ dir, old, nu: null, w: page.w, h: page.h, axis, phase: 1 });
      // La hoja vieja ya tapa la pantalla: cambiamos la fecha por debajo
      requestAnimationFrame(() => {
        change();
        setTimeout(async () => {
          let nu: SkImage | null = null;
          try {
            nu = await snapshot(pageRef);
          } catch {}
          setSt((x) => (x ? { ...x, nu } : x));
        }, 140);
      });
      Animated.timing(a, {
        toValue: 1, duration: PHASE_MS, easing: Easing.in(Easing.quad), useNativeDriver: true,
      }).start(() => {
        setSt((x) => (x ? { ...x, phase: 2 } : x));
        Animated.timing(a, {
          toValue: 2, duration: PHASE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true,
        }).start(() => {
          setSt(null);
          busy.current = false;
        });
      });
    },
    [a, axisMode],
  );

  const ctx = useMemo<Ctx>(() => ({ flip, spineRef }), [flip]);
  const overlay = st ? <FlipOverlay st={st} a={a} /> : null;
  return { ctx, pageRef, overlay, flip };
}

export function FlipProvider({ value, children }: { value: Ctx; children: React.ReactNode }) {
  return <FlipCtx.Provider value={value}>{children}</FlipCtx.Provider>;
}

/** Esquinas dobladas + bordes deslizables para pasar la hoja con el dedo */
export function PageCorners({ onTurn }: { onTurn: (d: FlipDir) => void }) {
  const turn = useRef(onTurn);
  turn.current = onTurn;
  const make = (dir: FlipDir) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderRelease: (_, g) => {
        if (dir === 'next' && g.dx < -30) turn.current('next');
        if (dir === 'prev' && g.dx > 30) turn.current('prev');
      },
    });
  const right = useRef(make('next')).current;
  const left = useRef(make('prev')).current;
  return (
    <>
      <View style={[s.edge, { right: 0 }]} {...right.panHandlers} />
      <View style={[s.edge, { left: 0 }]} {...left.panHandlers} />
      <Pressable style={[s.corner, { right: 2 }]} onPress={() => onTurn('next')} hitSlop={10} accessibilityLabel="Hoja siguiente">
        <View style={[s.fold, s.foldRight]} />
      </Pressable>
      <Pressable style={[s.corner, { left: 2 }]} onPress={() => onTurn('prev')} hitSlop={10} accessibilityLabel="Hoja anterior">
        <View style={[s.fold, s.foldLeft]} />
      </Pressable>
    </>
  );
}

function Half({
  img, nu, w, h, from, to,
}: { img: SkImage | null; nu?: boolean; w: number; h: number; from: number; to: number }) {
  const width = to - from;
  return (
    <View style={{ width, height: h, overflow: 'hidden', backgroundColor: C.paper }}>
      {img && (
        <Canvas style={{ width: w, height: h, marginLeft: -from }}>
          <SkiaImage image={img} x={0} y={0} width={w} height={h} fit="fill" />
        </Canvas>
      )}
      {!img && nu && <View style={{ flex: 1, backgroundColor: C.paper }} />}
    </View>
  );
}

function FlipOverlay({ st, a }: { st: FlipState; a: Animated.Value }) {
  const { dir, old, nu, w, h, axis, phase } = st;
  const next = dir === 'next';

  // Fase 1: la hoja vieja se levanta (0→90°). Fase 2: aterriza mostrando la nueva (90→0°).
  const lift = a.interpolate({ inputRange: [0, 1, 2], outputRange: next ? ['0deg', '-90deg', '-90deg'] : ['0deg', '90deg', '90deg'] });
  const land = a.interpolate({ inputRange: [0, 1, 2], outputRange: next ? ['90deg', '90deg', '0deg'] : ['-90deg', '-90deg', '0deg'] });
  const shadeLift = a.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 0.45, 0.45] });
  const shadeLand = a.interpolate({ inputRange: [0, 1, 2], outputRange: [0.45, 0.45, 0] });
  const castShadow = a.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 0.25, 0] });

  // Lado que gira primero y lado donde aterriza
  const liftFrom = next ? axis : 0, liftTo = next ? w : axis;
  const landFrom = next ? 0 : axis, landTo = next ? axis : w;
  // Lado fijo que todavía muestra la hoja vieja hasta que aterriza la nueva
  const keepFrom = landFrom, keepTo = landTo;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* lado que sigue mostrando la página vieja */}
      <View style={{ position: 'absolute', left: keepFrom, top: 0 }}>
        <Half img={old} w={w} h={h} from={keepFrom} to={keepTo} />
      </View>
      {/* sombra que proyecta la hoja sobre la página nueva */}
      <Animated.View
        style={{ position: 'absolute', left: liftFrom, width: liftTo - liftFrom, top: 0, height: h, backgroundColor: '#000', opacity: castShadow }}
      />
      {phase === 1 && (
        <Animated.View
          style={{
            position: 'absolute', left: liftFrom, top: 0,
            transformOrigin: next ? 'left center' : 'right center',
            transform: [{ perspective: 1800 }, { rotateY: lift }],
          }}
        >
          <Half img={old} w={w} h={h} from={liftFrom} to={liftTo} />
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: shadeLift }]} />
        </Animated.View>
      )}
      {phase === 2 && (
        <Animated.View
          style={{
            position: 'absolute', left: landFrom, top: 0,
            transformOrigin: next ? 'right center' : 'left center',
            transform: [{ perspective: 1800 }, { rotateY: land }],
          }}
        >
          <Half img={nu} nu w={w} h={h} from={landFrom} to={landTo} />
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: shadeLand }]} />
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  edge: { position: 'absolute', top: 60, bottom: 60, width: 26 },
  corner: { position: 'absolute', bottom: 6, width: 46, height: 46 },
  fold: {
    position: 'absolute', bottom: 0, width: 0, height: 0, borderStyle: 'solid', borderTopWidth: 40,
    borderTopColor: 'transparent',
  },
  foldRight: { right: 0, borderLeftWidth: 40, borderLeftColor: '#E3D3B2' },
  foldLeft: { left: 0, borderRightWidth: 40, borderRightColor: '#E3D3B2' },
});
