"use client";
import { DISH_BY_ID, nutritionFor } from "./dishes";
import { saveMeal, saveReading, saveUser, uid } from "./store";
import type { Meal, MealItem } from "./types";
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

export const DEMO_USER = { id: "P00", name: "Demo user (sample data)" };

export async function seedDemoWeek() {
  await saveUser(DEMO_USER);
  const now = new Date();
  let seed = 7;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let d = 6; d >= 0; d--) {
    for (const plan of [BREAKFASTS[6 - d], LUNCHES[6 - d], DINNERS[6 - d]]) {
      const t = new Date(now);
      t.setDate(now.getDate() - d);
      t.setHours(plan.hour, Math.floor(rand() * 30), 0, 0);
      if (t > now) continue;
      const items: MealItem[] = plan.items.map(([id, p]) => ({ dishId: id, name: DISH_BY_ID[id].name, portion: p, confidence: 0.9 }));
      const totals = items.reduce(
        (a, it) => {
          const n = nutritionFor(it.dishId, it.portion);
          return { kcal: a.kcal + n.kcal, carbs: a.carbs + n.carbs, protein: a.protein + n.protein, fat: a.fat + n.fat, fibre: a.fibre + n.fibre };
        },
        { kcal: 0, carbs: 0, protein: 0, fat: 0, fibre: 0 }
      );
      const meal: Meal = { id: uid(), userId: DEMO_USER.id, eatenAt: t.toISOString(), items, photo: null, totals, createdAt: new Date().toISOString() };
      await saveMeal(meal);
      const pre = Math.round(105 + rand() * 25);
      const preT = new Date(t.getTime() - 10 * 60000);
      const peakT = new Date(t.getTime() + (75 + rand() * 45) * 60000);
      if (peakT > now) {
        await saveReading({ id: uid(), userId: DEMO_USER.id, takenAt: preT.toISOString(), mgdl: pre, createdAt: new Date().toISOString() });
        continue;
      }
      await saveReading({ id: uid(), userId: DEMO_USER.id, takenAt: preT.toISOString(), mgdl: pre, createdAt: new Date().toISOString() });
      // Demo person: rise ≈ 2.1 mg/dL per unit of meal glucose load, plus noise (so the personal model has something to learn).
      const rise = Math.round(2.1 * loadForItems(items).gl + 6 + (rand() * 16 - 8));
      await saveReading({ id: uid(), userId: DEMO_USER.id, takenAt: peakT.toISOString(), mgdl: pre + rise, createdAt: new Date().toISOString() });
    }
  }
  return DEMO_USER.id;
}
