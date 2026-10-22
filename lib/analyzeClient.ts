"use client";
// Client side of meal analysis: photo (detector + AI) or text/voice (AI, or the offline parser when there is no network).
import { registerDish } from "./dishes";
import { detect, summarise } from "./yolo";
import { resizeImage } from "./image";
import { parseMealText } from "./parseMeal";
import { uid } from "./store";
import type { MealItem } from "./types";

export interface Draft extends MealItem { key: string; matched: boolean; via?: string; note?: string }
export interface Analysis { items: Draft[]; demo: boolean; notes: string; detInfo?: string | null; photo?: string; thumb?: string }

export const blankDraft = (): Draft => ({ key: uid(), dishId: "", name: "", portion: 1, matched: false });
export const toDrafts = (items: MealItem[]): Draft[] =>
  items.map((i) => ({ key: uid(), dishId: i.dishId, name: i.name, portion: i.portion, matched: true, custom: i.custom }));

function fromResponse(data: any): Draft[] {
  for (const d of data.dishes) if (d.custom) registerDish(d.custom);
  const list: Draft[] = data.dishes.map((d: any) => ({
    key: uid(), dishId: d.dishId ?? "", name: d.name, aiName: d.aiName, portion: d.portion, confidence: d.confidence,
    matched: d.matched, custom: d.custom, note: d.note, via: d.via,
  }));
  return list.length ? list : [blankDraft()];
}

export async function analyzePhoto(f: File, status: (s: string) => void): Promise<Analysis> {
  status("Reading photo…");
  const [big, small] = await Promise.all([resizeImage(f, 1024, 0.8), resizeImage(f, 320, 0.7)]);
  status("Running the NutriX detector on your phone…");
  let detector: ReturnType<typeof summarise> | null = null;
  let detInfo: string | null = null;
  try {
    const t0 = performance.now();
    detector = summarise(await detect(big));
    const ms = Math.round(performance.now() - t0);
    detInfo = detector.dishes.length || detector.ingredients.length
      ? `Detector (${ms} ms): ${[...detector.dishes.map((d) => `${d.label} ${Math.round(d.score * 100)}%`), ...detector.ingredients.slice(0, 4).map((i) => `${i.label} ${Math.round(i.score * 100)}%`)].join(", ")}`
      : `Detector (${ms} ms): nothing recognised`;
  } catch (e) {
    console.warn("YOLO detector failed", e);
    detInfo = "Detector unavailable on this device; using AI only.";
  }
  status("Finding dishes…");
  const res = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image: big, detector }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Analysis failed");
  return { items: fromResponse(data), demo: !!data.demo, notes: data.notes || "", detInfo, photo: big, thumb: small };
}

export async function analyzeText(text: string, status: (s: string) => void): Promise<Analysis> {
  status("Finding dishes…");
  try {
    const res = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Analysis failed");
    return { items: fromResponse(data), demo: false, notes: data.notes || "" };
  } catch (e) {
    if (typeof navigator !== "undefined" && navigator.onLine) throw e;
    // Offline: match on the phone.
    const items = parseMealText(text);
    return {
      items: items.length
        ? items.map((i) => ({ key: uid(), dishId: i.dishId ?? "", name: i.name, aiName: i.text, portion: i.portion, matched: !!i.dishId, via: "text" }))
        : [blankDraft()],
      demo: false,
      notes: "You're offline, so dishes were matched on your phone. Check them below.",
    };
  }
}
