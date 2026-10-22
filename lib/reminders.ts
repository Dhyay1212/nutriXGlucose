"use client";
// Meal and 2-hour-reading reminders.
// Two delivery routes, because web apps can't wake themselves on a schedule without a push server:
//  1. Notifications while NutriX is open or in the background on the phone (checked every few minutes).
//  2. A calendar file with daily repeating alarms, which works on every phone even when the app is closed.
import { getCurrentUserId, listMeals, listReadings } from "./store";
import { riseForMeal } from "./glucose";

export interface ReminderSettings { enabled: boolean; breakfast: string; lunch: string; dinner: string; reading2h: boolean }
export const DEFAULT_REMINDERS: ReminderSettings = { enabled: false, breakfast: "08:30", lunch: "13:30", dinner: "20:30", reading2h: true };
const KEY = "nxg_reminders";
const SENT = "nxg_reminders_sent";
const MEALS = ["breakfast", "lunch", "dinner"] as const;

export function getReminders(): ReminderSettings {
  try { return { ...DEFAULT_REMINDERS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return DEFAULT_REMINDERS; }
}
export function setReminders(s: ReminderSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}
export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;

const at = (hhmm: string, base = new Date()) => { const [h, m] = hhmm.split(":").map(Number); const d = new Date(base); d.setHours(h, m, 0, 0); return d; };

async function notify(title: string, body: string, url: string, tag: string) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.getRegistration();
  const opts: NotificationOptions & { data?: any } = { body, tag, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url } };
  if (reg) await reg.showNotification(title, opts);
  else new Notification(title, opts);
}

/** Send any reminder that is due and hasn't been sent yet. Safe to call often. */
export async function checkReminders(now = new Date()) {
  const s = getReminders();
  if (!s.enabled) return;
  const uid = getCurrentUserId();
  if (!uid) return;
  let sent: Record<string, number> = {};
  try { sent = JSON.parse(localStorage.getItem(SENT) || "{}"); } catch {}
  const day = now.toISOString().slice(0, 10);
  for (const k of Object.keys(sent)) if (!k.startsWith(day)) delete sent[k];

  const [meals, readings] = await Promise.all([listMeals(uid), listReadings(uid)]);
  for (const slot of MEALS) {
    const t = at(s[slot], now);
    const key = `${day}:${slot}`;
    const late = now.getTime() - t.getTime();
    if (late < 0 || late > 3 * 3600_000 || sent[key]) continue;
    const logged = meals.some((m) => Math.abs(new Date(m.eatenAt).getTime() - t.getTime()) < 2.5 * 3600_000);
    if (logged) { sent[key] = 1; continue; }
    await notify(`Log your ${slot}?`, "Snap it, or just say “2 roti, dal, sabzi”. Takes 10 seconds.", "/log", key);
    sent[key] = 1;
  }
  if (s.reading2h) {
    for (const m of meals) {
      const mins = (now.getTime() - new Date(m.eatenAt).getTime()) / 60000;
      const key = `${day}:reading:${m.id}`;
      if (mins < 110 || mins > 170 || sent[key]) continue;
      if (riseForMeal(m, readings).peak != null) continue;
      await notify("2-hour reading due", `${m.items.map((i) => i.name).slice(0, 3).join(", ")}: add a reading to see this meal’s real effect.`, "/glucose", key);
      sent[key] = 1;
    }
  }
  try { localStorage.setItem(SENT, JSON.stringify(sent)); } catch {}
}

/** Calendar file (.ics) with daily alarms: works even when the app is closed. */
export function reminderCalendar(s: ReminderSettings, origin: string) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const today = new Date();
  const ymd = `${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const ev = (id: string, hhmm: string, title: string, desc: string, url: string) => {
    const [h, m] = hhmm.split(":");
    return [
      "BEGIN:VEVENT", `UID:nutrix-${id}@nutrixglucose`, `DTSTAMP:${stamp}`, `DTSTART:${ymd}T${h}${m}00`, "DURATION:PT5M", "RRULE:FREQ=DAILY",
      `SUMMARY:${title}`, `DESCRIPTION:${desc} ${url}`, `URL:${url}`,
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${title}`, "TRIGGER:PT0M", "END:VALARM", "END:VEVENT",
    ].join("\r\n");
  };
  const plus2h = (hhmm: string) => { const d = at(hhmm); d.setMinutes(d.getMinutes() + 120); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const events: string[] = [];
  for (const slot of MEALS) {
    events.push(ev(slot, s[slot], `NutriX: log your ${slot}`, "Snap it or say it in NutriX Glucose.", `${origin}/log`));
    if (s.reading2h) events.push(ev(`${slot}-2h`, plus2h(s[slot]), "NutriX: 2-hour glucose reading", "Add a reading about 2 hours after eating.", `${origin}/glucose`));
  }
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//NutriX Glucose//Reminders//EN", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR"].join("\r\n");
}
