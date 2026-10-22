// Offline parser for typed or spoken meals: "2 roti, 1 katori dal and half plate rice, chai".
// Used when there is no AI key or no network. Handles digits, fractions, English and common Hindi number words.
import { DISH_BY_ID, fuzzyMatch, matchDish, PORTION_OPTIONS, searchDishes, type Dish } from "./dishes";

export interface ParsedItem { text: string; name: string; dishId: string | null; portion: number }

const NUM_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, ek: 1, single: 1, two: 2, do: 2, couple: 2, three: 3, teen: 3, four: 4, char: 4, chaar: 4,
  five: 5, paanch: 5, panch: 5, six: 6, chhe: 6, half: 0.5, aadha: 0.5, adha: 0.5, dedh: 1.5, dhai: 2.5, quarter: 0.25,
};
const UNIT_WORDS = /\b(katoris?|katori|bowls?|vatis?|wati|cups?|glass(es)?|plates?|pieces?|pcs|pc|nos?|slices?|servings?|spoons?|tbsp|tsp|handful|small|medium|large|big|full)\b/g;
const FILLER = /\b(i|had|ate|have|eaten|drank|for|my|of|some|with|plus|then|also|today|breakfast|lunch|dinner|snack)\b/g;

function readQty(s: string): { qty: number | null; rest: string } {
  let t = s.trim().toLowerCase().replace(/½/g, " 0.5 ").replace(/¼/g, " 0.25 ").replace(/¾/g, " 0.75 ");
  // "1 1/2", "1/2", "1.5", "2x"
  let m = t.match(/^(\d+)\s+(\d)\/(\d)\b/);
  if (m) return { qty: Number(m[1]) + Number(m[2]) / Number(m[3]), rest: t.slice(m[0].length) };
  m = t.match(/^(\d)\/(\d)\b/);
  if (m) return { qty: Number(m[1]) / Number(m[2]), rest: t.slice(m[0].length) };
  m = t.match(/^(\d+(?:\.\d+)?)\s*x?\b/);
  if (m) return { qty: Number(m[1]), rest: t.slice(m[0].length) };
  m = t.match(/^([a-z]+)\b/);
  if (m && NUM_WORDS[m[1]] != null) {
    let q = NUM_WORDS[m[1]];
    let rest = t.slice(m[0].length).trim();
    const and = rest.match(/^and a half\b/);
    if (and) { q += 0.5; rest = rest.slice(and[0].length); }
    return { qty: q, rest };
  }
  // trailing quantity: "roti x2", "dal 1 katori"
  m = t.match(/\b(\d+(?:\.\d+)?)\s*(x|katoris?|bowls?|pieces?|pcs|cups?|glass(es)?)?\s*$/);
  if (m) return { qty: Number(m[1]), rest: t.slice(0, m.index) };
  return { qty: null, rest: t };
}

function findDish(name: string): Dish | null {
  if (!name) return null;
  return matchDish(name) ?? fuzzyMatch(name) ?? (name.length >= 3 ? searchDishes(name, 1)[0] ?? null : null);
}

const ADDINS = /^(milk|sugar|ghee|butter|cheese|honey|lemon|salt|jaggery|gur|cream|ice|oil|masala|spices?|toppings?)$/;
const clean = (s: string) => readQty(s.toLowerCase()).rest.replace(UNIT_WORDS, " ").replace(FILLER, " ").replace(/[^a-z\s-]/g, " ").replace(/\s+/g, " ").trim();
const nearest = (v: number, xs: number[]) => xs.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

export function parseMealText(text: string): ParsedItem[] {
  const parts = text
    .replace(/\n/g, ",")
    .split(/,|;|\+|&|\band\b(?! a half)|\baur\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
  // "masala dosa with sambar" → two dishes; "tea with milk" stays one (milk is an add-in)
  const split: string[] = [];
  for (const p of parts) {
    const w = p.split(/\bwith\b/i).map((x) => x.trim()).filter(Boolean);
    if (w.length > 1 && !w.slice(1).some((x) => ADDINS.test(clean(x))) && w.every((x) => findDish(clean(x)))) split.push(...w);
    else split.push(p);
  }
  const out: ParsedItem[] = [];
  for (const raw0 of split) {
    const raw = raw0.toLowerCase().replace(/^(\s*\b(i|had|ate|have|eaten|drank|also|then|plus)\b)+/g, "").trim();
    const { qty, rest } = readQty(raw);
    const plate = /\bplates?\b/.test(rest);
    const name = rest.replace(UNIT_WORDS, " ").replace(FILLER, " ").replace(/[^a-z\s-]/g, " ").replace(/\s+/g, " ").trim();
    if (!name) continue;
    const d = findDish(name);
    let portion = qty ?? 1;
    if (d && plate && d.unit === "katori") portion *= 1.5; // a plate of rice/poha ≈ 1½ katori
    if (d) portion = nearest(Math.max(0.5, portion), PORTION_OPTIONS[d.unit]);
    out.push({ text: raw, name: d?.name ?? name, dishId: d && DISH_BY_ID[d.id] ? d.id : null, portion });
  }
  return out;
}
