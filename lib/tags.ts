// Meal context tags and "what helps you" effects.
// Effect of a tag = average (measured rise − rise your model expected from the plate's load) for meals WITH the tag,
// minus the same for meals WITHOUT it. Negative = smaller rises than usual. Needs a calibrated personal model.
import type { Meal, Reading } from "./types";
import { calibrate, mealLoad, type Calibration } from "./impact";
import { riseForMeal } from "./glucose";

export interface TagDef { id: string; label: string; icon: string; kind: "change" | "context"; tip?: string }
export const TAGS: TagDef[] = [
  { id: "walk", label: "Walked 10+ min after", icon: "🚶", kind: "change", tip: "A short walk after eating helps muscles use glucose." },
  { id: "salad_first", label: "Veggies / salad first", icon: "🥗", kind: "change", tip: "Eating fibre and vegetables before carbs can soften the rise." },
  { id: "protein_added", label: "Added dal / curd / egg", icon: "🥚", kind: "change", tip: "Protein on the plate slows how fast carbs are absorbed." },
  { id: "smaller", label: "Smaller carb portion", icon: "🍚", kind: "change" },
  { id: "meds", label: "Took diabetes meds", icon: "💊", kind: "context" },
  { id: "poor_sleep", label: "Slept badly", icon: "😴", kind: "context" },
  { id: "stress", label: "Stressed / unwell", icon: "🤒", kind: "context" },
  { id: "exercise_before", label: "Exercised earlier", icon: "🏃", kind: "context" },
];
export const TAG_BY_ID = Object.fromEntries(TAGS.map((t) => [t.id, t])) as Record<string, TagDef>;

export interface TagEffect {
  tag: TagDef;
  withN: number;
  withoutN: number;
  effect: number; // mg/dL vs usual
  strength: "early sign" | "pattern";
}

export function tagEffects(meals: Meal[], readings: Reading[], cal?: Calibration): TagEffect[] {
  const c = cal ?? calibrate(meals, readings);
  if (!c.ready || c.k == null) return [];
  const rows = meals
    .map((m) => ({ m, rise: riseForMeal(m, readings).rise }))
    .filter((x) => x.rise != null)
    .map((x) => ({ tags: x.m.tags ?? [], resid: (x.rise as number) - c.k! * mealLoad(x.m).gl }));
  const out: TagEffect[] = [];
  for (const tag of TAGS) {
    const w = rows.filter((r) => r.tags.includes(tag.id)).map((r) => r.resid);
    const wo = rows.filter((r) => !r.tags.includes(tag.id)).map((r) => r.resid);
    if (w.length < 2 || wo.length < 3) continue;
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    out.push({ tag, withN: w.length, withoutN: wo.length, effect: Math.round(mean(w) - mean(wo)), strength: w.length >= 4 ? "pattern" : "early sign" });
  }
  return out.sort((a, b) => a.effect - b.effect);
}

// ---------- experiments (a change the person decided to try N times) ----------
export interface Experiment { tagId: string; target: number; startedAt: string }
const key = (userId: string) => `nxg_experiments_${userId}`;
export function listExperiments(userId: string): Experiment[] {
  try { return JSON.parse(localStorage.getItem(key(userId)) || "[]"); } catch { return []; }
}
export function startExperiment(userId: string, tagId: string, target = 3) {
  const xs = listExperiments(userId).filter((x) => x.tagId !== tagId);
  xs.push({ tagId, target, startedAt: new Date().toISOString() });
  try { localStorage.setItem(key(userId), JSON.stringify(xs)); } catch {}
}
export function stopExperiment(userId: string, tagId: string) {
  try { localStorage.setItem(key(userId), JSON.stringify(listExperiments(userId).filter((x) => x.tagId !== tagId))); } catch {}
}
/** Measured tries of an experiment since it started. */
export function experimentProgress(exp: Experiment, meals: Meal[], readings: Reading[]) {
  const tries = meals.filter((m) => m.eatenAt >= exp.startedAt && (m.tags ?? []).includes(exp.tagId));
  const measured = tries.filter((m) => riseForMeal(m, readings).rise != null);
  return { tries: tries.length, measured: measured.length };
}
