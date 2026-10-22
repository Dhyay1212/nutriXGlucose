import { NextResponse } from "next/server";
import { DISHES, matchDish } from "@/lib/dishes";
import { callClaude, extractJson, hasClaude } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `You identify dishes on Indian / South Asian meal plates from a photo.
Return ONLY JSON in this shape:
{"dishes":[{"name":string,"dish_id":string|null,"portion":number,"unit":"katori"|"piece","confidence":number}],"notes":string}

Rules:
- List every separate dish you can see (thalis often have 4-6). Include small sides like raita, curd, salad, pickle is optional.
- Prefer a dish_id from this list when the dish matches; otherwise dish_id = null and give your best common name:
${DISHES.map((d) => `${d.id} = ${d.name} (${d.unit}, 1 ${d.unit} ≈ ${d.unitGrams} g)`).join("\n")}
- portion: estimated count of standard katoris (180 g bowl) for curries, dals, rice and sabzi; count of pieces for roti, dosa, idli, paratha, thepla, dhokla, sweets. Use 0.5 steps for katoris.
- confidence: 0 to 1 for the dish identity.
- Do not estimate calories or nutrients. Do not give health advice.
- If the image is not food, return {"dishes":[],"notes":"not a meal photo"}.`;

const DEMO = {
  demo: true,
  dishes: [
    { name: "Plain rice", dish_id: "plain_rice", portion: 1, unit: "katori", confidence: 0.92 },
    { name: "Dal tadka", dish_id: "dal_tadka", portion: 1, unit: "katori", confidence: 0.88 },
    { name: "Roti", dish_id: "roti", portion: 2, unit: "piece", confidence: 0.95 },
    { name: "Bhindi sabzi", dish_id: "bhindi", portion: 0.5, unit: "katori", confidence: 0.71 },
    { name: "Raita", dish_id: "raita", portion: 0.5, unit: "katori", confidence: 0.64 },
  ],
  notes: "Demo mode: no ANTHROPIC_API_KEY set, so this is a sample thali.",
};

export async function POST(req: Request) {
  try {
    const { image } = (await req.json()) as { image?: string };
    if (!image?.startsWith("data:image/")) return NextResponse.json({ error: "Send a data:image/... URL" }, { status: 400 });

    if (!hasClaude()) return NextResponse.json(normalise(DEMO));

    const [meta, b64] = image.split(",");
    const mediaType = meta.slice(5, meta.indexOf(";"));
    const text = await callClaude({
      system: SYSTEM,
      maxTokens: 800,
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } },
        { type: "text", text: "Identify each dish and its portion. JSON only." },
      ],
    });
    return NextResponse.json(normalise(extractJson(text)));
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message ?? "Analysis failed" }, { status: 500 });
  }
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
      portion: clampPortion(Number(d.portion) || 1, m?.unit ?? d.unit),
      confidence: Math.max(0, Math.min(1, Number(d.confidence) || 0.5)),
      matched: !!m,
    };
  });
  return { demo: !!r.demo, notes: r.notes ?? "", dishes };
}

function clampPortion(p: number, unit: string) {
  if (unit === "piece") return Math.max(1, Math.min(6, Math.round(p)));
  return Math.max(0.5, Math.min(3, Math.round(p * 2) / 2));
}
