import { Canvas, Image as SkiaImage, makeImageFromView, SkImage } from '@shopify/react-native-skia';
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { playPageTurn } from '../sounds';
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
};

const FULL_MS = 640;

/**
 * Controlador del pase de hoja. La "posición" de la hoja va de 0 (apoyada) a 2 (ya del otro lado):
 * de 0 a 1 se levanta la hoja vieja, de 1 a 2 baja mostrando la nueva.
 * Se puede animar sola (botones/esquinas) o seguir el dedo (deslizar).
 */
export function usePageFlip(axisMode: 'center' | 'left' = 'center') {
  const pageRef = useRef<ViewRef | null>(null);
  const spineRef = useRef<ViewRef | null>(null);
  const busy = useRef(false);
  const [st, setSt] = useState<FlipState | null>(null);
  const a = useRef(new Animated.Value(0)).current;
  const drag = useRef<{ ready: boolean; pos: number; ended: null | { commit: boolean; velocity: number }; revert: () => void } | null>(null);

  /** Saca la foto de la hoja actual, monta la hoja animada y cambia la fecha por debajo */
  const prepare = useCallback(
    async (dir: FlipDir, change: () => void): Promise<boolean> => {
      let old: SkImage | null = null;
      try {
        old = await snapshot(pageRef);
      } catch {
        old = null;
      }
      const page = await measure(pageRef);
      if (!old || !page) {
        change();
        return false;
      }
      const spine = await measure(spineRef);
      const axis = spine ? spine.x + spine.w / 2 - page.x : axisMode === 'left' ? 0 : page.w / 2;
      setSt({ dir, old, nu: null, w: page.w, h: page.h, axis });
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
      return true;
    },
    [axisMode],
  );

  const finish = useCallback(() => {
    setSt(null);
    drag.current = null;
    busy.current = false;
  }, []);

  /** Pase de hoja automático (botones, esquinas) */
  const flip = useCallback<FlipFn>(
    async (dir, change) => {
      if (busy.current) return;
      busy.current = true;
      a.setValue(0);
      playPageTurn();
      if (!(await prepare(dir, change))) {
        busy.current = false;
        return;
      }
      Animated.timing(a, { toValue: 2, duration: FULL_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start(finish);
    },
    [a, prepare, finish],
  );

  /* ---------- Pase de hoja siguiendo el dedo ---------- */

  const settle = useCallback(
    (commit: boolean, velocity: number) => {
      const d = drag.current;
      if (!d) return;
      const from = d.pos;
      const to = commit ? 2 : 0;
      const dist = Math.abs(to - from);
      const speed = Math.max(1, Math.abs(velocity) / 900);
      Animated.timing(a, {
        toValue: to,
        duration: Math.max(140, (dist * FULL_MS) / 2 / speed),
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        if (!commit) {
          // se arrepintió: volvemos a la hoja original por debajo y sacamos la animación
          d.revert();
          requestAnimationFrame(finish);
        } else finish();
      });
    },
    [a, finish],
  );

  const beginDrag = useCallback(
    async (dir: FlipDir, change: () => void, revert: () => void) => {
      if (busy.current) return false;
      busy.current = true;
      a.setValue(0);
      drag.current = { ready: false, pos: 0, ended: null, revert };
      playPageTurn();
      const ok = await prepare(dir, change);
      const d = drag.current;
      if (!ok || !d) {
        // sin foto no hay animación: el cambio ya se hizo
        drag.current = null;
        busy.current = false;
        return false;
      }
      d.ready = true;
      a.setValue(d.pos);
      if (d.ended) settle(d.ended.commit, d.ended.velocity);
      return true;
    },
    [a, prepare, settle],
  );

  const moveDrag = useCallback(
    (pos: number) => {
      const d = drag.current;
      if (!d) return;
      d.pos = Math.max(0, Math.min(2, pos));
      if (d.ready) a.setValue(d.pos);
    },
    [a],
  );

  const endDrag = useCallback(
    (commit: boolean, velocity: number) => {
      const d = drag.current;
      if (!d) return;
      if (!d.ready) d.ended = { commit, velocity };
      else settle(commit, velocity);
    },
    [settle],
  );

  const ctx = useMemo<Ctx>(() => ({ flip, spineRef }), [flip]);
  const overlay = st ? <FlipOverlay st={st} a={a} /> : null;
  return { ctx, pageRef, overlay, flip, beginDrag, moveDrag, endDrag };
}

export type PageFlipApi = ReturnType<typeof usePageFlip>;

export function FlipProvider({ value, children }: { value: Ctx; children: React.ReactNode }) {
  return <FlipCtx.Provider value={value}>{children}</FlipCtx.Provider>;
}

/**
 * Deslizar el dedo sobre la hoja para pasarla: la hoja sigue al dedo.
 * Solo se activa con movimientos horizontales, así no molesta al tocar o escribir.
 */
export function SwipeToTurn({
  pf, enabled, turn, canTurn, children,
}: {
  pf: PageFlipApi;
  enabled: boolean;
  turn: (d: FlipDir) => void;
  canTurn?: (d: FlipDir) => boolean;
  children: React.ReactNode;
}) {
  const width = useRef(800);
  const dirRef = useRef<FlipDir | null>(null);
  const P = useRef({ pf, turn, canTurn });
  P.current = { pf, turn, canTurn };

  const pan = usePanGesture({
    runOnJS: true,
    enabled,
    maxPointers: 1,
    activeOffsetX: [-18, 18],
    failOffsetY: [-22, 22],
    onActivate: (e) => {
      const tx = 'translationX' in e ? e.translationX : 0;
      const dir: FlipDir = tx < 0 ? 'next' : 'prev';
      const { canTurn: can, turn: t, pf: f } = P.current;
      if (can && !can(dir)) {
        dirRef.current = null;
        return;
      }
      dirRef.current = dir;
      const back: FlipDir = dir === 'next' ? 'prev' : 'next';
      f.beginDrag(dir, () => t(dir), () => t(back));
    },
    onUpdate: (e) => {
      const dir = dirRef.current;
      if (!dir || !('translationX' in e)) return;
      const tx = dir === 'next' ? -e.translationX : e.translationX;
      P.current.pf.moveDrag((tx / (width.current * 0.42)) * 1);
    },
    onDeactivate: (e) => {
      const dir = dirRef.current;
      if (!dir) return;
      dirRef.current = null;
      const tx = 'translationX' in e ? (dir === 'next' ? -e.translationX : e.translationX) : 0;
      const vx = 'velocityX' in e ? (dir === 'next' ? -e.velocityX : e.velocityX) : 0;
      const pos = tx / (width.current * 0.42);
      const commit = vx > 500 || (pos > 1 && vx > -300);
      P.current.pf.endDrag(commit, vx);
    },
    onFinalize: () => {
      if (dirRef.current) {
        dirRef.current = null;
        P.current.pf.endDrag(false, 0);
      }
    },
  });

  return (
    <GestureDetector gesture={pan}>
      <View style={{ flex: 1 }} onLayout={(e) => (width.current = e.nativeEvent.layout.width)}>
        {children}
      </View>
    </GestureDetector>
  );
}

/** Esquinas dobladas + bordes deslizables (sirven también mientras se escribe a mano) */
export function PageCorners({ onTurn, edges = true }: { onTurn: (d: FlipDir) => void; edges?: boolean }) {
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
      {edges && <View style={[s.edge, { right: 0 }]} {...right.panHandlers} />}
      {edges && <View style={[s.edge, { left: 0 }]} {...left.panHandlers} />}
      <Pressable style={[s.corner, { right: 2 }]} onPress={() => onTurn('next')} hitSlop={10} accessibilityLabel="Hoja siguiente">
        <View style={[s.fold, s.foldRight]} />
      </Pressable>
      <Pressable style={[s.corner, { left: 2 }]} onPress={() => onTurn('prev')} hitSlop={10} accessibilityLabel="Hoja anterior">
        <View style={[s.fold, s.foldLeft]} />
      </Pressable>
    </>
  );
}

function Half({ img, w, h, from, to }: { img: SkImage | null; w: number; h: number; from: number; to: number }) {
  const width = Math.max(0, to - from);
  return (
    <View style={{ width, height: h, overflow: 'hidden', backgroundColor: C.paper }}>
      {img && (
        <Canvas style={{ width: w, height: h, marginLeft: -from }}>
          <SkiaImage image={img} x={0} y={0} width={w} height={h} fit="fill" />
        </Canvas>
      )}
    </View>
  );
}

function FlipOverlay({ st, a }: { st: FlipState; a: Animated.Value }) {
  const { dir, old, nu, w, h, axis } = st;
  const next = dir === 'next';
  const clamp = { extrapolate: 'clamp' as const };

  // 0→1: la hoja vieja se levanta (0→90°). 1→2: baja del otro lado mostrando la nueva (90→0°).
  const lift = a.interpolate({ inputRange: [0, 1], outputRange: ['0deg', next ? '-90deg' : '90deg'], ...clamp });
  const land = a.interpolate({ inputRange: [1, 2], outputRange: [next ? '90deg' : '-90deg', '0deg'], ...clamp });
  const liftOpacity = a.interpolate({ inputRange: [0, 0.999, 1], outputRange: [1, 1, 0], ...clamp });
  const landOpacity = a.interpolate({ inputRange: [0.999, 1], outputRange: [0, 1], ...clamp });
  const shadeLift = a.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45], ...clamp });
  const shadeLand = a.interpolate({ inputRange: [1, 2], outputRange: [0.45, 0], ...clamp });
  const castShadow = a.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 0.25, 0], ...clamp });

  const liftFrom = next ? axis : 0, liftTo = next ? w : axis;
  const landFrom = next ? 0 : axis, landTo = next ? axis : w;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* lado que sigue mostrando la hoja vieja hasta que baja la nueva */}
      <View style={{ position: 'absolute', left: landFrom, top: 0 }}>
        <Half img={old} w={w} h={h} from={landFrom} to={landTo} />
      </View>
      {/* sombra que proyecta la hoja sobre la página nueva */}
      <Animated.View
        style={{ position: 'absolute', left: liftFrom, width: liftTo - liftFrom, top: 0, height: h, backgroundColor: '#000', opacity: castShadow }}
      />
      <Animated.View
        style={{
          position: 'absolute', left: liftFrom, top: 0, opacity: liftOpacity,
          transformOrigin: next ? 'left center' : 'right center',
          transform: [{ perspective: 1800 }, { rotateY: lift }],
        }}
      >
        <Half img={old} w={w} h={h} from={liftFrom} to={liftTo} />
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: shadeLift }]} />
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute', left: landFrom, top: 0, opacity: landOpacity,
          transformOrigin: next ? 'right center' : 'left center',
          transform: [{ perspective: 1800 }, { rotateY: land }],
        }}
      >
        <Half img={nu} w={w} h={h} from={landFrom} to={landTo} />
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: shadeLand }]} />
      </Animated.View>
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
