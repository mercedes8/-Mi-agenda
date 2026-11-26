import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, Easing, Image, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { useApp } from '../AppState';
import { useSetting } from '../db';
import { playCover } from '../sounds';
import {
  bioAuth, bioAvailable, bioEnabled, bioLabel, checkPassword, clearPassword, deviceAuth, hasPassword, pickCoverPhoto,
} from '../security';

const GOLD = '#E2C27A';
const LEATHER = '#6B3A2A';

/** Foto pegada en la tapa, estilo polaroid */
function CoverPhoto({ uri, size = 1 }: { uri: string; size?: number }) {
  return (
    <View style={[s.polaroid, { width: 176 * size, transform: [{ rotate: '-3deg' }] }]}>
      <Image source={{ uri }} style={{ width: 160 * size, height: 200 * size, backgroundColor: '#ddd' }} resizeMode="cover" />
      <View style={s.tapeL} />
      <View style={s.tapeR} />
    </View>
  );
}

/**
 * Tapa de cuero de la agenda, con nombre y foto opcional.
 * Si hay bloqueo, se abre con contraseña y/o huella o rostro; si no, con un toque.
 */
export function Cover() {
  const { coverVisible, setCoverVisible } = useApp();
  const [owner, setOwner] = useSetting('ownerName', '');
  const [contact, setContact] = useSetting('ownerContact', '');
  const [photo] = useSetting('coverPhoto', '');
  const [name, setName] = useState(owner);
  const [cont, setCont] = useState(contact);
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [bioText, setBioText] = useState('huella o rostro');
  const [bioOk, setBioOk] = useState(false);
  const a = useRef(new Animated.Value(0)).current;
  const opening = useRef(false);
  const prompted = useRef(false);

  const needsName = !owner;
  const locked = !needsName && (hasPassword() || bioEnabled());
  const usePw = hasPassword();
  const useBio = bioEnabled() && bioOk;

  const open = useCallback(() => {
    if (opening.current) return;
    opening.current = true;
    playCover();
    setPw('');
    setError('');
    Animated.timing(a, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
      opening.current = false;
      prompted.current = false;
      a.setValue(0);
      setCoverVisible(false);
    });
  }, [a, setCoverVisible]);

  const tryBio = useCallback(async () => {
    if (await bioAuth()) open();
  }, [open]);

  // Al mostrarse la tapa bloqueada, pide la huella/rostro automáticamente
  useEffect(() => {
    if (!coverVisible || !locked) return;
    let alive = true;
    (async () => {
      const ok = await bioAvailable();
      if (!alive) return;
      setBioOk(ok);
      setBioText(await bioLabel());
      if (ok && bioEnabled() && !prompted.current) {
        prompted.current = true;
        setTimeout(tryBio, 400);
      }
    })();
    return () => {
      alive = false;
    };
  }, [coverVisible, locked, tryBio]);

  // Abrir la tapa arrastrándola con el dedo (si no está bloqueada)
  const coverW = useRef(1000);
  const pan = usePanGesture({
    runOnJS: true,
    enabled: !needsName && !locked,
    activeOffsetX: [-12, 12],
    onUpdate: (e) => {
      if (opening.current || !('translationX' in e)) return;
      a.setValue(Math.max(0, Math.min(1, -e.translationX / (coverW.current * 0.8))));
    },
    onDeactivate: (e) => {
      if (opening.current || !('translationX' in e)) return;
      const p = -e.translationX / (coverW.current * 0.8);
      if (p > 0.35 || e.velocityX < -600) open();
      else Animated.timing(a, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    },
  });

  if (!coverVisible) return null;
  const year = new Date().getFullYear();

  const submitName = () => {
    if (!name.trim()) return;
    setOwner(name.trim());
    setContact(cont.trim());
    open();
  };
  const submitPw = async () => {
    if (!pw) return;
    if (await checkPassword(pw)) open();
    else {
      setError('Contraseña incorrecta');
      setPw('');
    }
  };
  const forgot = () =>
    Alert.alert(
      '¿Olvidaste la contraseña?',
      'Podés entrar confirmando con el bloqueo de pantalla de la tablet (PIN, patrón, huella o rostro). Después vas a poder crear una contraseña nueva en Ajustes.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            if (await deviceAuth()) {
              clearPassword();
              open();
              setTimeout(() => Alert.alert('Contraseña borrada', 'Creá una nueva en Ajustes ⚙️ → Tapa y seguridad.'), 1200);
            } else {
              Alert.alert('No se pudo confirmar', 'Si la tablet no tiene bloqueo de pantalla, no es posible recuperar la contraseña.');
            }
          },
        },
      ],
    );

  const rotate = a.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-115deg'] });
  const opacity = a.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] });
  const backdrop = a.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, s.backdrop, { opacity: backdrop }]}
      onLayout={(e) => (coverW.current = e.nativeEvent.layout.width)}
    >
      <GestureDetector gesture={pan}>
      <Animated.View
        style={[s.cover, { opacity, transformOrigin: 'left center', transform: [{ perspective: 2000 }, { rotateY: rotate }] }]}
      >
        <Pressable style={{ flex: 1 }} onPress={needsName || locked ? undefined : open}>
          <KeyboardAvoidingView behavior="padding" style={s.stitch}>
            <View style={s.band} />
            <View style={s.content}>
              {photo ? <CoverPhoto uri={photo} size={needsName || locked ? 0.8 : 1} /> : null}
              <View style={s.textCol}>
                <Text style={s.title}>AGENDA</Text>
                <Text style={s.year}>{year}</Text>
                <View style={s.line} />
                {needsName ? (
                  <View style={s.form}>
                    <Text style={s.ask}>¿De quién es esta agenda?</Text>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder="Tu nombre"
                      placeholderTextColor="#E2C27A88"
                      style={s.input}
                      autoFocus
                      onSubmitEditing={submitName}
                    />
                    <TextInput
                      value={cont}
                      onChangeText={setCont}
                      placeholder="Teléfono o email por si se pierde (opcional)"
                      placeholderTextColor="#E2C27A66"
                      style={[s.input, { fontSize: 16 }]}
                    />
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                      <Pressable style={s.ghost} onPress={() => pickCoverPhoto('gallery')}>
                        <Text style={s.ghostText}>🖼️ Foto de la galería</Text>
                      </Pressable>
                      <Pressable style={s.ghost} onPress={() => pickCoverPhoto('camera')}>
                        <Text style={s.ghostText}>📷 Sacar foto</Text>
                      </Pressable>
                    </View>
                    <Pressable onPress={submitName} style={[s.btn, !name.trim() && { opacity: 0.4 }]}>
                      <Text style={s.btnText}>Abrir mi agenda</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <Text style={s.name}>{owner}</Text>
                    {contact ? <Text style={s.contact}>Si la encontrás, avisá a: {contact}</Text> : null}
                    {locked ? (
                      <View style={s.form}>
                        <Text style={s.lock}>🔒 Agenda privada</Text>
                        {useBio && (
                          <Pressable onPress={tryBio} style={s.btn}>
                            <Text style={s.btnText}>👆 Abrir con {bioText}</Text>
                          </Pressable>
                        )}
                        {usePw && (
                          <>
                            <TextInput
                              value={pw}
                              onChangeText={(t) => {
                                setPw(t);
                                setError('');
                              }}
                              placeholder="Contraseña"
                              placeholderTextColor="#E2C27A88"
                              secureTextEntry
                              style={[s.input, { marginTop: useBio ? 14 : 0 }]}
                              onSubmitEditing={submitPw}
                              autoFocus={!useBio}
                            />
                            {error ? <Text style={s.error}>{error}</Text> : null}
                            <Pressable onPress={submitPw} style={[s.btn, !pw && { opacity: 0.4 }, useBio && s.btnAlt]}>
                              <Text style={[s.btnText, useBio && { color: GOLD }]}>Abrir con contraseña</Text>
                            </Pressable>
                            <Pressable onPress={forgot} hitSlop={8}>
                              <Text style={s.forgot}>¿Olvidaste la contraseña?</Text>
                            </Pressable>
                          </>
                        )}
                        {!usePw && !useBio && (
                          <Pressable onPress={tryBio} style={s.btn}>
                            <Text style={s.btnText}>🔓 Desbloquear</Text>
                          </Pressable>
                        )}
                      </View>
                    ) : (
                      <Text style={s.hint}>Tocá la tapa o deslizala hacia la izquierda para abrir</Text>
                    )}
                  </>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
          <View style={s.elastic} />
        </Pressable>
      </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  backdrop: { backgroundColor: '#2E241C', zIndex: 100, elevation: 100, padding: 18 },
  cover: {
    flex: 1, backgroundColor: LEATHER, borderRadius: 14, borderTopLeftRadius: 4, borderBottomLeftRadius: 4,
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 14, elevation: 12, borderLeftWidth: 16, borderLeftColor: '#4E2A1E',
  },
  stitch: {
    flex: 1, margin: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: '#C9A86488', borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  band: { position: 'absolute', top: 0, bottom: 0, left: 40, width: 3, backgroundColor: '#00000025' },
  content: { flexDirection: 'row', alignItems: 'center', gap: 56 },
  textCol: { alignItems: 'center' },
  title: { color: GOLD, fontSize: 64, fontWeight: '900', letterSpacing: 18, marginLeft: 18 },
  year: { color: GOLD, fontSize: 30, fontWeight: '300', letterSpacing: 10, marginTop: 4 },
  line: { width: 200, height: 2, backgroundColor: GOLD, marginVertical: 22, opacity: 0.7 },
  name: { color: GOLD, fontSize: 38, fontStyle: 'italic', fontWeight: '600', textAlign: 'center' },
  contact: { color: '#E2C27ACC', fontSize: 15, marginTop: 10 },
  hint: { color: '#E2C27A88', fontSize: 14, marginTop: 40 },
  form: { width: 420, alignItems: 'stretch', marginTop: 18 },
  ask: { color: GOLD, fontSize: 22, textAlign: 'center', marginBottom: 10 },
  lock: { color: GOLD, fontSize: 16, textAlign: 'center', marginBottom: 12, letterSpacing: 2 },
  input: {
    borderBottomWidth: 2, borderBottomColor: GOLD, color: GOLD, fontSize: 24, textAlign: 'center',
    paddingVertical: 6, marginBottom: 12, fontStyle: 'italic',
  },
  error: { color: '#FF9C8A', textAlign: 'center', marginBottom: 6, fontWeight: '700' },
  btn: { backgroundColor: GOLD, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  btnAlt: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: GOLD },
  btnText: { color: LEATHER, fontWeight: '900', fontSize: 17 },
  forgot: { color: '#E2C27A99', textAlign: 'center', marginTop: 12, textDecorationLine: 'underline' },
  ghost: { flex: 1, borderWidth: 1, borderColor: '#E2C27A88', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  ghostText: { color: GOLD, fontSize: 13 },
  elastic: { position: 'absolute', top: 0, bottom: 0, right: 60, width: 16, backgroundColor: '#1E1E1E', opacity: 0.85 },
  polaroid: {
    backgroundColor: '#FAFAF5', padding: 8, paddingBottom: 30, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 8, elevation: 8,
  },
  tapeL: { position: 'absolute', top: -10, left: -14, width: 60, height: 20, backgroundColor: '#FFFFFF99', transform: [{ rotate: '-35deg' }] },
  tapeR: { position: 'absolute', top: -10, right: -14, width: 60, height: 20, backgroundColor: '#FFFFFF99', transform: [{ rotate: '35deg' }] },
});
