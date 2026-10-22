import type { Meal, Reading } from "./types";

// Matching rules (scope §6): glucose rise = peak within 2 h minus pre-meal reading.
// Pre-meal reading: the latest reading from 60 min before to 10 min after the meal.
// Peak: highest reading from 15 min to 150 min after the meal (allows a "2 hours later" finger-prick a bit late).
export const PRE_WINDOW_MIN = 60;
export const PRE_AFTER_MIN = 10;
export const PEAK_START_MIN = 15;
export const PEAK_END_MIN = 150;
export const MIN_INSTANCES = 3; // guardrail: below this, say "not enough data"

export interface MealRise {
  mealId: string;
  pre: number | null;
  peak: number | null;
  rise: number | null;
  peakAt: string | null;
}

const MIN = 60_000;

export function riseForMeal(meal: Meal, readings: Reading[]): MealRise {
  const t = new Date(meal.eatenAt).getTime();
  const mine = readings
    .filter((r) => r.userId === meal.userId)
    .map((r) => ({ ...r, ts: new Date(r.takenAt).getTime() }))
    .sort((a, b) => a.ts - b.ts);

  const preCands = mine.filter((r) => r.ts >= t - PRE_WINDOW_MIN * MIN && r.ts <= t + PRE_AFTER_MIN * MIN);
  const pre = preCands.length ? preCands[preCands.length - 1] : null;
  const postCands = mine.filter((r) => r.ts >= t + PEAK_START_MIN * MIN && r.ts <= t + PEAK_END_MIN * MIN);
  const peak = postCands.length ? postCands.reduce((m, r) => (r.mgdl > m.mgdl ? r : m)) : null;

  return {
    mealId: meal.id,
    pre: pre?.mgdl ?? null,
    peak: peak?.mgdl ?? null,
    rise: pre && peak ? peak.mgdl - pre.mgdl : null,
    peakAt: peak?.takenAt ?? null,
  };
}

export interface DishStat {
  dishId: string;
  name: string;
  times: number; // meals containing the dish
  timesWithRise: number;
  avgRise: number | null;
  minRise: number | null;
  maxRise: number | null;
  avgCarbsMeal: number | null; // avg total carbs of meals containing it
  enoughData: boolean;
}

/** Per-dish stats. A meal's rise is attributed to every dish in it (mixed plates), so these are associations, not causes. */
export function dishStats(meals: Meal[], readings: Reading[]): DishStat[] {
  const rises = new Map(meals.map((m) => [m.id, riseForMeal(m, readings).rise]));
  const acc = new Map<string, { name: string; times: number; rises: number[]; carbs: number[] }>();
  for (const m of meals) {
    const seen = new Set<string>();
    for (const it of m.items) {
      if (seen.has(it.dishId)) continue;
      seen.add(it.dishId);
      const a = acc.get(it.dishId) ?? { name: it.name, times: 0, rises: [], carbs: [] };
      a.times++;
      a.carbs.push(m.totals.carbs);
      const r = rises.get(m.id);
      if (r != null) a.rises.push(r);
      acc.set(it.dishId, a);
    }
  }
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
  return [...acc.entries()]
    .map(([dishId, a]) => ({
      dishId,
      name: a.name,
      times: a.times,
      timesWithRise: a.rises.length,
      avgRise: avg(a.rises),
      minRise: a.rises.length ? Math.min(...a.rises) : null,
      maxRise: a.rises.length ? Math.max(...a.rises) : null,
      avgCarbsMeal: avg(a.carbs),
      enoughData: a.rises.length >= MIN_INSTANCES,
    }))
    .sort((x, y) => (y.avgRise ?? -999) - (x.avgRise ?? -999));
}

export function startOfWeek(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - 6); // rolling last 7 days
  return x;
}

export function inLastWeek<T>(items: T[], getDate: (t: T) => string, now = new Date()): T[] {
  const from = startOfWeek(now).getTime();
  return items.filter((i) => new Date(getDate(i)).getTime() >= from);
}
