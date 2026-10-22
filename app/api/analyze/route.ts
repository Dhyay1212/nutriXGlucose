import { NextResponse } from "next/server";
import { DISHES, DISH_BY_ID, EVERYDAY, REFERENCE, matchDish, type Dish, type Unit } from "@/lib/dishes";
import { callClaude, extractJson, hasClaude, redact } from "@/lib/claude";
import { parseMealText } from "@/lib/parseMeal";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = (mode: "photo" | "text") => `${mode === "text"
  ? `You turn a person's typed or spoken description of a meal (English, Hindi or Hinglish; speech-to-text may have spelling mistakes) into a list of foods. Use the quantities they state; if none, assume one usual portion.`
  : `You identify every food and drink in a meal photo.`} Most meals are Indian / South Asian home meals, but any cuisine counts (pizza, pasta, burgers, Chinese, desserts, packaged snacks…).
Return ONLY JSON in this shape:
{"dishes":[{"name":string,"dish_id":string|null,"portion":number,"unit":"katori"|"piece"|"glass"|"cup"|"serving","confidence":number,
  "est":{"grams":number,"kcal":number,"carbs":number,"protein":number,"fat":number,"fibre":number,
         "sugar":number,"sat_fat":number,"cholesterol_mg":number,"sodium_mg":number,"potassium_mg":number,"calcium_mg":number,
         "iron_mg":number,"magnesium_mg":number,"vit_a_ug":number,"vit_c_mg":number,"folate_ug":number}}],"notes":string}

Rules:
- List every separate dish ${mode === "text" ? "mentioned" : "you can see (thalis often have 4-6). Include small sides like raita, curd and salad"}.
- Toppings, garnishes and seasonings belong to their dish: a pizza with cheese and chilli flakes is ONE item "Pizza"; do not list cheese, herbs, chilli flakes, oregano, ketchup or coriander separately. Pickle and papad only if clearly a side.
- Prefer a dish_id from these lists when the dish matches; otherwise dish_id = null and give your best common name.
Everyday dishes (prefer these for home-style plates):
${EVERYDAY.map((d) => `${d.id} = ${d.name} [${d.unit}${d.unitGrams ? `, 1 ≈ ${d.unitGrams} g` : ""}]`).join("\n")}
More common dishes (snacks, sweets, restaurant food):
${REFERENCE.map((d) => `${d.id} = ${d.name.replace(" (reference)", "")} [${d.unit}]`).join("\n")}
If a dish is in neither list, set dish_id = null and give its usual name (e.g. "Pizza", "Pasta", "Veg burger"); the app searches its full database of 1,100+ dishes.
- portion: count of the dish's unit — katoris (standard bowl) for dals, curries, rice and sabzi in 0.5 steps; pieces for roti, dosa, idli, paratha, thepla, dhokla; glasses or cups for drinks; servings otherwise.
- confidence: 0 to 1 for the dish identity.
- est: ALWAYS include it. Your best estimate for the WHOLE amount of that dish ${mode === "text" ? "described (all pieces/katoris together)" : "visible in the photo"}: total grams on the plate and the nutrition of that whole amount (typical home/restaurant recipe). A whole medium pizza is ~500-700 g; one roti ~40 g; a katori of dal ~180 g. Account for visible oil, ghee, cheese and sugar. These numbers are shown to the user as your estimate.
- Do not give health advice.
- Only if there is no food or drink ${mode === "text" ? "in the text" : "in the image"} at all, return {"dishes":[],"notes":"no food found"}.`;

const DEMO = {
  demo: true,
  dishes: [
    { name: "Plain rice", dish_id: "plain_rice", portion: 1, unit: "katori", confidence: 0.92 },
    { name: "Dal tadka", dish_id: "toor_dal", portion: 1, unit: "katori", confidence: 0.88 },
    { name: "Roti", dish_id: "roti", portion: 2, unit: "piece", confidence: 0.95 },
    { name: "Bhindi sabzi", dish_id: "bhindi", portion: 0.5, unit: "katori", confidence: 0.71 },
    { name: "Raita", dish_id: "cucumber_raita", portion: 0.5, unit: "katori", confidence: 0.64 },
  ],
  notes: "Demo mode: no AI key set (OPENROUTER_API_KEY or ANTHROPIC_API_KEY), so this is a sample thali.",
};

type DetDish = { dishId: string; label: string; score: number; count: number };
type Detector = { dishes?: DetDish[]; ingredients?: { label: string; score: number }[] };
const DET_MIN = 0.35;

export async function POST(req: Request) {
  try {
    const { image, detector, text: said } = (await req.json()) as { image?: string; detector?: Detector; text?: string };
    if (typeof said === "string") return NextResponse.json(await fromText(said.slice(0, 600)));
    if (!image?.startsWith("data:image/")) return NextResponse.json({ error: "Send a data:image/... URL" }, { status: 400 });
    const det = (detector?.dishes ?? []).filter((d) => d.score >= DET_MIN && DISH_BY_ID[d.dishId]);

    if (!hasClaude()) {
      // No AI key: use the on-device NutriX detector. If it found nothing, say so (never a fake sample plate).
      if (det.length || detector) return NextResponse.json(fromDetector(det, detector));
      return NextResponse.json(normalise(DEMO)); // detector could not run on this device
    }

    const [meta, b64] = image.split(",");
    const mediaType = meta.slice(5, meta.indexOf(";"));
    const text = await callClaude({
      system: SYSTEM("photo"),
      maxTokens: 1000,
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } },
        {
          type: "text",
          text:
            (det.length
              ? `An on-device detector suggests (it can be wrong or miss dishes): ${det.map((d) => `${d.dishId} ${Math.round(d.score * 100)}%`).join(", ")}. Use it as a hint only.\n`
              : "") + "Identify each dish and its portion. JSON only.",
        },
      ],
    });
    return NextResponse.json(normalise(extractJson(text)));
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: redact(String(e?.message ?? "Analysis failed")) }, { status: 500 });
  }
}

async function fromText(said: string) {
  if (!said.trim()) throw new Error("Type or say what you ate.");
  if (hasClaude()) {
    try {
      const reply = await callClaude({ system: SYSTEM("text"), maxTokens: 1000, content: [{ type: "text", text: `Meal: ${said}\nJSON only.` }] });
      const r = normalise(extractJson(reply));
      return { ...r, dishes: r.dishes.map((d: any) => ({ ...d, via: "text" })) };
    } catch (e) {
      console.warn("AI text parse failed, using the offline parser", e);
    }
  }
  return fromParsed(said);
}
function fromParsed(said: string) {
  const items = parseMealText(said);
  return {
    demo: false,
    notes: items.some((i) => !i.dishId) ? "Matched offline against the INDB dish list. Pick the closest dish for anything not found." : "Matched offline against the INDB dish list.",
    dishes: items.map((i) => ({ aiName: i.text, dishId: i.dishId, name: i.name, portion: i.portion, confidence: i.dishId ? 0.8 : 0.3, matched: !!i.dishId, via: "text" })),
  };
}

function fromDetector(det: DetDish[], detector?: Detector) {
  const dishes = det.map((d) => {
    const dish = DISH_BY_ID[d.dishId];
    return {
      aiName: d.label,
      dishId: dish.id,
      name: dish.name,
      portion: dish.unit === "piece" ? Math.min(4, Math.max(1, d.count)) : 1,
      confidence: d.score,
      matched: true,
      via: "detector",
    };
  });
  const ing = (detector?.ingredients ?? []).filter((i) => i.score >= DET_MIN).map((i) => i.label);
  const seen = ing.length ? ` Ingredients seen: ${ing.join(", ")}.` : "";
  return {
    demo: false,
    detector: true,
    notes: dishes.length
      ? "Found by the NutriX detector on your phone. It knows 32 Indian dishes, so add anything it missed." + seen
      : "The NutriX detector didn't recognise a dish it knows (it covers 32 Indian dishes such as dosa, idli, dal, chole, biryani and samosa). Search for what you ate below." + seen,
    dishes,
  };
}

// Map the AI's names onto the NutriX dish table (database nutrition first).
// The AI's whole-portion estimate is used to (1) size the portion from grams and (2) catch database rows that
// are clearly off (carbs per gram more than 2x different). Only then, or when a dish isn't in the table,
// the AI estimate is used, clearly labelled.
const UNITS: Unit[] = ["katori", "piece", "glass", "cup", "serving"];
const num = (v: any, max: number) => Math.max(0, Math.min(max, Math.round((Number(v) || 0) * 10) / 10));
type Est = { grams: number; kcal: number; carbs: number; protein: number; fat: number; fibre: number; micros: Record<string, number> };
const EST_MICROS: [string, string, number][] = [
  ["sugar", "sugar", 500], ["satfat", "sat_fat", 200], ["cholesterol", "cholesterol_mg", 3000], ["sodium", "sodium_mg", 20000],
  ["potassium", "potassium_mg", 20000], ["calcium", "calcium_mg", 10000], ["iron", "iron_mg", 200], ["magnesium", "magnesium_mg", 5000],
  ["vitA", "vit_a_ug", 20000], ["vitC", "vit_c_mg", 2000], ["folate", "folate_ug", 5000],
];
function readEst(d: any): Est | null {
  const e = d.est;
  if (!e) return null;
  const micros: Record<string, number> = {};
  for (const [key, field, max] of EST_MICROS) if (e[field] != null && !Number.isNaN(Number(e[field]))) micros[key] = num(e[field], max);
  const est = { grams: num(e.grams ?? e.grams_per_unit, 5000), kcal: num(e.kcal, 5000), carbs: num(e.carbs, 800), protein: num(e.protein, 300), fat: num(e.fat, 300), fibre: num(e.fibre, 80), micros };
  return est.kcal || est.carbs ? est : null;
}
function aiDish(name: string, est: Est, ref: Dish | null): Dish {
  return {
    id: "ai_" + name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40) + "_" + Math.round(est.grams),
    name,
    aliases: ref ? [ref.name, ...ref.aliases] : [], // keeps the INDB dish type for the GI category
    unit: "serving",
    unitGrams: est.grams || null,
    perUnit: { kcal: est.kcal, carbs: est.carbs, protein: est.protein, fat: est.fat, fibre: est.fibre, sugar: est.micros.sugar ?? null },
    micros: est.micros,
    source: "AI estimate",
    sourceCode: ref ? (ref.source === "INDB" ? `INDB ${ref.sourceCode}` : ref.name) : "AI",
    sourceName: ref ? ref.sourceName : name,
    cuisine: "AI estimate",
    checked: false,
  };
}
const STEPS: Record<Unit, number[]> = { katori: [0.5, 1, 1.5, 2, 2.5, 3], piece: [1, 2, 3, 4, 5, 6], glass: [0.5, 1, 2], cup: [0.5, 1, 2], serving: [0.5, 1, 1.5, 2, 3, 4, 5, 6] };
const nearest = (v: number, xs: number[]) => xs.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

// Policy: INDB gives the dish (name, type, GI category); the AI gives the numbers for the portion it sees.
// Without an AI estimate, INDB values are used for the portion the AI counted.
function normalise(r: any) {
  const dishes = (r.dishes ?? []).map((d: any) => {
    const aiName = String(d.name ?? "").trim();
    const byId = DISHES.find((x) => x.id === d.dish_id);
    const m = byId ?? matchDish(aiName);
    const est = readEst(d);
    let dish: Dish | null = m;
    let custom: Dish | null = null;
    let portion = Number(d.portion) || 1;
    let note: string | undefined;

    if (est && est.grams > 0) {
      custom = aiDish(m?.name ?? aiName, est, m);
      dish = custom;
      portion = 1;
      if (m?.unitGrams) {
        const dbCarbs = Math.round((m.perUnit.carbs / m.unitGrams) * est.grams);
        note = `AI estimate for ~${Math.round(est.grams)} g. INDB match: ${m.name}${m.source === "INDB" ? ` (${m.sourceCode})` : ""} would give ${dbCarbs} g carbs for the same weight.`;
      } else if (m) {
        note = `AI estimate for ~${Math.round(est.grams)} g. INDB match: ${m.name}.`;
      } else {
        note = `AI estimate for ~${Math.round(est.grams)} g. No INDB match.`;
      }
    }
    const unit = dish?.unit ?? (UNITS.includes(d.unit) ? d.unit : "katori");
    return {
      aiName,
      dishId: dish?.id ?? null,
      name: dish?.name ?? aiName ?? "Unknown",
      portion: nearest(Math.max(0.5, portion), STEPS[unit as Unit]),
      confidence: Math.max(0, Math.min(1, Number(d.confidence) || 0.5)),
      matched: !!dish,
      custom: custom ?? undefined,
      note,
      via: r.demo ? "demo" : "ai",
    };
  });
  return { demo: !!r.demo, notes: r.notes ?? "", dishes };
}

function clampPortion(p: number, unit: string) {
  if (unit === "piece") return Math.max(1, Math.min(6, Math.round(p)));
  return Math.max(0.5, Math.min(3, Math.round(p * 2) / 2));
}
