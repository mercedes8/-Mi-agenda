import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { all, bump, db, getSetting, run } from './db';
import { parseYmd } from './dates';

export const CHANNEL_ID = 'recordatorios-campanita';
export const SOUND = 'campanita.wav';
const CATEGORY = 'recordatorio';

export type Repeat = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';
export const REPEAT_LABEL: Record<Repeat, string> = {
  none: 'Una vez',
  daily: 'Todos los días',
  weekdays: 'Lunes a viernes',
  weekly: 'Cada semana',
  monthly: 'Cada mes',
  yearly: 'Cada año',
};
export const ADVANCE_OPTIONS: [number, string][] = [
  [0, 'En el momento'], [5, '5 min antes'], [15, '15 min antes'], [30, '30 min antes'],
  [60, '1 hora antes'], [1440, '1 día antes'],
];

export type Reminder = {
  id: number; title: string; notes: string; date: string; time: string; repeat: Repeat;
  advance: number; color: string; done: number; notif_ids: string;
};
export type Contact = {
  id: number; name: string; phone: string; email: string; address: string;
  bday_day: number | null; bday_month: number | null; bday_year: number | null; notes: string; notif_id: string | null;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Recordatorios de la agenda',
      importance: Notifications.AndroidImportance.MAX,
      sound: SOUND,
      vibrationPattern: [0, 400, 250, 400],
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
    });
  }
  await Notifications.setNotificationCategoryAsync(CATEGORY, [
    { identifier: 'snooze', buttonTitle: 'Posponer 10 min', options: { opensAppToForeground: true } },
    { identifier: 'done', buttonTitle: 'Hecho ✔', options: { opensAppToForeground: true } },
  ]);
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) await Notifications.requestPermissionsAsync();
}

export async function exactAlarmStatus() {
  if (Platform.OS !== 'android') return true;
  try {
    return (await Notifications.getExactAlarmPermissionsAsync()).granted;
  } catch {
    return true;
  }
}
export async function requestExactAlarm() {
  if (Platform.OS !== 'android') return true;
  try {
    return (await Notifications.requestExactAlarmPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

const delivery = (): Notifications.NotificationDelivery =>
  getSetting('exactAlarms', '1') === '1' ? 'alarmClock' : 'bestEffort';

function content(title: string, body: string, data: Record<string, unknown>): Notifications.NotificationContentInput {
  return {
    title,
    body,
    sound: SOUND,
    data,
    categoryIdentifier: CATEGORY,
    priority: Notifications.AndroidNotificationPriority.MAX,
    vibrate: [0, 400, 250, 400],
  };
}

export function reminderFireDate(r: Pick<Reminder, 'date' | 'time' | 'advance'>): Date {
  const d = parseYmd(r.date);
  const [h, m] = r.time.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return new Date(d.getTime() - (r.advance || 0) * 60000);
}

async function cancelIds(json: string | null) {
  try {
    const ids: string[] = JSON.parse(json || '[]');
    await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
  } catch {}
}

export async function scheduleReminder(r: Reminder): Promise<string[]> {
  await cancelIds(r.notif_ids);
  const ids: string[] = [];
  if (!r.done) {
    const fire = reminderFireDate(r);
    const body = (r.notes ? r.notes + ' · ' : '') + `${r.time} hs`;
    const c = content(`🔔 ${r.title}`, body, { reminderId: r.id });
    const H = fire.getHours(), M = fire.getMinutes();
    const del = delivery();
    const T = Notifications.SchedulableTriggerInputTypes;
    const triggers: Notifications.SchedulableNotificationTriggerInput[] = [];
    switch (r.repeat) {
      case 'none':
        if (fire.getTime() > Date.now()) triggers.push({ type: T.DATE, date: fire, channelId: CHANNEL_ID, delivery: del });
        break;
      case 'daily':
        triggers.push({ type: T.DAILY, hour: H, minute: M, channelId: CHANNEL_ID, delivery: del });
        break;
      case 'weekdays':
        for (const wd of [2, 3, 4, 5, 6])
          triggers.push({ type: T.WEEKLY, weekday: wd, hour: H, minute: M, channelId: CHANNEL_ID, delivery: del });
        break;
      case 'weekly':
        triggers.push({ type: T.WEEKLY, weekday: fire.getDay() + 1, hour: H, minute: M, channelId: CHANNEL_ID, delivery: del });
        break;
      case 'monthly':
        triggers.push({ type: T.MONTHLY, day: fire.getDate(), hour: H, minute: M, channelId: CHANNEL_ID, delivery: del });
        break;
      case 'yearly':
        triggers.push({
          type: T.YEARLY, day: fire.getDate(), month: fire.getMonth(), hour: H, minute: M, channelId: CHANNEL_ID, delivery: del,
        });
        break;
    }
    for (const trigger of triggers) {
      try {
        ids.push(await Notifications.scheduleNotificationAsync({ content: c, trigger }));
      } catch (e) {
        console.warn('No se pudo programar', e);
      }
    }
  }
  db.runSync('UPDATE reminders SET notif_ids = ? WHERE id = ?', [JSON.stringify(ids), r.id]);
  return ids;
}

export async function cancelReminder(r: Pick<Reminder, 'notif_ids'>) {
  await cancelIds(r.notif_ids);
}

export async function scheduleBirthday(c: Contact) {
  if (c.notif_id) await Notifications.cancelScheduledNotificationAsync(c.notif_id).catch(() => {});
  let id: string | null = null;
  if (c.bday_day && c.bday_month) {
    try {
      id = await Notifications.scheduleNotificationAsync({
        content: content(`🎂 Hoy es el cumpleaños de ${c.name}`, '¡No te olvides de saludar!', { contactId: c.id }),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.YEARLY,
          day: c.bday_day, month: c.bday_month - 1, hour: 9, minute: 0, channelId: CHANNEL_ID, delivery: delivery(),
        },
      });
    } catch (e) {
      console.warn(e);
    }
  }
  db.runSync('UPDATE contacts SET notif_id = ? WHERE id = ?', [id, c.id]);
}

/** Reprograma todo (después de importar un backup o cambiar ajustes). */
export async function rescheduleAll() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const r of all<Reminder>('SELECT * FROM reminders')) await scheduleReminder({ ...r, notif_ids: '[]' });
  for (const c of all<Contact>('SELECT * FROM contacts')) await scheduleBirthday({ ...c, notif_id: null });
  bump();
}

export async function testNotification() {
  await Notifications.scheduleNotificationAsync({
    content: content('🔔 Prueba de recordatorio', 'Así va a sonar tu agenda', {}),
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: CHANNEL_ID },
  });
}

/** Acciones de los botones de la notificación */
export function listenResponses(onOpen: (data: Record<string, unknown>) => void) {
  const sub = Notifications.addNotificationResponseReceivedListener(async (resp) => {
    const n = resp.notification.request.content;
    const data = (n.data ?? {}) as Record<string, unknown>;
    if (resp.actionIdentifier === 'snooze') {
      await Notifications.scheduleNotificationAsync({
        content: content(n.title ?? '🔔 Recordatorio', n.body ?? '', data),
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 600, channelId: CHANNEL_ID },
      });
    } else if (resp.actionIdentifier === 'done' && typeof data.reminderId === 'number') {
      run("UPDATE reminders SET done = 1 WHERE id = ? AND repeat = 'none'", [data.reminderId]);
    } else {
      onOpen(data);
    }
    await Notifications.dismissNotificationAsync(resp.notification.request.identifier).catch(() => {});
  });
  return () => sub.remove();
}
