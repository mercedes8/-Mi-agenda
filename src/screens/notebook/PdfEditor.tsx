import { ImageFormat, PaintStyle, Skia, StrokeCap, StrokeJoin } from '@shopify/react-native-skia';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { PdfRenderer } from '../../../modules/pdf-renderer';
import { useInkHandlers, usePage } from '../../components/InkPage';
import { InkLayer, InkTools, useInkTools } from '../../components/InkTools';
import { IconBtn } from '../../components/ui';
import { loadPage, useSetting } from '../../db';
import { strokeGeom } from '../../ink';
import { dir, Note, noteExtra, notePageKey, setNoteExtra, touchNote } from '../../notebooks';
import { C } from '../../theme';
import { NoteHeader } from './common';

type PageImg = { uri: string; w: number; h: number };
type PdfExtra = { pageImages?: (PageImg | null)[]; dw?: number };
const RENDER_W = 1600;

type Handlers = ReturnType<typeof useInkHandlers>;

function PdfPage({
  note, i, img, width, tools, stylusOnly, onActive,
}: {
  note: Note; i: number; img: PageImg | null; width: number; tools: InkTools; stylusOnly: boolean;
  onActive: (h: Handlers) => void;
}) {
  const key = notePageKey(note.id, i);
  const api = usePage(key);
  const h = useInkHandlers(api, key);
  const height = img ? (width * img.h) / img.w : width * 1.414;
  return (
    <View style={[st.page, { width, height }]}>
      {img ? (
        <Image source={{ uri: img.uri }} style={{ width, height }} resizeMode="stretch" />
      ) : (
        <View style={st.loading}>
          <ActivityIndicator color={C.accent} />
          <Text style={{ color: C.inkSoft }}>Preparando página {i + 1}…</Text>
        </View>
      )}
      <InkLayer
        strokes={api.page.strokes}
        tools={tools}
        stylusOnly={stylusOnly}
        onAdd={(s) => {
          onActive(h);
          h.onAdd(s);
          touchNote(note.id);
        }}
        onErase={(x, y) => {
          onActive(h);
          h.onErase(x, y);
        }}
      />
      <Text style={st.num}>{i + 1}</Text>
    </View>
  );
}

/** PDF con anotaciones a mano sobre cada página */
export function PdfEditor({ note, onBack }: { note: Note; onBack: () => void }) {
  const [stylusOnly] = useSetting('stylusOnly', '0');
  const [images, setImages] = useState<(PageImg | null)[]>(() => noteExtra<PdfExtra>(note).pageImages ?? []);
  const [width, setWidth] = useState(0);
  const [exporting, setExporting] = useState(false);
  const active = useRef<Handlers | null>(null);
  const extraRef = useRef<PdfExtra>(noteExtra<PdfExtra>(note));
  const pages = note.pages || 1;

  // Renderiza las páginas que faltan, de a una
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!PdfRenderer || !note.file) return;
      const imgs = [...(extraRef.current.pageImages ?? [])];
      for (let i = 0; i < pages; i++) {
        if (cancelled) return;
        if (imgs[i] && new File(imgs[i]!.uri).exists) continue;
        try {
          const out = new File(dir('pdf'), `n${note.id}_p${i + 1}.jpg`);
          const r = await PdfRenderer.renderPage(note.file, i, RENDER_W, out.uri);
          imgs[i] = { uri: r.uri, w: r.width, h: r.height };
        } catch (e) {
          console.warn(e);
          imgs[i] = null;
        }
        if (cancelled) return;
        setImages([...imgs]);
        extraRef.current = { ...extraRef.current, pageImages: imgs };
        setNoteExtra(note.id, extraRef.current);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [note.id, note.file, pages]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.min(e.nativeEvent.layout.width - 32, 1100);
    setWidth(w);
    if (!extraRef.current.dw) {
      extraRef.current = { ...extraRef.current, dw: w };
      setNoteExtra(note.id, extraRef.current);
    }
  };

  const exportPdf = async () => {
    if (!PdfRenderer) return;
    setExporting(true);
    try {
      const dw = extraRef.current.dw || width;
      const outs: string[] = [];
      for (let i = 0; i < pages; i++) {
        const img = images[i];
        if (!img) continue;
        const data = await Skia.Data.fromURI(img.uri);
        const bg = Skia.Image.MakeImageFromEncoded(data);
        const surface = Skia.Surface.Make(img.w, img.h);
        if (!bg || !surface) continue;
        const canvas = surface.getCanvas();
        canvas.drawImage(bg, 0, 0);
        const k = img.w / dw;
        canvas.scale(k, k);
        for (const s of loadPage(notePageKey(note.id, i)).strokes) {
          const g = strokeGeom(s);
          const path = g.d ? Skia.Path.MakeFromSVGString(g.d) : null;
          if (!path) continue;
          const paint = Skia.Paint();
          paint.setAntiAlias(true);
          paint.setColor(Skia.Color(s.c));
          paint.setAlphaf(s.o);
          if (g.fill) paint.setStyle(PaintStyle.Fill);
          else {
            paint.setStyle(PaintStyle.Stroke);
            paint.setStrokeWidth(s.w);
            paint.setStrokeCap(StrokeCap.Round);
            paint.setStrokeJoin(StrokeJoin.Round);
          }
          canvas.drawPath(path, paint);
        }
        surface.flush();
        const bytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.JPEG, 88);
        const f = new File(dir('export'), `pag_${i + 1}.jpg`);
        if (f.exists) f.delete();
        f.create();
        f.write(bytes);
        outs.push(f.uri);
      }
      const safe = note.title.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'documento';
      const out = new File(dir('export'), `${safe} (anotado).pdf`);
      if (out.exists) out.delete();
      const uri = await PdfRenderer.imagesToPdf(outs, out.uri);
      outs.forEach((u) => new File(u).delete());
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Compartir PDF anotado' });
    } catch (e) {
      Alert.alert('No se pudo exportar', String(e));
    } finally {
      setExporting(false);
    }
  };

  const onActive = useCallback((h: Handlers) => {
    active.current = h;
  }, []);

  const { tools, toolbar } = useInkTools({
    left: <NoteHeader note={note} onBack={onBack} width={200} />,
    typeIcon: '✋',
    typeTitle: 'Desplazar',
    onUndo: () => active.current?.undo(),
    onClear: () => active.current?.clear(),
    right: (
      <>
        <View style={{ width: 1, height: 28, backgroundColor: '#CDBFA9', marginHorizontal: 6 }} />
        <Text style={{ color: C.inkSoft, fontSize: 13 }}>{pages} pág.</Text>
        {exporting ? <ActivityIndicator color={C.accent} style={{ marginHorizontal: 10 }} /> : <IconBtn icon="📤" title="Exportar PDF anotado" onPress={exportPdf} />}
      </>
    ),
  });

  if (!PdfRenderer) {
    return (
      <View style={{ flex: 1 }}>
        {toolbar}
        <Text style={{ padding: 20 }}>Esta versión de la app no tiene el lector de PDF.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {toolbar}
      <View style={st.wrap} onLayout={onLayout}>
        {width > 0 && (
          <FlatList
            data={Array.from({ length: pages }, (_, i) => i)}
            keyExtractor={(i) => String(i)}
            scrollEnabled={tools.tool === 'type'}
            windowSize={3}
            initialNumToRender={2}
            contentContainerStyle={{ alignItems: 'center', paddingVertical: 16, gap: 16 }}
            renderItem={({ item: i }) => (
              <PdfPage
                note={note}
                i={i}
                img={images[i] ?? null}
                width={width}
                tools={tools}
                stylusOnly={stylusOnly === '1'}
                onActive={onActive}
              />
            )}
          />
        )}
        {tools.tool !== 'type' && <Text style={st.tip}>Para desplazarte, elegí ✋</Text>}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#5E5E5E' },
  page: { backgroundColor: '#fff', elevation: 4, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  num: { position: 'absolute', bottom: 6, right: 10, fontSize: 12, color: '#999' },
  tip: {
    position: 'absolute', bottom: 12, alignSelf: 'center', backgroundColor: '#000a', color: '#fff',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, fontSize: 13,
  },
});
