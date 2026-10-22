"use client";
import { useEffect, useState } from "react";
import { installPrompt } from "@/components/PwaSetup";
import { checkReminders, getReminders, notificationsSupported, reminderCalendar, setReminders, type ReminderSettings } from "@/lib/reminders";
import { download } from "@/lib/csv";

const isStandalone = () => typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true);
const isIOS = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

/** Install NutriX on the home screen + meal / 2-hour reading reminders. */
export default function AppSetupCard({ always = false }: { always?: boolean }) {
  const [ready, setReady] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [r, setR] = useState<ReminderSettings | null>(null);
  const [perm, setPerm] = useState<string>("default");
  const [hidden, setHidden] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setStandalone(isStandalone());
    setCanPrompt(!!installPrompt.get());
    setR(getReminders());
    setPerm(notificationsSupported() ? Notification.permission : "unsupported");
    try { setHidden(!always && localStorage.getItem("nxg_setup_hidden") === "1"); } catch {}
    setReady(true);
    return installPrompt.subscribe(() => { setCanPrompt(!!installPrompt.get()); setStandalone(isStandalone()); });
  }, [always]);

  if (!ready || !r) return null;
  const allSet = standalone && r.enabled;
  if (!always && (hidden || allSet)) return null;

  const save = (patch: Partial<ReminderSettings>) => { const n = { ...r, ...patch }; setR(n); setReminders(n); };

  async function turnOn() {
    setMsg(null);
    if (notificationsSupported()) {
      const p = await Notification.requestPermission();
      setPerm(p);
      if (p !== "granted") setMsg("Notifications are blocked, so use “Add to my calendar” for reminders that always work.");
    }
    save({ enabled: true });
    checkReminders().catch(() => {});
  }

  return (
    <section className="card stack">
      <div className="card-head" style={{ marginBottom: 0 }}>
        <h2 style={{ margin: 0 }}>Make logging a habit</h2>
        {!always && <button className="linkbtn tiny" onClick={() => { setHidden(true); try { localStorage.setItem("nxg_setup_hidden", "1"); } catch {} }}>Not now</button>}
      </div>

      {!standalone && (
        <div className="install">
          <img src="/icons/icon-192.png" alt="" width={44} height={44} style={{ borderRadius: 12 }} />
          <div className="grow">
            <b style={{ fontSize: ".95rem" }}>Add NutriX to your home screen</b>
            <div className="tiny muted">
              {canPrompt ? "Opens like an app, works offline for logging and readings."
                : isIOS() ? "In Safari tap Share ⬆ → “Add to Home Screen”."
                : "In your browser menu choose “Install app” or “Add to Home screen”."}
            </div>
          </div>
          {canPrompt && <button className="btn small" onClick={() => installPrompt.prompt()}>Install</button>}
        </div>
      )}
      {standalone && <div className="tiny muted">✓ Installed on this phone. Logging and readings work offline.</div>}

      <div>
        <b style={{ fontSize: ".95rem" }}>Meal reminders</b>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          {(["breakfast", "lunch", "dinner"] as const).map((k) => (
            <label key={k} className="tiny" style={{ display: "grid", gap: 2 }}>
              {k[0].toUpperCase() + k.slice(1)}
              <input type="time" value={r[k]} onChange={(e) => save({ [k]: e.target.value } as Partial<ReminderSettings>)} style={{ padding: "6px 8px" }} />
            </label>
          ))}
        </div>
        <label className="tiny" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, color: "var(--ink)" }}>
          <input type="checkbox" checked={r.reading2h} onChange={(e) => save({ reading2h: e.target.checked })} /> Also remind me to take a 2-hour reading
        </label>
        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {r.enabled ? (
            <button className="btn ghost small" onClick={() => save({ enabled: false })}>Turn off notifications</button>
          ) : (
            <button className="btn small" onClick={turnOn}>Turn on reminders</button>
          )}
          <button className="btn ghost small" onClick={() => download("nutrix-reminders.ics", reminderCalendar(r, location.origin), "text/calendar")}>📅 Add to my calendar</button>
        </div>
        <p className="tiny muted" style={{ margin: "6px 0 0" }}>
          {r.enabled && perm === "granted" ? "On: you’ll get a nudge if a meal isn’t logged by its time (when NutriX is open or running in the background). " : ""}
          The calendar option repeats daily and works even when the app is closed.
        </p>
        {msg && <p className="tiny" style={{ color: "var(--accent)" }}>{msg}</p>}
      </div>
    </section>
  );
}
