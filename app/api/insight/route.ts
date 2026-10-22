import { NextResponse } from "next/server";
import { callClaude, hasClaude } from "@/lib/claude";
import { MIN_INSTANCES, type DishStat } from "@/lib/glucose";

export const runtime = "nodejs";
export const maxDuration = 60;

const DISCLAIMER = "This is a pattern summary, not medical advice. Please discuss any changes with your diabetes educator or doctor.";

// Phrases the note must never contain (guardrails: no medical advice, no restrictive eating).
const BANNED = [
  /\binsulin\b/i, /\bmetformin\b/i, /\bmedicat/i, /\bdose\b/i, /\bdiagnos/i,
  /\bavoid\b/i, /\bstop eating\b/i, /\bcut out\b/i, /\beliminate\b/i, /\bnever eat\b/i, /\bskip (a |your )?meal/i,
  /\bfast(ing)?\b/i, /\bban\b/i, /\bbad food/i, /\bforbidden\b/i,
];

const SYSTEM = `You write a short weekly pattern note for a person with type 2 diabetes or prediabetes who logs Indian meals and glucose readings.
Their diabetes educator reviews the note before acting on it.

Hard rules:
1. Only talk about dishes listed under "Enough data". For dishes under "Not enough data", you may only say there is not enough data yet.
2. Glucose rise = highest reading within ~2 h after the meal minus the pre-meal reading. Rises are associations with whole mixed meals, not proof a dish caused them. Say so briefly.
3. No medical advice: never mention medicines, insulin, doses, diagnoses or targets.
4. Never suggest restrictive eating: do not tell them to avoid, cut out, skip or stop any food or meal, and no fasting. Suggest only ONE small, gentle, additive or swap-style change (e.g. add a katori of salad first, pair rice with more dal, a 10-minute walk after dinner, try ½ katori less rice with an extra katori of sabzi).
5. Plain, warm, simple English. Max 110 words. No headings, no lists except the final "Try next:" line.
Format:
<2-4 sentences on patterns>
Try next: <one small change>`;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      userName: string;
      stats: DishStat[];
      meals: number;
      mealsWithRise: number;
      readings: number;
    };
    const enough = body.stats.filter((s) => s.timesWithRise >= MIN_INSTANCES);
    const notEnough = body.stats.filter((s) => s.timesWithRise < MIN_INSTANCES);

    if (enough.length === 0) {
      return NextResponse.json({
        text: `Not enough data yet. This week has ${body.meals} meals logged and ${body.mealsWithRise} with both a pre-meal and a 2-hour reading. A dish needs at least ${MIN_INSTANCES} meals with readings before we describe a pattern. Keep logging and add a reading before and about 2 hours after meals.\n\n${DISCLAIMER}`,
        guarded: "insufficient_data",
      });
    }

    if (!hasClaude()) return NextResponse.json({ text: templateNote(enough, notEnough) + "\n\n" + DISCLAIMER, guarded: "demo" });

    const fmt = (s: DishStat) =>
      `- ${s.name}: ${s.timesWithRise} meals with readings, average rise ${s.avgRise} mg/dL (range ${s.minRise} to ${s.maxRise}), average meal carbs ${s.avgCarbsMeal} g`;
    const prompt = `Person: ${body.userName}
This week: ${body.meals} meals logged, ${body.mealsWithRise} with readings, ${body.readings} glucose readings.

Enough data (>= ${MIN_INSTANCES} meals with readings):
${enough.map(fmt).join("\n")}

Not enough data:
${notEnough.map((s) => `- ${s.name} (${s.timesWithRise})`).join("\n") || "- none"}`;

    let text = await callClaude({ system: SYSTEM, content: [{ type: "text", text: prompt }], maxTokens: 400 });
    let guarded = "ok";
    if (BANNED.some((re) => re.test(text))) {
      // Retry once with a stricter reminder, then fall back to a template.
      text = await callClaude({
        system: SYSTEM + "\nYour previous draft broke a hard rule. Rewrite with no restrictive or medical language.",
        content: [{ type: "text", text: prompt }],
        maxTokens: 400,
      });
      if (BANNED.some((re) => re.test(text))) {
        text = templateNote(enough, notEnough);
        guarded = "fallback_template";
      } else guarded = "rewritten";
    }
    return NextResponse.json({ text: text.trim() + "\n\n" + DISCLAIMER, guarded });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message ?? "Insight failed" }, { status: 500 });
  }
}

function templateNote(enough: DishStat[], notEnough: DishStat[]) {
  const sorted = [...enough].sort((a, b) => (b.avgRise ?? 0) - (a.avgRise ?? 0));
  const hi = sorted[0];
  const lo = sorted[sorted.length - 1];
  let t = `Meals with ${hi.name} were followed by the largest average rise this week (${hi.avgRise} mg/dL over ${hi.timesWithRise} meals).`;
  if (lo && lo !== hi) t += ` Meals with ${lo.name} had a smaller average rise (${lo.avgRise} mg/dL).`;
  t += " These are patterns across whole mixed meals, not proof that one dish caused a rise.";
  if (notEnough.length) t += ` Not enough data yet for: ${notEnough.map((s) => s.name).join(", ")}.`;
  t += `\nTry next: when you have ${hi.name}, start with a katori of salad or sabzi first and take a 10-minute walk after the meal, then compare the reading.`;
  return t;
}
