import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';

export type MenuItem = { label: string; onPress: () => void; danger?: boolean; icon?: string };

/** Menú contextual simple (Alert de Android admite solo 3 botones) */
export function Menu({ title, items, onClose }: { title?: string; items: MenuItem[] | null; onClose: () => void }) {
  if (!items) return null;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <View style={s.box}>
          {title ? <Text style={s.title}>{title}</Text> : null}
          <ScrollView style={{ maxHeight: 420 }}>
            {items.map((it, i) => (
              <Pressable
                key={i}
                style={({ pressed }) => [s.item, pressed && { backgroundColor: C.accentSoft }]}
                onPress={() => {
                  onClose();
                  it.onPress();
                }}
              >
                <Text style={[s.itemText, it.danger && { color: C.danger }]}>
                  {it.icon ? `${it.icon}  ` : ''}
                  {it.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0006', alignItems: 'center', justifyContent: 'center' },
  box: { width: 360, backgroundColor: C.paper, borderRadius: 12, paddingVertical: 8, elevation: 10 },
  title: { fontWeight: '800', color: C.accent, paddingHorizontal: 18, paddingVertical: 8, fontSize: 15 },
  item: { paddingHorizontal: 18, paddingVertical: 13 },
  itemText: { fontSize: 16, color: C.ink },
});
