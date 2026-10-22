// NutriX glucose-impact model.
// 1) Every dish gets a GI ESTIMATE from its category (the food dataset has no GI values).
// 2) Meal glucose load (GL) = Σ available carbs (carbs − fibre) × GI / 100, then damped for the
//    protein, fat and fibre on the same plate (mixed meals raise glucose more slowly).
// 3) Once a person has ≥ 3 meals with a measured rise, we fit THEIR factor k (mg/dL per GL unit)
//    by least squares through the origin, and predict their rise = k × GL.
// All numbers are estimates for pattern-spotting, not medical advice.
import { DISH_BY_ID, nutritionFor, type Dish } from "./dishes";
import type { Meal, MealItem, Reading } from "./types";
import { riseForMeal } from "./glucose";

type GiRule = { re: RegExp; gi: number; group: string };
// Order matters: first match wins. Values are category-level estimates, not measured GI.
const GI_RULES: GiRule[] = [
  { re: /sabudana|sago/i, gi: 72, group: "potato & sago" },
  { re: /biryani|biriyani|pulao|pulav|fried rice|curd rice|dahi chawal|lemon rice|bisi bele|tamarind rice|vangi bhat/i, gi: 65, group: "rice dishes" },
  { re: /khichdi|khichri|khitchdi|pongal/i, gi: 58, group: "rice & dal mixes" },
  { re: /roti|chapati|phulka|paratha|parantha|thepla|bhakri|jowar|bajra|makki|millet|ragi/i, gi: 58, group: "whole-grain breads" },
  { re: /rice|chawal|bhaat|idli|idly|dosa|uttapam|appam|poha|upma|rava|semolina|vermicelli|seviyan/i, gi: 70, group: "rice & batter" },
  { re: /jalebi|gulab|rasgulla|rasmalai|ladoo|laddu|barfi|burfi|halwa|kheer|payasam|mysore pak|modak|basundi|ghevar|kulfi|cake|kesari|sheera|puran|shrikhand/i, gi: 65, group: "sweets" },
  { re: /\btea\b|chai|coffee|juice|sharbat|soft drink/i, gi: 60, group: "drinks" },
  { re: /salad|sprout|kachumber|cucumber|raita|curd|dahi|yogurt|lassi|chaas|buttermilk/i, gi: 35, group: "dairy & salads" },
  { re: /chicken|mutton|fish|egg|prawn|keema|meat|tandoori|kebab|tikka/i, gi: 40, group: "protein dishes" },
  { re: /dal|daal|rajma|chole|chana|chickpea|moong|urad|masoor|lentil|sambar|sambhar|rasam|kadhi|pesarattu|dhokla|khaman|besan/i, gi: 38, group: "dals & legumes" },
  { re: /aloo|potato|batata|pav bhaji|bhaji/i, gi: 72, group: "potato dishes" },
  { re: /naan|kulcha|bhatura|bhature|puri|poori|bread|\bpav\b|pizza|pasta|noodle|maida|samosa|kachori|burger|sandwich|wrap|fries|momo/i, gi: 68, group: "refined flour" },
  { re: /bhindi|okra|baingan|brinjal|cabbage|gobi|gobhi|cauliflower|palak|spinach|methi|beans|lauki|tinda|karela|capsicum|mushroom|mixed veg|sabzi|subzi|curry|korma|masala|paneer/i, gi: 40, group: "vegetable curries" },
];
export const DEFAULT_GI = 55;

export function giFor(d: Dish): { gi: number; group: string } {
  const text = `${d.name} ${d.sourceName} ${d.aliases.join(" ")}`;
  for (const r of GI_RULES) if (r.re.test(text)) return { gi: r.gi, group: r.group };
  return { gi: DEFAULT_GI, group: "other" };
}

/** Raw GL of one item (before mixed-meal damping). */
export function itemLoad(dishId: string, portion: number) {
  const d = DISH_BY_ID[dishId];
  if (!d) return { gl: 0, gi: 0, availCarbs: 0 };
  const n = nutritionFor(dishId, portion);
  const avail = Math.max(0, n.carbs - (n.fibre || 0));
  const { gi } = giFor(d);
  return { gl: (avail * gi) / 100, gi, availCarbs: avail };
}

/** Mixed-meal damping: protein, fat and fibre slow absorption. Bounded to 0.65–1. */
export function damping(protein: number, fat: number, fibre: number) {
  const f = 1 / (1 + 0.006 * protein + 0.004 * fat + 0.02 * fibre);
  return Math.max(0.65, Math.min(1, f));
}

export interface MealLoad {
  gl: number; // damped meal glucose load
  rawGl: number;
  carbs: number;
  fibre: number;
  protein: number;
  fat: number;
  kcal: number;
  band: Band;
  parts: { dishId: string; name: string; gl: number; share: number }[];
}

export type Band = "low" | "moderate" | "high";
// Meal-level bands used in this app (a single food's GL ≥ 20 is "high"; a whole meal is judged more loosely).
export const BAND_LIMITS = { low: 20, high: 40 };
export const bandFor = (gl: number): Band => (gl < BAND_LIMITS.low ? "low" : gl <= BAND_LIMITS.high ? "moderate" : "high");
export const BAND_LABEL: Record<Band, string> = { low: "Low load", moderate: "Moderate load", high: "High load" };

export function loadForItems(items: Pick<MealItem, "dishId" | "portion">[]): MealLoad {
  let raw = 0, carbs = 0, fibre = 0, protein = 0, fat = 0, kcal = 0;
  const parts: MealLoad["parts"] = [];
  for (const it of items) {
    const d = DISH_BY_ID[it.dishId];
    if (!d) continue;
    const n = nutritionFor(it.dishId, it.portion);
    const { gl } = itemLoad(it.dishId, it.portion);
    raw += gl;
    carbs += n.carbs; fibre += n.fibre || 0; protein += n.protein; fat += n.fat; kcal += n.kcal;
    parts.push({ dishId: it.dishId, name: d.name, gl, share: 0 });
  }
  const damp = damping(protein, fat, fibre);
  const gl = Math.round(raw * damp * 10) / 10;
  for (const p of parts) p.share = raw > 0 ? p.gl / raw : 0;
  parts.sort((a, b) => b.gl - a.gl);
  return { gl, rawGl: Math.round(raw * 10) / 10, carbs: Math.round(carbs), fibre: Math.round(fibre * 10) / 10, protein: Math.round(protein), fat: Math.round(fat), kcal: Math.round(kcal), band: bandFor(gl), parts };
}

export const mealLoad = (m: Meal) => loadForItems(m.items);

// ---------- personal calibration ----------
export interface Calibration {
  n: number; // meals used
  k: number | null; // mg/dL per GL unit
  r2: number | null;
  points: { mealId: string; gl: number; rise: number; when: string }[];
  ready: boolean; // n >= MIN_CAL
}
export const MIN_CAL = 3;

export function calibrate(meals: Meal[], readings: Reading[]): Calibration {
  const points = meals
    .map((m) => ({ m, r: riseForMeal(m, readings).rise, gl: mealLoad(m).gl }))
    .filter((x) => x.r != null && x.gl >= 3)
    .map((x) => ({ mealId: x.m.id, gl: x.gl, rise: x.r as number, when: x.m.eatenAt }));
  const n = points.length;
  if (n < MIN_CAL) return { n, k: null, r2: null, points, ready: false };
  const sxy = points.reduce((s, p) => s + p.gl * p.rise, 0);
  const sxx = points.reduce((s, p) => s + p.gl * p.gl, 0);
  const k = sxx > 0 ? Math.max(0, sxy / sxx) : null;
  let r2: number | null = null;
  if (k != null) {
    const mean = points.reduce((s, p) => s + p.rise, 0) / n;
    const ssTot = points.reduce((s, p) => s + (p.rise - mean) ** 2, 0);
    const ssRes = points.reduce((s, p) => s + (p.rise - k * p.gl) ** 2, 0);
    r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : null;
  }
  return { n, k: k != null ? Math.round(k * 100) / 100 : null, r2: r2 != null ? Math.round(r2 * 100) / 100 : null, points, ready: k != null };
}

export const predictRise = (gl: number, cal: Calibration) => (cal.ready && cal.k != null ? Math.round(cal.k * gl) : null);

/** Expected glucose curve shape (mg/dL above baseline), peak at tp minutes; slower with more fat/protein. */
export function curve(peak: number, fat: number, protein: number, minutes = 180, step = 5) {
  const tp = Math.min(75, 40 + 0.4 * fat + 0.2 * protein);
  const pts: { t: number; v: number }[] = [];
  for (let t = 0; t <= minutes; t += step) pts.push({ t, v: peak * (t / tp) * Math.exp(1 - t / tp) });
  return { tp: Math.round(tp), pts };
}

// ---------- gentle swap suggestions (add or swap, never "avoid") ----------
export interface Suggestion {
  title: string;
  detail: string;
  items: Pick<MealItem, "dishId" | "portion" | "name">[];
  gl: number;
  drop: number; // % lower load than current
}

const ADD_CANDIDATES = ["salad", "sprouts_salad", "moong_dal", "cucumber_raita"];

export function suggestions(items: Pick<MealItem, "dishId" | "portion" | "name">[]): Suggestion[] {
  const valid = items.filter((i) => DISH_BY_ID[i.dishId]);
  if (!valid.length) return [];
  const base = loadForItems(valid);
  if (base.band === "low") return [];
  const top = base.parts[0];
  const topItem = valid.find((i) => i.dishId === top.dishId)!;
  const topDish = DISH_BY_ID[top.dishId];
  const out: Suggestion[] = [];
  const push = (title: string, detail: string, next: Pick<MealItem, "dishId" | "portion" | "name">[]) => {
    const l = loadForItems(next);
    const drop = Math.round((1 - l.gl / base.gl) * 100);
    if (drop >= 8) out.push({ title, detail, items: next, gl: l.gl, drop });
  };
  const has = (id: string) => valid.some((i) => i.dishId === id);

  // 1. A smaller portion of the biggest contributor, plus a katori of salad
  const smaller = topDish.unit === "piece" ? Math.max(1, topItem.portion - 1) : Math.max(0.5, topItem.portion - 0.5);
  if (smaller < topItem.portion) {
    const next = valid.map((i) => (i.dishId === top.dishId ? { ...i, portion: smaller } : i));
    if (!has("salad")) next.push({ dishId: "salad", portion: 1, name: DISH_BY_ID.salad.name });
    push(`Swap ${topDish.unit === "piece" ? "1" : "½ katori of"} ${topDish.name.toLowerCase()} for a katori of salad`, `${topDish.name} gives ${Math.round(top.share * 100)}% of this meal's load; the salad keeps the plate just as full.`, next);
  }
  // 2. Add protein/fibre to the plate (slows the rise)
  for (const id of ADD_CANDIDATES) {
    if (has(id) || !DISH_BY_ID[id]) continue;
    push(`Add 1 katori of ${DISH_BY_ID[id].name.toLowerCase()}`, "Protein and fibre on the plate slow how fast carbs reach your blood.", [...valid, { dishId: id, portion: 1, name: DISH_BY_ID[id].name }]);
    if (out.length >= 2) break;
  }
  // 3. Swap white rice for a mixed-grain option when present
  if (has("plain_rice") && DISH_BY_ID.veg_khichdi) {
    push("Swap plain rice for vegetable khichdi", "Dal and vegetables cooked into the rice lower the load per katori.", valid.map((i) => (i.dishId === "plain_rice" ? { dishId: "veg_khichdi", portion: i.portion, name: DISH_BY_ID.veg_khichdi.name } : i)));
  }
  return out.sort((a, b) => b.drop - a.drop).slice(0, 3);
}
