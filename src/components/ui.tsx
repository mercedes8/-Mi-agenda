import React from 'react';
import {
  Pressable, StyleSheet, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle,
} from 'react-native';
import { C } from '../theme';

export function Btn({
  label, onPress, color = C.accent, small, outline, style, disabled,
}: {
  label: string; onPress: () => void; color?: string; small?: boolean; outline?: boolean; style?: ViewStyle; disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.btn,
        small && s.btnSmall,
        outline ? { borderColor: color, borderWidth: 1.5, backgroundColor: 'transparent' } : { backgroundColor: color },
        (pressed || disabled) && { opacity: 0.6 },
        style,
      ]}
    >
      <Text style={[s.btnText, small && { fontSize: 13 }, outline && { color }]}>{label}</Text>
    </Pressable>
  );
}

export function IconBtn({
  icon, onPress, active, size = 40, title, style,
}: { icon: string; onPress: () => void; active?: boolean; size?: number; title?: string; style?: ViewStyle }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={title}
      style={({ pressed }) => [
        s.icon,
        { width: size, height: size, borderRadius: size / 4 },
        active && s.iconActive,
        pressed && { opacity: 0.6 },
        style,
      ]}
    >
      <Text style={{ fontSize: size * 0.5 }}>{icon}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress, color = C.accent }: { label: string; active?: boolean; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && { backgroundColor: color, borderColor: color }]}>
      <Text style={[s.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function Check({ checked, onPress, size = 22, color = C.accent }: { checked: boolean; onPress: () => void; size?: number; color?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={[s.check, { width: size, height: size, borderColor: color }, checked && { backgroundColor: color }]}>
      {checked && <Text style={{ color: '#fff', fontSize: size * 0.7, lineHeight: size * 0.9 }}>✓</Text>}
    </Pressable>
  );
}

/** Título de sección con estilo de agenda */
export function Title({ children, style, color = C.accent }: { children: React.ReactNode; style?: TextStyle; color?: string }) {
  return <Text style={[s.title, { color }, style]}>{children}</Text>;
}

/** Input "renglón": sin borde, con línea debajo como papel rayado */
export function LineInput(props: TextInputProps & { lineColor?: string }) {
  const { style, lineColor = C.line, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor="#B8AFA2"
      {...rest}
      style={[s.lineInput, { borderBottomColor: lineColor }, style]}
    />
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor="#B8AFA2" {...props} style={[s.field, props.style]} />
    </View>
  );
}

/** Hoja de papel con sombra */
export function Sheet({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.sheet, style]}>{children}</View>;
}

export function Empty({ text }: { text: string }) {
  return <Text style={s.empty}>{text}</Text>;
}

export const s = StyleSheet.create({
  btn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  icon: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  iconActive: { backgroundColor: C.accentSoft, borderWidth: 1.5, borderColor: C.accent },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#CDBFA9',
    marginRight: 6, marginBottom: 6, backgroundColor: '#fff',
  },
  chipText: { color: C.ink, fontSize: 13 },
  check: { borderWidth: 2, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  lineInput: { borderBottomWidth: 1, fontSize: 16, color: C.ink, paddingVertical: 2, paddingHorizontal: 4, minHeight: 30 },
  label: { fontSize: 12, color: C.inkSoft, marginBottom: 3, fontWeight: '600' },
  field: {
    borderWidth: 1, borderColor: '#DDD2BF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 16, color: C.ink, backgroundColor: '#fff',
  },
  sheet: {
    backgroundColor: C.paper, borderRadius: 6, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  empty: { color: C.inkSoft, fontStyle: 'italic', padding: 12, textAlign: 'center' },
});
