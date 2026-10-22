"use client";
// Data layer. Uses Supabase when NEXT_PUBLIC_SUPABASE_URL + ANON_KEY are set,
// otherwise falls back to this browser's localStorage (single-device demo mode).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { EducatorNote, Meal, Note, Reading, UserProfile } from "./types";
import { registerDish } from "./dishes";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let sb: SupabaseClient | null = null;
if (url && key) sb = createClient(url, key);

export const storageMode: "supabase" | "browser" = sb ? "supabase" : "browser";

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

// ---------- localStorage backend ----------
const LS = {
  get<T>(k: string): T[] {
    try {
      return JSON.parse(localStorage.getItem("nxg_" + k) || "[]");
    } catch {
      return [];
    }
  },
  set<T>(k: string, v: T[]) {
    try {
      localStorage.setItem("nxg_" + k, JSON.stringify(v));
    } catch (e) {
      console.warn("localStorage write failed", e);
      throw new Error("Browser storage is full. Delete some meals or connect Supabase.");
    }
  },
};

// ---------- row mappers ----------
const mealFromRow = (r: any): Meal => ({
  id: r.id, userId: r.user_id, eatenAt: r.eaten_at, items: r.items, photo: r.photo, totals: r.totals, logSeconds: r.log_seconds, source: r.source, tags: r.tags ?? [], createdAt: r.created_at,
});
const mealToRow = (m: Meal) => ({
  id: m.id, user_id: m.userId, eaten_at: m.eatenAt, items: m.items, photo: m.photo ?? null, totals: m.totals, log_seconds: m.logSeconds ?? null, source: m.source ?? null, tags: m.tags ?? [], created_at: m.createdAt,
});
const readingFromRow = (r: any): Reading => ({ id: r.id, userId: r.user_id, takenAt: r.taken_at, mgdl: r.mgdl, createdAt: r.created_at });
const readingToRow = (r: Reading) => ({ id: r.id, user_id: r.userId, taken_at: r.takenAt, mgdl: r.mgdl, created_at: r.createdAt });
const noteFromRow = (r: any): Note => ({ id: r.id, userId: r.user_id, weekStart: r.week_start, text: r.text, createdAt: r.created_at });
const noteToRow = (n: Note) => ({ id: n.id, user_id: n.userId, week_start: n.weekStart, text: n.text, created_at: n.createdAt });

function byUser<T extends { userId: string }>(xs: T[], userId?: string) {
  return userId ? xs.filter((x) => x.userId === userId) : xs;
}

// ---------- public API ----------
const profileFromRow = (r: any): UserProfile => ({ id: r.id, name: r.name, consentAt: r.consent_at, role: r.role ?? "participant", authId: r.auth_id });
const profileToRow = (u: UserProfile) => ({ id: u.id, name: u.name, consent_at: u.consentAt ?? null, ...(u.authId ? { auth_id: u.authId } : {}) });

// ---------- auth (only when Supabase is configured) ----------
export const authEnabled = !!sb;
export async function getAuthUser(): Promise<{ id: string; email?: string } | null> {
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? undefined } : null;
}
export async function signInWithEmail(email: string) {
  if (!sb) return;
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined } });
  if (error) throw error;
}
export async function signOut() {
  if (sb) await sb.auth.signOut();
}
export function onAuthChange(cb: () => void) {
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange(() => cb());
  return () => data.subscription.unsubscribe();
}

export async function listUsers(): Promise<UserProfile[]> {
  if (sb) {
    const { data, error } = await sb.from("profiles").select("*").order("id");
    if (error) throw error;
    return (data ?? []).map(profileFromRow);
  }
  return LS.get<UserProfile>("users");
}

export async function saveUser(u: UserProfile) {
  if (sb) {
    const { error } = await sb.from("profiles").upsert(profileToRow(u));
    if (error) throw error;
    return;
  }
  const xs = LS.get<UserProfile>("users").filter((x) => x.id !== u.id);
  LS.set("users", [...xs, u]);
}

export async function listMeals(userId?: string): Promise<Meal[]> {
  let xs: Meal[];
  if (sb) {
    let q = sb.from("meals").select("*").order("eaten_at", { ascending: false });
    if (userId) q = q.eq("user_id", userId);
    const { data, error } = await q;
    if (error) throw error;
    xs = (data ?? []).map(mealFromRow);
  } else xs = byUser(LS.get<Meal>("meals"), userId);
  for (const m of xs) for (const it of m.items) if (it.custom) registerDish(it.custom);
  return xs.sort((a, b) => b.eatenAt.localeCompare(a.eatenAt));
}

export async function saveMeal(m: Meal) {
  if (sb) {
    const { error } = await sb.from("meals").upsert(mealToRow(m));
    if (error) throw error;
    return;
  }
  LS.set("meals", [...LS.get<Meal>("meals").filter((x) => x.id !== m.id), m]);
}

export async function deleteMeal(id: string) {
  if (sb) {
    const { error } = await sb.from("meals").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  LS.set("meals", LS.get<Meal>("meals").filter((x) => x.id !== id));
}

export async function listReadings(userId?: string): Promise<Reading[]> {
  let xs: Reading[];
  if (sb) {
    let q = sb.from("readings").select("*").order("taken_at", { ascending: false });
    if (userId) q = q.eq("user_id", userId);
    const { data, error } = await q;
    if (error) throw error;
    xs = (data ?? []).map(readingFromRow);
  } else xs = byUser(LS.get<Reading>("readings"), userId);
  return xs.sort((a, b) => b.takenAt.localeCompare(a.takenAt));
}

export async function saveReading(r: Reading) {
  if (sb) {
    const { error } = await sb.from("readings").upsert(readingToRow(r));
    if (error) throw error;
    return;
  }
  LS.set("readings", [...LS.get<Reading>("readings").filter((x) => x.id !== r.id), r]);
}

export async function deleteReading(id: string) {
  if (sb) {
    const { error } = await sb.from("readings").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  LS.set("readings", LS.get<Reading>("readings").filter((x) => x.id !== id));
}

export async function listNotes(userId?: string): Promise<Note[]> {
  let xs: Note[];
  if (sb) {
    let q = sb.from("notes").select("*").order("created_at", { ascending: false });
    if (userId) q = q.eq("user_id", userId);
    const { data, error } = await q;
    if (error) throw error;
    xs = (data ?? []).map(noteFromRow);
  } else xs = byUser(LS.get<Note>("notes"), userId);
  return xs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveNote(n: Note) {
  if (sb) {
    const { error } = await sb.from("notes").upsert(noteToRow(n));
    if (error) throw error;
    return;
  }
  LS.set("notes", [...LS.get<Note>("notes").filter((x) => x.id !== n.id), n]);
}

// ---------- educator notes ----------
const enoteFromRow = (r: any): EducatorNote => ({ id: r.id, userId: r.user_id, author: r.author, text: r.text, createdAt: r.created_at });
export async function listEducatorNotes(userId?: string): Promise<EducatorNote[]> {
  let xs: EducatorNote[];
  if (sb) {
    let q = sb.from("educator_notes").select("*").order("created_at", { ascending: false });
    if (userId) q = q.eq("user_id", userId);
    const { data, error } = await q;
    if (error) throw error;
    xs = (data ?? []).map(enoteFromRow);
  } else xs = byUser(LS.get<EducatorNote>("enotes"), userId);
  return xs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function saveEducatorNote(n: EducatorNote) {
  if (sb) {
    const { error } = await sb.from("educator_notes").insert({ id: n.id, user_id: n.userId, author: n.author, text: n.text, created_at: n.createdAt });
    if (error) throw error;
    return;
  }
  LS.set("enotes", [...LS.get<EducatorNote>("enotes"), n]);
}

// ---------- export / delete (privacy) ----------
export async function exportUserData(userId: string) {
  const [users, meals, readings, notes, enotes] = await Promise.all([listUsers(), listMeals(userId), listReadings(userId), listNotes(userId), listEducatorNotes(userId).catch(() => [])]);
  return { exportedAt: new Date().toISOString(), profile: users.find((u) => u.id === userId) ?? null, meals, readings, weeklyNotes: notes, educatorNotes: enotes };
}
export async function deleteUserData(userId: string) {
  if (sb) {
    for (const t of ["meals", "readings", "notes", "educator_notes"]) {
      const { error } = await sb.from(t).delete().eq("user_id", userId);
      if (error) throw error;
    }
    const { error } = await sb.from("profiles").delete().eq("id", userId);
    if (error) throw error;
    return;
  }
  LS.set("meals", LS.get<Meal>("meals").filter((x) => x.userId !== userId));
  LS.set("readings", LS.get<Reading>("readings").filter((x) => x.userId !== userId));
  LS.set("notes", LS.get<Note>("notes").filter((x) => x.userId !== userId));
  LS.set("enotes", LS.get<EducatorNote>("enotes").filter((x) => x.userId !== userId));
  LS.set("users", LS.get<UserProfile>("users").filter((x) => x.id !== userId));
  try { localStorage.removeItem("nxg_current_user"); localStorage.removeItem(`nxg_experiments_${userId}`); } catch {}
}

/** Save many readings at once (CGM import). */
export async function addReadings(rs: Reading[]) {
  if (!rs.length) return;
  if (sb) {
    for (let i = 0; i < rs.length; i += 500) {
      const { error } = await sb.from("readings").insert(rs.slice(i, i + 500).map(readingToRow));
      if (error) throw error;
    }
    return;
  }
  LS.set("readings", [...LS.get<Reading>("readings"), ...rs]);
}

/** Replace ALL meals and readings of one user in one go (used by the sample-data loader). */
export async function replaceUserData(userId: string, meals: Meal[], readings: Reading[]) {
  if (sb) {
    let r = await sb.from("meals").delete().eq("user_id", userId);
    if (r.error) throw r.error;
    r = await sb.from("readings").delete().eq("user_id", userId);
    if (r.error) throw r.error;
    if (meals.length) { r = await sb.from("meals").insert(meals.map(mealToRow)); if (r.error) throw r.error; }
    if (readings.length) { r = await sb.from("readings").insert(readings.map(readingToRow)); if (r.error) throw r.error; }
    return;
  }
  LS.set("meals", [...LS.get<Meal>("meals").filter((m) => m.userId !== userId), ...meals]);
  LS.set("readings", [...LS.get<Reading>("readings").filter((x) => x.userId !== userId), ...readings]);
}

// ---------- current user (per device) ----------
export function getCurrentUserId(): string | null {
  try {
    return localStorage.getItem("nxg_current_user");
  } catch {
    return null;
  }
}
export function setCurrentUserId(id: string) {
  try {
    localStorage.setItem("nxg_current_user", id);
  } catch {}
}
