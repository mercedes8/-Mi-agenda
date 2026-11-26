import { requireOptionalNativeModule, type EventSubscription } from 'expo';

type AgendaAlarmModule = {
  schedule(id: string, ts: number, title: string, body: string, reminderId: number): void;
  cancel(id: string): void;
  cancelAll(): void;
  scheduledIds(): string[];
  stopRinging(): void;
  canScheduleExact(): boolean;
  canUseFullScreen(): boolean;
  openExactAlarmSettings(): void;
  openFullScreenSettings(): void;
  getLaunchReminder(): number;
  addListener(event: 'onOpenReminder', cb: (e: { reminderId: number }) => void): EventSubscription;
};

/** Alarmas nativas tipo despertador. null si no está el módulo (Expo Go). */
export const AgendaAlarm = requireOptionalNativeModule<AgendaAlarmModule>('AgendaAlarm');
