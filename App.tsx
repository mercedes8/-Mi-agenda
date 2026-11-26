import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppProvider, Section, useApp } from './src/AppState';
import { ReminderModal } from './src/components/ReminderModal';
import { first } from './src/db';
import { parseYmd } from './src/dates';
import { listenResponses, setupNotifications } from './src/notifications';
import { ContactsScreen } from './src/screens/ContactsScreen';
import { DayScreen } from './src/screens/DayScreen';
import { ExpensesScreen } from './src/screens/ExpensesScreen';
import { GoalsScreen } from './src/screens/GoalsScreen';
import { HabitsScreen } from './src/screens/HabitsScreen';
import { ListsScreen } from './src/screens/ListsScreen';
import { MonthScreen } from './src/screens/MonthScreen';
import { NotesScreen } from './src/screens/NotesScreen';
import { RemindersScreen } from './src/screens/RemindersScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { WeekScreen } from './src/screens/WeekScreen';
import { YearScreen } from './src/screens/YearScreen';
import { C, TAB_COLORS } from './src/theme';

const TABS: [Section, string, string][] = [
  ['dia', '📖', 'Día'],
  ['semana', '🗓️', 'Semana'],
  ['mes', '📅', 'Mes'],
  ['anio', '🗂️', 'Año'],
  ['recordatorios', '🔔', 'Avisos'],
  ['contactos', '📇', 'Contactos'],
  ['listas', '☑️', 'Listas'],
  ['habitos', '🔥', 'Hábitos'],
  ['metas', '🎯', 'Metas'],
  ['notas', '📝', 'Notas'],
  ['gastos', '💰', 'Gastos'],
  ['ajustes', '⚙️', 'Ajustes'],
];

function Screen() {
  const { section } = useApp();
  switch (section) {
    case 'dia': return <DayScreen />;
    case 'semana': return <WeekScreen />;
    case 'mes': return <MonthScreen />;
    case 'anio': return <YearScreen />;
    case 'recordatorios': return <RemindersScreen />;
    case 'contactos': return <ContactsScreen />;
    case 'listas': return <ListsScreen />;
    case 'habitos': return <HabitsScreen />;
    case 'metas': return <GoalsScreen />;
    case 'notas': return <NotesScreen />;
    case 'gastos': return <ExpensesScreen />;
    case 'ajustes': return <SettingsScreen />;
  }
}

function Shell() {
  const { section, setSection, goToDay } = useApp();

  useEffect(() => {
    setupNotifications().catch(console.warn);
    return listenResponses((data) => {
      if (typeof data.reminderId === 'number') {
        const r = first<{ date: string; repeat: string }>('SELECT date, repeat FROM reminders WHERE id=?', [data.reminderId]);
        if (r) goToDay(r.repeat === 'none' ? parseYmd(r.date) : new Date());
        else setSection('recordatorios');
      } else if (typeof data.contactId === 'number') {
        setSection('contactos');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom', 'left', 'right']}>
      <View style={s.content}>
        <Screen />
      </View>
      {/* Pestañas índice al costado, como una agenda de papel */}
      <View style={s.tabs}>
        {TABS.map(([id, icon, label], i) => {
          const active = id === section;
          return (
            <Pressable
              key={id}
              onPress={() => setSection(id)}
              style={[s.tab, { backgroundColor: TAB_COLORS[i] }, active && s.tabActive]}
            >
              <Text style={s.tabIcon}>{icon}</Text>
              <Text style={[s.tabText, active && { fontWeight: '900' }]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <ReminderModal />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <StatusBar style="light" />
          <Shell />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: C.desk },
  content: { flex: 1 },
  tabs: { width: 92, paddingVertical: 6, justifyContent: 'space-evenly' },
  tab: {
    flex: 1, marginVertical: 2, marginLeft: 6, borderTopRightRadius: 12, borderBottomRightRadius: 12,
    alignItems: 'center', justifyContent: 'center', opacity: 0.85,
  },
  tabActive: { marginLeft: -4, opacity: 1, borderLeftWidth: 0, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4, elevation: 6 },
  tabIcon: { fontSize: 20 },
  tabText: { fontSize: 12, color: '#2b2b2b', fontWeight: '700' },
});
