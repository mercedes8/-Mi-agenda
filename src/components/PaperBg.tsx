import { Canvas, Path } from '@shopify/react-native-skia';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { C } from '../theme';

export type Paper = 'rayado' | 'cuadriculado' | 'punteado' | 'liso';
export const PAPERS: [Paper, string][] = [
  ['rayado', 'Rayado'], ['cuadriculado', 'Cuadriculado'], ['punteado', 'Punteado'], ['liso', 'Liso'],
];

/** Fondo de papel dibujado con Skia (no recibe toques) */
export function PaperBg({ paper, gap = 32, top = 0, margin = true }: { paper: Paper; gap?: number; top?: number; margin?: boolean }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const { lines, dots } = useMemo(() => {
    const { w, h } = size;
    let lines = '', dots = '';
    if (!w || !h) return { lines, dots };
    if (paper === 'rayado' || paper === 'cuadriculado') {
      for (let y = top + gap; y < h; y += gap) lines += `M0 ${y} L${w} ${y} `;
    }
    if (paper === 'cuadriculado') {
      for (let x = gap; x < w; x += gap) lines += `M${x} ${top} L${x} ${h} `;
    }
    if (paper === 'punteado') {
      for (let y = top + gap; y < h; y += gap) for (let x = gap; x < w; x += gap) dots += `M${x} ${y} L${x + 0.1} ${y} `;
    }
    return { lines, dots };
  }, [size, paper, gap, top]);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        {lines ? <Path path={lines} color={C.line} style="stroke" strokeWidth={1} /> : null}
        {dots ? <Path path={dots} color="#B9B0A0" style="stroke" strokeWidth={3} strokeCap="round" /> : null}
        {margin && paper === 'rayado' ? (
          <Path path={`M56 ${top} L56 ${size.h}`} color={C.margin} style="stroke" strokeWidth={1.5} />
        ) : null}
      </Canvas>
    </View>
  );
}

/** Anillas de carpeta en el borde de una hoja */
export function Rings({ side = 'left', count = 7 }: { side?: 'left' | 'right'; count?: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute', top: 0, bottom: 0, [side]: -12, width: 24,
        justifyContent: 'space-evenly', alignItems: 'center',
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: 22, height: 10, borderRadius: 5, backgroundColor: C.ring, borderWidth: 2, borderColor: '#777' }} />
      ))}
    </View>
  );
}
