import React, { useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApp } from '../AppState';
import { useSetting } from '../db';

const GOLD = '#E2C27A';
const LEATHER = '#6B3A2A';

/** Tapa de cuero de la agenda, con el nombre de quien la usa. Se abre girando como una tapa real. */
export function Cover() {
  const { coverVisible, setCoverVisible } = useApp();
  const [owner, setOwner] = useSetting('ownerName', '');
  const [contact, setContact] = useSetting('ownerContact', '');
  const [name, setName] = useState(owner);
  const [cont, setCont] = useState(contact);
  const a = useRef(new Animated.Value(0)).current;
  const opening = useRef(false);

  if (!coverVisible) return null;
  const needsName = !owner;
  const year = new Date().getFullYear();

  const open = () => {
    if (opening.current) return;
    if (needsName) {
      if (!name.trim()) return;
      setOwner(name.trim());
      setContact(cont.trim());
    }
    opening.current = true;
    Animated.timing(a, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(() => {
      opening.current = false;
      a.setValue(0);
      setCoverVisible(false);
    });
  };

  const rotate = a.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-115deg'] });
  const opacity = a.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] });
  const backdrop = a.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, { opacity: backdrop }]}>
      <Animated.View
        style={[
          s.cover,
          { opacity, transformOrigin: 'left center', transform: [{ perspective: 2000 }, { rotateY: rotate }] },
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={needsName ? undefined : open}>
          <View style={s.stitch}>
            <View style={s.band} />
            <Text style={s.title}>AGENDA</Text>
            <Text style={s.year}>{year}</Text>
            <View style={s.line} />
            {needsName ? (
              <KeyboardAvoidingView behavior="padding" style={s.form}>
                <Text style={s.ask}>¿De quién es esta agenda?</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Tu nombre"
                  placeholderTextColor="#E2C27A88"
                  style={s.input}
                  autoFocus
                  onSubmitEditing={open}
                />
                <TextInput
                  value={cont}
                  onChangeText={setCont}
                  placeholder="Teléfono o email por si se pierde (opcional)"
                  placeholderTextColor="#E2C27A66"
                  style={[s.input, { fontSize: 16 }]}
                />
                <Pressable onPress={open} style={[s.btn, !name.trim() && { opacity: 0.4 }]}>
                  <Text style={s.btnText}>Abrir mi agenda</Text>
                </Pressable>
              </KeyboardAvoidingView>
            ) : (
              <>
                <Text style={s.name}>{owner}</Text>
                {contact ? <Text style={s.contact}>Si la encontrás, avisá a: {contact}</Text> : null}
                <Text style={s.hint}>Tocá la tapa para abrir</Text>
              </>
            )}
          </View>
          {/* elástico de cierre */}
          <View style={s.elastic} />
        </Pressable>
      </Animated.View>
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
  title: { color: GOLD, fontSize: 64, fontWeight: '900', letterSpacing: 18, marginLeft: 18 },
  year: { color: GOLD, fontSize: 30, fontWeight: '300', letterSpacing: 10, marginTop: 4 },
  line: { width: 200, height: 2, backgroundColor: GOLD, marginVertical: 22, opacity: 0.7 },
  name: { color: GOLD, fontSize: 38, fontStyle: 'italic', fontWeight: '600', textAlign: 'center' },
  contact: { color: '#E2C27ACC', fontSize: 15, marginTop: 10 },
  hint: { color: '#E2C27A88', fontSize: 14, marginTop: 40 },
  form: { width: 460, alignItems: 'stretch' },
  ask: { color: GOLD, fontSize: 22, textAlign: 'center', marginBottom: 10 },
  input: {
    borderBottomWidth: 2, borderBottomColor: GOLD, color: GOLD, fontSize: 26, textAlign: 'center',
    paddingVertical: 6, marginBottom: 14, fontStyle: 'italic',
  },
  btn: { backgroundColor: GOLD, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  btnText: { color: LEATHER, fontWeight: '900', fontSize: 18 },
  elastic: { position: 'absolute', top: 0, bottom: 0, right: 60, width: 16, backgroundColor: '#1E1E1E', opacity: 0.85 },
});
