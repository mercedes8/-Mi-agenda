import React, { createContext, useContext, useMemo, useState } from 'react';
import { getSetting } from './db';
import type { Reminder } from './notifications';

export type Section =
  | 'dia' | 'semana' | 'mes' | 'anio' | 'recordatorios' | 'contactos'
  | 'listas' | 'habitos' | 'metas' | 'cuadernos' | 'gastos' | 'ajustes';

export type ReminderDraft = Partial<Reminder> & { date: string; ringing?: boolean };

type Ctx = {
  section: Section;
  setSection: (s: Section) => void;
  date: Date;
  setDate: (d: Date) => void;
  goToDay: (d: Date) => void;
  reminderDraft: ReminderDraft | null;
  openReminder: (d: ReminderDraft) => void;
  closeReminder: () => void;
  coverVisible: boolean;
  setCoverVisible: (v: boolean) => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [section, setSection] = useState<Section>('dia');
  const [date, setDate] = useState(() => new Date());
  const [reminderDraft, setDraft] = useState<ReminderDraft | null>(null);
  const [coverVisible, setCoverVisible] = useState(() => getSetting('showCover', '1') === '1' || !getSetting('ownerName', ''));
  const value = useMemo<Ctx>(
    () => ({
      section,
      setSection,
      date,
      setDate,
      goToDay: (d) => {
        setDate(d);
        setSection('dia');
      },
      reminderDraft,
      openReminder: setDraft,
      closeReminder: () => setDraft(null),
      coverVisible,
      setCoverVisible,
    }),
    [section, date, reminderDraft, coverVisible],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp fuera de AppProvider');
  return c;
}
