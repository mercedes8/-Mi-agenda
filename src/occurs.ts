import { all, useQuery } from './db';
import { parseYmd, ymd } from './dates';
import type { Contact, Reminder } from './notifications';

/** ¿El recordatorio aparece en este día? (considera repeticiones) */
export function occursOn(r: Reminder, d: Date): boolean {
  const key = ymd(d);
  if (key < r.date) return false;
  const start = parseYmd(r.date);
  switch (r.repeat) {
    case 'none':
      return key === r.date;
    case 'daily':
      return true;
    case 'weekdays':
      return d.getDay() >= 1 && d.getDay() <= 5;
    case 'weekly':
      return d.getDay() === start.getDay();
    case 'monthly':
      return d.getDate() === start.getDate();
    case 'yearly':
      return d.getDate() === start.getDate() && d.getMonth() === start.getMonth();
  }
  return false;
}

export function useReminders() {
  return useQuery<Reminder>('SELECT * FROM reminders ORDER BY time');
}
export function useContacts() {
  return useQuery<Contact>('SELECT * FROM contacts ORDER BY name COLLATE NOCASE');
}
export function remindersOn(list: Reminder[], d: Date) {
  return list.filter((r) => occursOn(r, d)).sort((a, b) => a.time.localeCompare(b.time));
}
export function birthdaysOn(list: Contact[], d: Date) {
  return list.filter((c) => c.bday_day === d.getDate() && c.bday_month === d.getMonth() + 1);
}
export function allReminders() {
  return all<Reminder>('SELECT * FROM reminders');
}
