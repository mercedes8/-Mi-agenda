import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import { loadPage, PageData, PostIt, registerOpenPage, savePage, Stroke, useSetting } from '../db';
import { hits } from '../ink';
import { confirmClear, InkLayer, newPostIt, PostItView, useInkTools, useStrokeHistory } from './InkTools';
import { FlipDir, FlipProvider, PageCorners, PageFlipApi, SwipeToTurn, usePageFlip } from './PageFlip';

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
        if (next === prev) return prev;
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

  useEffect(() => registerOpenPage(key, update), [key, update]);

  return { page, update, setField, flush };
}

export type PageApi = ReturnType<typeof usePage>;

/** Lógica de tinta + post-its de una página (sin barra), reutilizable en PDF y pizarra */
export function useInkHandlers(api: PageApi, resetKey: string) {
  const { update } = api;
  const history = useStrokeHistory(resetKey);
  const onAdd = useCallback(
    (s: Stroke) =>
      update((p) => {
        history.push(p.strokes);
        return { ...p, strokes: [...p.strokes, s] };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [update],
  );
  const onErase = useCallback(
    (x: number, y: number) =>
      update((p) => {
        const keep = p.strokes.filter((s) => !hits(s, x, y));
        if (keep.length === p.strokes.length) return p;
        history.push(p.strokes);
        return { ...p, strokes: keep };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [update],
  );
  const undo = () => {
    const prev = history.pop();
    if (prev) update((p) => ({ ...p, strokes: prev }));
  };
  const clear = () =>
    confirmClear(() =>
      update((p) => {
        history.push(p.strokes);
        return { ...p, strokes: [] };
      }),
    );
  const addPostIt = (p: PostIt) => update((pg) => ({ ...pg, postits: [...pg.postits, p] }));
  const changePostIt = (np: PostIt) =>
    update((pg) => ({ ...pg, postits: pg.postits.map((p) => (p.id === np.id ? np : p)) }));
  const deletePostIt = (id: string) => update((pg) => ({ ...pg, postits: pg.postits.filter((p) => p.id !== id) }));
  return { onAdd, onErase, undo, clear, addPostIt, changePostIt, deletePostIt };
}

/* =================== Página con tinta =================== */

type Props = {
  pageKey: string;
  /** Contenido de la barra a la izquierda (navegación de fechas, título) */
  left?: React.ReactNode;
  /** Botones extra a la derecha de la barra */
  right?: React.ReactNode;
  /** Fondo/contenido de la hoja. Recibe la página para leer/escribir campos */
  children: (api: PageApi) => React.ReactNode;
  pageStyle?: object;
  /** Cambia la fecha/hoja al pasar de página (esquinas / deslizar). Si falta, no se puede pasar de hoja. */
  turn?: (dir: FlipDir) => void;
  /** Eje de giro si la pantalla no tiene lomo: 'left' = cuaderno que se da vuelta desde el borde */
  flipAxis?: 'center' | 'left';
  /** Si devuelve false, no se pasa de hoja en esa dirección */
  canTurn?: (dir: FlipDir) => boolean;
};

export function InkPage({ pageKey, left, right, children, pageStyle, turn, flipAxis, canTurn }: Props) {
  const api = usePage(pageKey);
  const { page } = api;
  const pf = usePageFlip(flipAxis);
  const h = useInkHandlers(api, pageKey);
  const [stylusOnly] = useSetting('stylusOnly', '0');
  const [size, setSize] = useState({ w: 800, h: 600 });

  const place = () => ({
    x: Math.round(size.w * 0.35 + Math.random() * 120),
    y: Math.round(size.h * 0.2 + Math.random() * 120),
  });
  const { tools, toolbar } = useInkTools({
    left,
    right,
    onUndo: h.undo,
    onClear: h.clear,
    onPostIt: () => {
      const { x, y } = place();
      h.addPostIt(newPostIt('note', x, y));
    },
    onSticker: (e) => {
      const { x, y } = place();
      h.addPostIt(newPostIt('sticker', x, y, e));
    },
  });

  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  return (
    <FlipProvider value={pf.ctx}>
      <View style={{ flex: 1 }}>
        {toolbar}
        <View style={{ flex: 1 }}>
          <MaybeSwipe pf={pf} turn={turn} canTurn={canTurn} enabled={tools.tool === 'type'}>
          <View ref={pf.pageRef} collapsable={false} style={[{ flex: 1 }, pageStyle]} onLayout={onLayout}>
            {children(api)}
            <InkLayer
              strokes={page.strokes}
              tools={tools}
              stylusOnly={stylusOnly === '1'}
              onAdd={h.onAdd}
              onErase={h.onErase}
            />
            {page.postits.map((p) => (
              <PostItView key={p.id} p={p} onChange={h.changePostIt} onDelete={() => h.deletePostIt(p.id)} />
            ))}
            {turn && (
              <PageCorners
                edges={tools.tool !== 'type'}
                onTurn={(d) => (!canTurn || canTurn(d)) && pf.flip(d, () => turn(d))}
              />
            )}
          </View>
          </MaybeSwipe>
          {pf.overlay}
        </View>
      </View>
    </FlipProvider>
  );
}

/** Envuelve la hoja con el gesto de deslizar solo si se puede pasar de hoja */
function MaybeSwipe({
  pf, turn, canTurn, enabled, children,
}: {
  pf: PageFlipApi;
  turn?: (d: FlipDir) => void;
  canTurn?: (d: FlipDir) => boolean;
  enabled: boolean;
  children: React.ReactNode;
}) {
  if (!turn) return <>{children}</>;
  return (
    <SwipeToTurn pf={pf} turn={turn} canTurn={canTurn} enabled={enabled}>
      {children}
    </SwipeToTurn>
  );
}
