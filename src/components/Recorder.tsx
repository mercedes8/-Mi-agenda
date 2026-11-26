import {
  RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus,
  useAudioRecorder,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { dir } from '../notebooks';
import { C } from '../theme';

export type Segment = { uri: string; at: number };

const mmss = (sec: number) => {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  const h = Math.floor(m / 60);
  return h ? `${h}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
const toPath = (uri: string) => decodeURI(uri.replace(/^file:\/\//, ''));

function canTranscribe() {
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable() && ExpoSpeechRecognitionModule.supportsRecording();
  } catch {
    return false;
  }
}

/**
 * Grabador con transcripción automática.
 * En Android 13+ usa el reconocedor de voz del sistema y guarda el audio a la vez.
 * Si el equipo no lo permite, graba solo audio.
 * Guarda en la página: fields.audio (partes de audio), fields.transcripcion, fields.audioDur.
 */
export function Recorder({
  fields, setField, compact,
}: { fields: Record<string, string>; setField: (k: string, v: string) => void; compact?: boolean }) {
  const [rec, setRec] = useState(false);
  const [interim, setInterim] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const want = useRef(false);
  const mode = useRef<'stt' | 'audio'>('stt');
  const startAt = useRef(0);
  const base = useRef(0);
  const F = useRef(fields);
  F.current = fields;
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const segments: Segment[] = (() => {
    try {
      return JSON.parse(fields.audio || '[]');
    } catch {
      return [];
    }
  })();
  const now = () => base.current + (Date.now() - startAt.current) / 1000;

  const addSegment = (uri: string) => {
    const segs: Segment[] = JSON.parse(F.current.audio || '[]');
    segs.push({ uri, at: Math.round(base.current) });
    setField('audio', JSON.stringify(segs));
  };
  const appendText = (t: string) => {
    const prev = F.current.transcripcion || '';
    const line = `[${mmss(now())}] ${t.trim()}`;
    const next = prev ? `${prev}\n${line}` : line;
    F.current = { ...F.current, transcripcion: next };
    setField('transcripcion', next);
  };

  function finish() {
    base.current = now();
    setField('audioDur', String(Math.round(base.current)));
    setRec(false);
    setInterim('');
    deactivateKeepAwake('rec').catch(() => {});
  }

  const startStt = () => {
    ExpoSpeechRecognitionModule.start({
      lang: 'es-AR',
      interimResults: true,
      continuous: true,
      addsPunctuation: true,
      recordingOptions: {
        persist: true,
        outputDirectory: toPath(dir('audio').uri),
        outputFileName: `grabacion_${Date.now()}.wav`,
      },
    });
  };

  useSpeechRecognitionEvent('result', (e) => {
    if (!want.current || mode.current !== 'stt') return;
    const t = e.results[0]?.transcript ?? '';
    if (e.isFinal) {
      if (t.trim()) appendText(t);
      setInterim('');
    } else setInterim(t);
  });
  useSpeechRecognitionEvent('audioend', (e) => {
    if (mode.current === 'stt' && e.uri) addSegment(e.uri.startsWith('file://') ? e.uri : `file://${e.uri}`);
  });
  useSpeechRecognitionEvent('end', () => {
    if (mode.current !== 'stt') return;
    if (want.current) setTimeout(() => want.current && startStt(), 250);
    else finish();
  });
  useSpeechRecognitionEvent('error', (e) => {
    if (mode.current !== 'stt' || !want.current) return;
    if (['no-speech', 'speech-timeout', 'aborted', 'client'].includes(e.error)) return; // se reintenta en 'end'
    want.current = false;
    Alert.alert('Transcripción', `Se detuvo el reconocimiento de voz (${e.error}). ${e.message ?? ''}`);
  });

  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setElapsed(now()), 500);
    return () => clearInterval(t);
  }, [rec]);

  useEffect(
    () => () => {
      if (want.current) {
        want.current = false;
        try {
          ExpoSpeechRecognitionModule.stop();
        } catch {}
        deactivateKeepAwake('rec').catch(() => {});
      }
    },
    [],
  );

  const start = async () => {
    base.current = Number(F.current.audioDur || 0);
    startAt.current = Date.now();
    setElapsed(base.current);
    if (canTranscribe()) {
      const p = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!p.granted) return Alert.alert('Permiso', 'Necesito permiso de micrófono y reconocimiento de voz para grabar.');
      mode.current = 'stt';
      want.current = true;
      setRec(true);
      startStt();
    } else {
      const p = await requestRecordingPermissionsAsync();
      if (!p.granted) return Alert.alert('Permiso', 'Necesito permiso de micrófono para grabar.');
      mode.current = 'audio';
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      want.current = true;
      setRec(true);
      Alert.alert('Solo audio', 'Este equipo no permite transcribir mientras graba (hace falta Android 13 o superior). Se va a grabar solo el audio.');
    }
    activateKeepAwakeAsync('rec').catch(() => {});
  };

  const stop = async () => {
    want.current = false;
    if (mode.current === 'stt') {
      ExpoSpeechRecognitionModule.stop(); // 'end' llama a finish()
    } else {
      await recorder.stop();
      const uri = recorder.uri;
      if (uri) {
        try {
          const dest = new File(dir('audio'), `grabacion_${Date.now()}.m4a`);
          await new File(uri).move(dest);
          addSegment(dest.uri);
        } catch {
          addSegment(uri);
        }
      }
      await setAudioModeAsync({ allowsRecording: false });
      finish();
    }
  };

  return (
    <View style={[st.box, compact && { padding: 8 }]}>
      <View style={st.row}>
        <Pressable onPress={rec ? stop : start} style={[st.recBtn, rec && { backgroundColor: C.danger }]}>
          <Text style={st.recText}>{rec ? '⏹ Detener' : segments.length ? '⏺ Seguir grabando' : '⏺ Grabar'}</Text>
        </Pressable>
        <Text style={[st.time, rec && { color: C.danger }]}>
          {rec ? '● ' : ''}
          {mmss(rec ? elapsed : Number(fields.audioDur || 0))}
        </Text>
        {segments.length > 0 && !rec && <Player segments={segments} />}
      </View>
      {rec && interim ? <Text style={st.interim}>… {interim}</Text> : null}
      <Text style={st.label}>Transcripción {rec && mode.current === 'audio' ? '(no disponible en este equipo)' : ''}</Text>
      <ScrollView style={{ maxHeight: compact ? 160 : undefined, flexGrow: compact ? 0 : 1 }}>
        <TextInput
          multiline
          value={fields.transcripcion ?? ''}
          onChangeText={(v) => setField('transcripcion', v)}
          placeholder="Tocá Grabar: lo que se diga aparece acá escrito. Después lo podés corregir."
          placeholderTextColor="#B8AFA2"
          style={st.transcript}
          textAlignVertical="top"
        />
      </ScrollView>
    </View>
  );
}

/** Reproduce las partes grabadas una tras otra */
function Player({ segments }: { segments: Segment[] }) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [idx, setIdx] = useState(-1);

  useEffect(() => {
    if (status.didJustFinish && idx >= 0) {
      if (idx + 1 < segments.length) {
        setIdx(idx + 1);
        player.replace({ uri: segments[idx + 1].uri });
        player.play();
      } else setIdx(-1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.didJustFinish]);

  const playFrom = (i: number) => {
    setIdx(i);
    player.replace({ uri: segments[i].uri });
    player.play();
  };

  return (
    <View style={[st.row, { flex: 1, flexWrap: 'wrap', gap: 6 }]}>
      <Pressable
        style={st.playBtn}
        onPress={() => (status.playing ? player.pause() : idx >= 0 ? player.play() : playFrom(0))}
      >
        <Text style={st.playText}>{status.playing ? '⏸ Pausa' : '▶ Escuchar'}</Text>
      </Pressable>
      {idx >= 0 && (
        <Text style={st.small}>
          Parte {idx + 1}/{segments.length} · {mmss(status.currentTime)} / {mmss(status.duration || 0)}
        </Text>
      )}
      {segments.length > 1 && idx < 0 && <Text style={st.small}>{segments.length} partes</Text>}
    </View>
  );
}

const st = StyleSheet.create({
  box: { flex: 1, backgroundColor: '#FFF8EC', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#EAD9B8' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recBtn: { backgroundColor: C.accent, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 24 },
  recText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  time: { fontSize: 18, fontWeight: '800', color: C.ink, fontVariant: ['tabular-nums'] },
  playBtn: { borderWidth: 1.5, borderColor: C.accent, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  playText: { color: C.accent, fontWeight: '800' },
  small: { fontSize: 12, color: C.inkSoft },
  interim: { marginTop: 6, color: C.inkSoft, fontStyle: 'italic' },
  label: { marginTop: 10, fontSize: 12, fontWeight: '900', color: C.accent, textTransform: 'uppercase' },
  transcript: { fontSize: 15, lineHeight: 22, color: C.ink, minHeight: 80 },
});
