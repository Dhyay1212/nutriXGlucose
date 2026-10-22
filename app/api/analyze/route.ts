import { NextResponse } from "next/server";
import { DISHES, DISH_BY_ID, EVERYDAY, REFERENCE, matchDish } from "@/lib/dishes";
import { callClaude, extractJson, hasClaude, redact } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `You identify every food and drink in a meal photo. Most photos are Indian / South Asian home meals, but any cuisine counts (pizza, pasta, burgers, Chinese, desserts, packaged snacks…).
Return ONLY JSON in this shape:
{"dishes":[{"name":string,"dish_id":string|null,"portion":number,"unit":"katori"|"piece"|"glass"|"cup"|"serving","confidence":number}],"notes":string}

Rules:
- List every separate dish you can see (thalis often have 4-6). Include small sides like raita, curd, salad, pickle is optional.
- Prefer a dish_id from these lists when the dish matches; otherwise dish_id = null and give your best common name.
Everyday dishes (prefer these for home-style plates):
${EVERYDAY.map((d) => `${d.id} = ${d.name} [${d.unit}${d.unitGrams ? `, 1 ≈ ${d.unitGrams} g` : ""}]`).join("\n")}
More common dishes (snacks, sweets, restaurant food):
${REFERENCE.map((d) => `${d.id} = ${d.name.replace(" (reference)", "")} [${d.unit}]`).join("\n")}
If a dish is in neither list, set dish_id = null and give its usual name (e.g. "Pizza", "Pasta", "Veg burger"); the app searches its full database of 1,100+ dishes.
- portion: count of the dish's unit — katoris (standard bowl) for dals, curries, rice and sabzi in 0.5 steps; pieces for roti, dosa, idli, paratha, thepla, dhokla; glasses or cups for drinks; servings otherwise.
- confidence: 0 to 1 for the dish identity.
- Do not estimate calories or nutrients. Do not give health advice.
- Only if there is no food or drink in the image at all, return {"dishes":[],"notes":"no food found in this photo"}.`;

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
    const { image, detector } = (await req.json()) as { image?: string; detector?: Detector };
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
      system: SYSTEM,
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

// Map Claude's names onto the NutriX dish table (nutrition is looked up by script, never by the AI).
function normalise(r: any) {
  const dishes = (r.dishes ?? []).map((d: any) => {
    const byId = DISHES.find((x) => x.id === d.dish_id);
    const m = byId ?? matchDish(String(d.name ?? ""));
    return {
      aiName: String(d.name ?? ""),
      dishId: m?.id ?? null,
      name: m?.name ?? String(d.name ?? "Unknown"),
      portion: clampPortion(Number(d.portion) || 1, m?.unit ?? String(d.unit ?? "katori")),
      confidence: Math.max(0, Math.min(1, Number(d.confidence) || 0.5)),
      matched: !!m,
      via: r.demo ? "demo" : "ai",
    };
  });
  return { demo: !!r.demo, notes: r.notes ?? "", dishes };
}

function clampPortion(p: number, unit: string) {
  if (unit === "piece") return Math.max(1, Math.min(6, Math.round(p)));
  return Math.max(0.5, Math.min(3, Math.round(p * 2) / 2));
}
