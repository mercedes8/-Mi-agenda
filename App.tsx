import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppProvider, Section, useApp } from './src/AppState';
import { Cover } from './src/components/Cover';
import { QuickNoteModal } from './src/components/QuickNote';
import { ReminderModal } from './src/components/ReminderModal';
import { first } from './src/db';
import { parseYmd } from './src/dates';
import * as Notifications from 'expo-notifications';
import { AgendaAlarm } from './modules/agenda-alarm';
import { BIRTHDAY_BASE, dailyRefresh, listenResponses, Reminder, setupNotifications } from './src/notifications';
import { ContactsScreen } from './src/screens/ContactsScreen';
import { DayScreen } from './src/screens/DayScreen';
import { ExpensesScreen } from './src/screens/ExpensesScreen';
import { GoalsScreen } from './src/screens/GoalsScreen';
import { HabitsScreen } from './src/screens/HabitsScreen';
import { ListsScreen } from './src/screens/ListsScreen';
import { MonthScreen } from './src/screens/MonthScreen';
import { NotebooksScreen } from './src/screens/NotebooksScreen';
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
  ['cuadernos', '📚', 'Cuadernos'],
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
    case 'cuadernos': return <NotebooksScreen />;
    case 'gastos': return <ExpensesScreen />;
    case 'ajustes': return <SettingsScreen />;
  }
}

function Shell() {
  const { section, setSection, goToDay, openReminder, setCoverVisible } = useApp();
  const [quick, setQuick] = useState(false);

  useEffect(() => {
    /** Abre directamente el recordatorio que sonó */
    const openFromAlarm = (rid: number) => {
      try {
        AgendaAlarm?.stopRinging();
      } catch {}
      setCoverVisible(false);
      if (rid >= 0) {
        const r = first<Reminder>('SELECT * FROM reminders WHERE id=?', [rid]);
        if (r) {
          goToDay(r.repeat === 'none' ? parseYmd(r.date) : new Date());
          openReminder({ ...r, ringing: true });
        } else setSection('recordatorios');
      } else if (rid <= BIRTHDAY_BASE) {
        setSection('contactos');
      }
    };

    setupNotifications()
      .then(() => dailyRefresh())
      .catch(console.warn);

    // ¿La app se abrió tocando una alarma?
    const launch = AgendaAlarm?.getLaunchReminder() ?? -1;
    if (launch !== -1) openFromAlarm(launch);
    const sub = AgendaAlarm?.addListener('onOpenReminder', (e) => openFromAlarm(e.reminderId));

    // Respaldo: avisos programados con expo-notifications
    Notifications.getLastNotificationResponseAsync()
      .then((resp) => {
        const id = resp?.notification.request.content.data?.reminderId;
        if (typeof id === 'number') openFromAlarm(id);
      })
      .catch(() => {});
    const off = listenResponses((data) => {
      if (typeof data.reminderId === 'number') openFromAlarm(data.reminderId);
      else if (typeof data.contactId === 'number') setSection('contactos');
    });
    return () => {
      off();
      sub?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom', 'left', 'right']}>
      <View style={s.content}>
        <Screen />
      </View>
      {/* Pestañas índice al costado, como una agenda de papel */}
      <View style={s.tabs}>
        <Pressable onPress={() => setQuick(true)} style={s.quick} accessibilityLabel="Nota rápida">
          <Text style={{ fontSize: 20 }}>⚡</Text>
          <Text style={s.quickText}>Rápida</Text>
        </Pressable>
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
      <QuickNoteModal visible={quick} onClose={() => setQuick(false)} />
      <Cover />
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
  tabIcon: { fontSize: 18 },
  quick: {
    height: 54, marginLeft: 6, marginBottom: 4, borderRadius: 12, backgroundColor: '#FFF59D', alignItems: 'center',
    justifyContent: 'center', elevation: 4, transform: [{ rotate: '-3deg' }],
  },
  quickText: { fontSize: 11, fontWeight: '900', color: '#6D5A00' },
  tabText: { fontSize: 11, color: '#2b2b2b', fontWeight: '700' },
});
