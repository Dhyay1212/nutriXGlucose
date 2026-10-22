// NutriX dish table for the MVP.
// PLACEHOLDER VALUES: approximate per-100 g figures for cooked, home-style dishes.
// Replace with the team's checked IFCT 2017 values before the pilot.
// Katori = 180 g (standard katori in the NutriX design). Piece dishes use a typical piece weight.

export type Unit = "katori" | "piece";

export interface Dish {
  id: string;
  name: string;
  aliases: string[];
  unit: Unit;
  unitGrams: number; // grams per 1 katori or 1 piece
  per100g: { kcal: number; carbs: number; protein: number; fat: number; fibre: number };
  checked: boolean; // true once verified against IFCT
}

const K = 180;

export const DISHES: Dish[] = [
  { id: "plain_rice", name: "Plain rice", aliases: ["steamed rice", "chawal", "white rice", "boiled rice"], unit: "katori", unitGrams: 150, per100g: { kcal: 130, carbs: 28, protein: 2.7, fat: 0.3, fibre: 0.4 }, checked: false },
  { id: "jeera_rice", name: "Jeera rice", aliases: ["cumin rice"], unit: "katori", unitGrams: 150, per100g: { kcal: 150, carbs: 27, protein: 3, fat: 3.5, fibre: 0.6 }, checked: false },
  { id: "roti", name: "Roti / chapati", aliases: ["chapati", "phulka", "fulka", "rotli", "chapathi"], unit: "piece", unitGrams: 40, per100g: { kcal: 297, carbs: 46, protein: 9.8, fat: 7.4, fibre: 4.9 }, checked: false },
  { id: "paratha", name: "Plain paratha", aliases: ["parantha", "parotta"], unit: "piece", unitGrams: 80, per100g: { kcal: 326, carbs: 45, protein: 6.4, fat: 13, fibre: 4 }, checked: false },
  { id: "thepla", name: "Thepla", aliases: ["methi thepla"], unit: "piece", unitGrams: 40, per100g: { kcal: 300, carbs: 40, protein: 8, fat: 12, fibre: 5 }, checked: false },
  { id: "dal_tadka", name: "Dal (toor/tadka)", aliases: ["dal", "toor dal", "arhar dal", "dal fry", "tadka dal", "varan", "pappu"], unit: "katori", unitGrams: K, per100g: { kcal: 116, carbs: 15, protein: 6, fat: 3.5, fibre: 3 }, checked: false },
  { id: "moong_dal", name: "Moong dal", aliases: ["yellow moong dal", "moong"], unit: "katori", unitGrams: K, per100g: { kcal: 105, carbs: 14, protein: 7, fat: 2.5, fibre: 3 }, checked: false },
  { id: "rajma", name: "Rajma curry", aliases: ["rajma", "kidney bean curry"], unit: "katori", unitGrams: K, per100g: { kcal: 140, carbs: 18, protein: 6.5, fat: 4.5, fibre: 5 }, checked: false },
  { id: "chole", name: "Chole", aliases: ["chana masala", "chickpea curry", "chhole"], unit: "katori", unitGrams: K, per100g: { kcal: 160, carbs: 20, protein: 7, fat: 5.5, fibre: 6 }, checked: false },
  { id: "sambar", name: "Sambar", aliases: ["sambhar"], unit: "katori", unitGrams: K, per100g: { kcal: 85, carbs: 11, protein: 3.5, fat: 2.8, fibre: 2.5 }, checked: false },
  { id: "rasam", name: "Rasam", aliases: ["saaru"], unit: "katori", unitGrams: K, per100g: { kcal: 40, carbs: 6, protein: 1.2, fat: 1.5, fibre: 0.8 }, checked: false },
  { id: "idli", name: "Idli", aliases: ["idly"], unit: "piece", unitGrams: 40, per100g: { kcal: 130, carbs: 27, protein: 4, fat: 0.5, fibre: 1.2 }, checked: false },
  { id: "plain_dosa", name: "Plain dosa", aliases: ["dosa", "dosai", "sada dosa"], unit: "piece", unitGrams: 90, per100g: { kcal: 168, carbs: 29, protein: 4, fat: 3.7, fibre: 1 }, checked: false },
  { id: "masala_dosa", name: "Masala dosa", aliases: ["potato dosa"], unit: "piece", unitGrams: 160, per100g: { kcal: 175, carbs: 26, protein: 3.8, fat: 6, fibre: 2 }, checked: false },
  { id: "upma", name: "Upma", aliases: ["rava upma", "uppittu"], unit: "katori", unitGrams: 150, per100g: { kcal: 130, carbs: 19, protein: 3, fat: 4.5, fibre: 1.5 }, checked: false },
  { id: "poha", name: "Poha", aliases: ["kanda poha", "aval", "chivda"], unit: "katori", unitGrams: 150, per100g: { kcal: 130, carbs: 22, protein: 2.6, fat: 3.8, fibre: 1.2 }, checked: false },
  { id: "khichdi", name: "Khichdi", aliases: ["khichri", "pongal"], unit: "katori", unitGrams: K, per100g: { kcal: 120, carbs: 19, protein: 4.5, fat: 3, fibre: 2 }, checked: false },
  { id: "veg_biryani", name: "Veg biryani", aliases: ["vegetable pulao", "pulao", "veg pulao"], unit: "katori", unitGrams: 150, per100g: { kcal: 160, carbs: 24, protein: 3.5, fat: 5.5, fibre: 1.5 }, checked: false },
  { id: "chicken_biryani", name: "Chicken biryani", aliases: ["biryani"], unit: "katori", unitGrams: 150, per100g: { kcal: 180, carbs: 20, protein: 9, fat: 7, fibre: 1 }, checked: false },
  { id: "aloo_sabzi", name: "Aloo sabzi", aliases: ["potato sabzi", "aloo bhaji", "batata bhaji", "potato curry"], unit: "katori", unitGrams: 120, per100g: { kcal: 105, carbs: 14, protein: 1.8, fat: 5, fibre: 1.8 }, checked: false },
  { id: "bhindi", name: "Bhindi sabzi", aliases: ["okra", "bhindi masala", "lady finger"], unit: "katori", unitGrams: 120, per100g: { kcal: 90, carbs: 8, protein: 2, fat: 6, fibre: 3.2 }, checked: false },
  { id: "mixed_veg", name: "Mixed veg curry", aliases: ["sabzi", "vegetable curry", "mix veg"], unit: "katori", unitGrams: K, per100g: { kcal: 90, carbs: 9, protein: 2.3, fat: 5, fibre: 2.8 }, checked: false },
  { id: "palak_paneer", name: "Palak paneer", aliases: ["saag paneer"], unit: "katori", unitGrams: K, per100g: { kcal: 150, carbs: 6, protein: 7.5, fat: 11, fibre: 2 }, checked: false },
  { id: "paneer_butter_masala", name: "Paneer butter masala", aliases: ["paneer makhani", "shahi paneer", "paneer curry"], unit: "katori", unitGrams: K, per100g: { kcal: 230, carbs: 9, protein: 9, fat: 18, fibre: 1.5 }, checked: false },
  { id: "chicken_curry", name: "Chicken curry", aliases: ["chicken masala", "murgh curry"], unit: "katori", unitGrams: K, per100g: { kcal: 150, carbs: 4, protein: 15, fat: 8.5, fibre: 0.8 }, checked: false },
  { id: "egg_curry", name: "Egg curry", aliases: ["anda curry"], unit: "katori", unitGrams: K, per100g: { kcal: 140, carbs: 5, protein: 9, fat: 9.5, fibre: 1 }, checked: false },
  { id: "fish_curry", name: "Fish curry", aliases: ["machli", "macher jhol"], unit: "katori", unitGrams: K, per100g: { kcal: 120, carbs: 3.5, protein: 14, fat: 6, fibre: 0.5 }, checked: false },
  { id: "curd", name: "Curd / dahi", aliases: ["dahi", "yogurt", "thayir"], unit: "katori", unitGrams: 150, per100g: { kcal: 60, carbs: 4.7, protein: 3.1, fat: 3.3, fibre: 0 }, checked: false },
  { id: "raita", name: "Raita", aliases: ["boondi raita", "cucumber raita"], unit: "katori", unitGrams: 150, per100g: { kcal: 55, carbs: 5, protein: 2.8, fat: 2.6, fibre: 0.5 }, checked: false },
  { id: "dhokla", name: "Dhokla", aliases: ["khaman"], unit: "piece", unitGrams: 30, per100g: { kcal: 160, carbs: 24, protein: 6, fat: 4.5, fibre: 1.5 }, checked: false },
  { id: "salad", name: "Salad (cucumber/onion/tomato)", aliases: ["kachumber", "salad"], unit: "katori", unitGrams: 100, per100g: { kcal: 20, carbs: 4, protein: 1, fat: 0.2, fibre: 1.5 }, checked: false },
  { id: "gulab_jamun", name: "Gulab jamun", aliases: ["jamun"], unit: "piece", unitGrams: 40, per100g: { kcal: 320, carbs: 52, protein: 5, fat: 11, fibre: 0.5 }, checked: false },
];

export const DISH_BY_ID: Record<string, Dish> = Object.fromEntries(DISHES.map((d) => [d.id, d]));

const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

/** Map a free-text dish name (e.g. from Claude) to a dish in the table. Returns null if no match. */
export function matchDish(name: string): Dish | null {
  const n = norm(name);
  if (!n) return null;
  for (const d of DISHES) {
    if (norm(d.name) === n || d.aliases.some((a) => norm(a) === n) || d.id.replace(/_/g, " ") === n) return d;
  }
  // Partial match: longest alias contained in the name
  let best: { d: Dish; len: number } | null = null;
  for (const d of DISHES) {
    for (const a of [d.name, ...d.aliases]) {
      const na = norm(a);
      if (na.length >= 3 && (n.includes(na) || na.includes(n)) && (!best || na.length > best.len)) best = { d, len: na.length };
    }
  }
  return best?.d ?? null;
}

export function nutritionFor(dishId: string, portion: number) {
  const d = DISH_BY_ID[dishId];
  if (!d) return { grams: 0, kcal: 0, carbs: 0, protein: 0, fat: 0, fibre: 0 };
  const grams = d.unitGrams * portion;
  const f = grams / 100;
  return {
    grams: Math.round(grams),
    kcal: Math.round(d.per100g.kcal * f),
    carbs: Math.round(d.per100g.carbs * f),
    protein: Math.round(d.per100g.protein * f),
    fat: Math.round(d.per100g.fat * f),
    fibre: Math.round(d.per100g.fibre * f * 10) / 10,
  };
}

export const PORTIONS: { value: number; label: string }[] = [
  { value: 0.5, label: "½" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
];
