"use client";
import { useEffect } from "react";
import { checkReminders } from "@/lib/reminders";

// Install prompt is captured once and shared with InstallCard.
let deferred: any = null;
const listeners = new Set<() => void>();
export const installPrompt = {
  get: () => deferred,
  subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  async prompt() {
    if (!deferred) return false;
    deferred.prompt();
    const r = await deferred.userChoice.catch(() => null);
    deferred = null;
    listeners.forEach((f) => f());
    return r?.outcome === "accepted";
  },
};

/** Registers the service worker (offline + notifications) and runs reminder checks while the app is open. */
export default function PwaSetup() {
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); deferred = e; listeners.forEach((f) => f()); };
    const onInstalled = () => { deferred = null; listeners.forEach((f) => f()); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("Service worker failed", e));
    }
    const tick = () => { checkReminders().catch(() => {}); };
    const t0 = setTimeout(tick, 4000);
    const iv = setInterval(tick, 5 * 60_000);
    const onVis = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      document.removeEventListener("visibilitychange", onVis);
      clearTimeout(t0);
      clearInterval(iv);
    };
  }, []);
  return null;
}
