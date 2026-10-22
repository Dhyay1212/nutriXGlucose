"use client";
// Extended nutrition: macros from the dish table + 29 micronutrients from INDB (public/data/micros.json),
// or from the AI estimate for photographed dishes. Daily references are Codex Alimentarius NRVs used on food
// labels (2,000 kcal adult); "limit" nutrients are upper guides (WHO / Codex). Not personalised targets.
import { DISH_BY_ID, nutritionFor } from "./dishes";
import { giFor, loadForItems } from "./impact";
import type { MealItem } from "./types";

export type NutrientKey =
  | "kcal" | "carbs" | "netCarbs" | "sugar" | "fibre" | "protein" | "fat" | "satfat" | "mufa" | "pufa" | "cholesterol"
  | "sodium" | "potassium" | "calcium" | "phosphorus" | "magnesium" | "iron" | "zinc" | "copper" | "manganese" | "selenium" | "chromium"
  | "vitA" | "carotenoids" | "vitD" | "vitE" | "vitK" | "vitB1" | "vitB2" | "vitB3" | "vitB5" | "vitB6" | "vitB7" | "folate" | "vitC";

export interface NutrientMeta {
  key: NutrientKey;
  label: string;
  unit: "kcal" | "g" | "mg" | "µg";
  group: "Energy & macros" | "Fats" | "Minerals" | "Vitamins";
  ref?: number; // daily reference (Codex NRV / WHO)
  limit?: boolean; // ref is an upper guide, not a target
  indent?: boolean;
}

export const NUTRIENTS: NutrientMeta[] = [
  { key: "kcal", label: "Energy", unit: "kcal", group: "Energy & macros", ref: 2000 },
  { key: "carbs", label: "Carbohydrates", unit: "g", group: "Energy & macros", ref: 275 },
  { key: "netCarbs", label: "Net carbs (carbs − fibre)", unit: "g", group: "Energy & macros", indent: true },
  { key: "sugar", label: "Free sugars", unit: "g", group: "Energy & macros", ref: 50, limit: true, indent: true },
  { key: "fibre", label: "Fibre", unit: "g", group: "Energy & macros", ref: 25, indent: true },
  { key: "protein", label: "Protein", unit: "g", group: "Energy & macros", ref: 50 },
  { key: "fat", label: "Total fat", unit: "g", group: "Fats", ref: 70, limit: true },
  { key: "satfat", label: "Saturated fat", unit: "g", group: "Fats", ref: 20, limit: true, indent: true },
  { key: "mufa", label: "Monounsaturated fat", unit: "g", group: "Fats", indent: true },
  { key: "pufa", label: "Polyunsaturated fat", unit: "g", group: "Fats", indent: true },
  { key: "cholesterol", label: "Cholesterol", unit: "mg", group: "Fats", ref: 300, limit: true },
  { key: "sodium", label: "Sodium", unit: "mg", group: "Minerals", ref: 2000, limit: true },
  { key: "potassium", label: "Potassium", unit: "mg", group: "Minerals", ref: 3500 },
  { key: "calcium", label: "Calcium", unit: "mg", group: "Minerals", ref: 1000 },
  { key: "phosphorus", label: "Phosphorus", unit: "mg", group: "Minerals", ref: 700 },
  { key: "magnesium", label: "Magnesium", unit: "mg", group: "Minerals", ref: 310 },
  { key: "iron", label: "Iron", unit: "mg", group: "Minerals", ref: 14 },
  { key: "zinc", label: "Zinc", unit: "mg", group: "Minerals", ref: 11 },
  { key: "copper", label: "Copper", unit: "mg", group: "Minerals", ref: 0.9 },
  { key: "manganese", label: "Manganese", unit: "mg", group: "Minerals", ref: 3 },
  { key: "selenium", label: "Selenium", unit: "µg", group: "Minerals", ref: 60 },
  { key: "chromium", label: "Chromium", unit: "mg", group: "Minerals" },
  { key: "vitA", label: "Vitamin A (retinol)", unit: "µg", group: "Vitamins", ref: 800 },
  { key: "carotenoids", label: "Carotenoids", unit: "µg", group: "Vitamins" },
  { key: "vitD", label: "Vitamin D", unit: "µg", group: "Vitamins", ref: 5 },
  { key: "vitE", label: "Vitamin E", unit: "mg", group: "Vitamins", ref: 9 },
  { key: "vitK", label: "Vitamin K", unit: "µg", group: "Vitamins", ref: 60 },
  { key: "vitB1", label: "Thiamin (B1)", unit: "mg", group: "Vitamins", ref: 1.2 },
  { key: "vitB2", label: "Riboflavin (B2)", unit: "mg", group: "Vitamins", ref: 1.2 },
  { key: "vitB3", label: "Niacin (B3)", unit: "mg", group: "Vitamins", ref: 15 },
  { key: "vitB5", label: "Pantothenic acid (B5)", unit: "mg", group: "Vitamins", ref: 5 },
  { key: "vitB6", label: "Vitamin B6", unit: "mg", group: "Vitamins", ref: 1.3 },
  { key: "vitB7", label: "Biotin (B7)", unit: "µg", group: "Vitamins", ref: 30 },
  { key: "folate", label: "Folate (B9)", unit: "µg", group: "Vitamins", ref: 400 },
  { key: "vitC", label: "Vitamin C", unit: "mg", group: "Vitamins", ref: 100 },
];
export const NUTRIENT_BY_KEY = Object.fromEntries(NUTRIENTS.map((n) => [n.key, n])) as Record<NutrientKey, NutrientMeta>;
export const MACRO_KEYS: NutrientKey[] = ["kcal", "carbs", "netCarbs", "sugar", "fibre", "protein", "fat", "satfat", "mufa", "pufa", "cholesterol"];

type MicroFile = { keys: string[]; values: Record<string, number[]> };
let microPromise: Promise<MicroFile> | null = null;
export function loadMicros(): Promise<MicroFile> {
  if (!microPromise) {
    microPromise = fetch("/data/micros.json").then((r) => (r.ok ? r.json() : { keys: [], values: {} }));
    microPromise.catch(() => (microPromise = null));
  }
  return microPromise;
}

export type Totals = Partial<Record<NutrientKey, number>>;
export interface MealNutrition {
  totals: Totals;
  coverage: Partial<Record<NutrientKey, number>>; // how many items had a value for this nutrient
  items: number;
  grams: number;
}

/** Sum every nutrient for a set of items. Micros come from INDB (per unit) or from the AI estimate on custom dishes. */
export function mealNutrition(items: Pick<MealItem, "dishId" | "portion">[], micros: MicroFile | null): MealNutrition {
  const totals: Totals = {};
  const coverage: MealNutrition["coverage"] = {};
  let n = 0, grams = 0;
  const add = (k: NutrientKey, v: number | null | undefined) => {
    if (v == null || Number.isNaN(v)) return;
    totals[k] = (totals[k] ?? 0) + v;
    coverage[k] = (coverage[k] ?? 0) + 1;
  };
  for (const it of items) {
    const d = DISH_BY_ID[it.dishId];
    if (!d) continue;
    n++;
    const base = nutritionFor(it.dishId, it.portion);
    grams += base.grams || 0;
    const p = d.perUnit as any;
    add("kcal", p.kcal * it.portion);
    add("carbs", p.carbs * it.portion);
    add("protein", p.protein * it.portion);
    add("fat", p.fat * it.portion);
    add("fibre", (p.fibre ?? 0) * it.portion);
    add("netCarbs", Math.max(0, (p.carbs - (p.fibre ?? 0)) * it.portion));
    const extra = (d as any).micros as Record<string, number> | undefined; // AI-estimated dishes
    const row = micros?.values[it.dishId];
    for (const meta of NUTRIENTS) {
      if (["kcal", "carbs", "protein", "fat", "fibre", "netCarbs"].includes(meta.key)) continue;
      if (row && micros) {
        const i = micros.keys.indexOf(meta.key);
        if (i >= 0) add(meta.key, row[i] * it.portion);
      } else if (extra && extra[meta.key] != null) {
        add(meta.key, extra[meta.key] * it.portion);
      } else if (meta.key === "sugar" && p.sugar != null) {
        add("sugar", p.sugar * it.portion);
      }
    }
  }
  return { totals, coverage, items: n, grams };
}

/** Glucose-relevant derived metrics for a plate. */
export function glucoseMetrics(items: Pick<MealItem, "dishId" | "portion">[], t: Totals, grams: number) {
  const L = loadForItems(items);
  let giNum = 0, giDen = 0;
  for (const it of items) {
    const d = DISH_BY_ID[it.dishId];
    if (!d) continue;
    const n = nutritionFor(it.dishId, it.portion);
    const avail = Math.max(0, n.carbs - (n.fibre || 0));
    giNum += giFor(d).gi * avail;
    giDen += avail;
  }
  const carbs = t.carbs ?? 0, protein = t.protein ?? 0, fibre = t.fibre ?? 0, kcal = t.kcal ?? 0, fat = t.fat ?? 0;
  return {
    gl: L.gl,
    band: L.band,
    gi: giDen ? Math.round(giNum / giDen) : null,
    carbEnergyPct: kcal ? Math.round((carbs * 4 * 100) / kcal) : null,
    proteinPerCarb: carbs ? Math.round((protein / carbs) * 100) / 100 : null,
    fibrePer100kcal: kcal ? Math.round((fibre * 100 * 10) / kcal) / 10 : null,
    energyDensity: grams ? Math.round((kcal / grams) * 100) / 100 : null,
    sugarPctCarbs: carbs && t.sugar != null ? Math.round((t.sugar * 100) / carbs) : null,
    fatEnergyPct: kcal ? Math.round((fat * 9 * 100) / kcal) : null,
  };
}

export function fmtNutrient(v: number | undefined, unit: string) {
  if (v == null) return "–";
  const d = v >= 100 ? 0 : v >= 10 ? 1 : v >= 1 ? 1 : 2;
  return `${v.toFixed(d).replace(/\.0+$/, "")} ${unit}`;
}
