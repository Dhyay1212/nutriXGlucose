"use client";
import { DISH_BY_ID, nutritionFor } from "./dishes";
import { replaceUserData, saveUser, uid } from "./store";
import type { Meal, MealItem, Reading } from "./types";
import { loadForItems } from "./impact";

// A plausible demo week so charts and notes have something to show. Clearly labelled as demo data.
type Plan = { hour: number; items: [string, number][]; rise: number };
const BREAKFASTS: Plan[] = [
  { hour: 8, items: [["poha", 1.5]], rise: 48 },
  { hour: 8, items: [["idli", 3], ["sambar", 1]], rise: 42 },
  { hour: 8, items: [["plain_dosa", 2], ["sambar", 1]], rise: 58 },
  { hour: 8, items: [["upma", 1.5]], rise: 44 },
  { hour: 8, items: [["thepla", 2], ["cucumber_raita", 1]], rise: 30 },
  { hour: 8, items: [["poha", 1.5]], rise: 52 },
  { hour: 8, items: [["plain_dosa", 2], ["sambar", 1]], rise: 61 },
];
const LUNCHES: Plan[] = [
  { hour: 13, items: [["plain_rice", 1.5], ["toor_dal", 1], ["bhindi", 1], ["roti", 1]], rise: 64 },
  { hour: 13, items: [["roti", 3], ["toor_dal", 1], ["cabbage_matar", 1], ["salad", 1]], rise: 34 },
  { hour: 13, items: [["plain_rice", 1.5], ["rajma", 1], ["cucumber_raita", 1]], rise: 70 },
  { hour: 13, items: [["roti", 3], ["chole", 1], ["salad", 1]], rise: 38 },
  { hour: 13, items: [["plain_rice", 2], ["sambar", 1], ["cucumber_raita", 1]], rise: 72 },
  { hour: 13, items: [["roti", 2], ["toor_dal", 1], ["aloo_sabzi", 1]], rise: 46 },
  { hour: 13, items: [["veg_biryani", 2], ["cucumber_raita", 1]], rise: 68 },
];
const DINNERS: Plan[] = [
  { hour: 20, items: [["roti", 2], ["toor_dal", 1], ["cabbage_matar", 1]], rise: 32 },
  { hour: 20, items: [["veg_khichdi", 1.5], ["cucumber_raita", 1]], rise: 50 },
  { hour: 20, items: [["roti", 2], ["palak_paneer", 1], ["salad", 1]], rise: 26 },
  { hour: 20, items: [["plain_rice", 1], ["toor_dal", 1], ["bhindi", 1]], rise: 55 },
  { hour: 20, items: [["roti", 2], ["chicken_curry", 1], ["salad", 1]], rise: 24 },
  { hour: 20, items: [["veg_khichdi", 1.5], ["cucumber_raita", 1]], rise: 47 },
  { hour: 20, items: [["roti", 2], ["toor_dal", 1], ["bhindi", 1]], rise: 30 },
];

export const DEMO_USER = { id: "P00", name: "Person 1 (sample data)" };
export const DEMO_DAYS = 30;

const SNACKS: Plan[] = [
  { hour: 17, items: [["tea", 1], ["dhokla", 2]], rise: 0 },
  { hour: 17, items: [["tea", 1]], rise: 0 },
  { hour: 17, items: [["sprouts_salad", 1]], rise: 0 },
  { hour: 17, items: [["salted_lassi", 1]], rise: 0 },
];

/** Person 1: 30 days of meals and readings. Replaces any earlier sample data for P00 (no duplicates).
 *  Their glucose responds ≈ 2.1 mg/dL per unit of meal glucose load + noise, so the personal model can learn it.
 *  About 1 in 6 meals has no 2-hour reading (real people miss some). */
export async function seedDemoWeek() {
  await saveUser(DEMO_USER);
  const now = new Date();
  let seed = 7;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const meals: Meal[] = [];
  const readings: Reading[] = [];
  const stamp = new Date().toISOString();
  const reading = (t: Date, mgdl: number): Reading => ({ id: uid(), userId: DEMO_USER.id, takenAt: t.toISOString(), mgdl: Math.round(mgdl), createdAt: stamp });

  for (let d = DEMO_DAYS - 1; d >= 0; d--) {
    const day: Plan[] = [pick(BREAKFASTS), pick(LUNCHES), pick(DINNERS)];
    if (rand() < 0.35) day.splice(2, 0, pick(SNACKS));
    const fasting = 100 + rand() * 22;
    for (const plan of day) {
      const t = new Date(now);
      t.setDate(now.getDate() - d);
      t.setHours(plan.hour, Math.floor(rand() * 40), 0, 0);
      if (t > now) continue;
      // portions vary a little day to day
      const items: MealItem[] = plan.items.map(([id, p]) => {
        const unit = DISH_BY_ID[id].unit;
        const jitter = rand() < 0.25 ? (unit === "piece" ? 1 : 0.5) * (rand() < 0.5 ? -1 : 1) : 0;
        const portion = Math.max(unit === "piece" ? 1 : 0.5, p + jitter);
        return { dishId: id, name: DISH_BY_ID[id].name, portion, confidence: 0.9 };
      });
      const totals = items.reduce(
        (a, it) => {
          const n = nutritionFor(it.dishId, it.portion);
          return { kcal: a.kcal + n.kcal, carbs: a.carbs + n.carbs, protein: a.protein + n.protein, fat: a.fat + n.fat, fibre: Math.round((a.fibre + n.fibre) * 10) / 10 };
        },
        { kcal: 0, carbs: 0, protein: 0, fat: 0, fibre: 0 }
      );
      meals.push({ id: uid(), userId: DEMO_USER.id, eatenAt: t.toISOString(), items, photo: null, totals, source: "manual", logSeconds: Math.round(20 + rand() * 40), createdAt: stamp });

      const pre = fasting + (plan.hour > 11 ? 8 + rand() * 12 : rand() * 6);
      readings.push(reading(new Date(t.getTime() - 10 * 60000), pre));
      const peakT = new Date(t.getTime() + (70 + rand() * 50) * 60000);
      if (peakT > now || rand() < 0.16) continue; // missed / not yet due
      const rise = 2.1 * loadForItems(items).gl + 6 + (rand() * 18 - 9);
      readings.push(reading(peakT, pre + Math.max(5, rise)));
    }
  }
  await replaceUserData(DEMO_USER.id, meals, readings);
  return DEMO_USER.id;
}
