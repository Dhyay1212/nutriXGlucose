"use client";
// NutriX YOLOv8n food detector, running in the browser with onnxruntime-web.
// Model: public/models/nutrix-yolov8n.onnx (exported from model/best.pt, 123 classes, 640x640 input).
// The photo never leaves the device for this step.
import { YOLO_CLASSES, YOLO_TO_DISH } from "./yolo-classes";

const MODEL_URL = "/models/nutrix-yolov8n.onnx";
const SIZE = 640;

export interface Detection {
  cls: number;
  label: string; // YOLO class name
  dishId: string | null; // mapped NutriX dish, if this class is a dish
  score: number;
  box: [number, number, number, number]; // x1, y1, x2, y2 in original image pixels
}

let sessionPromise: Promise<{ ort: any; session: any }> | null = null;

function load() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort: any = await import("onnxruntime-web/wasm");
      ort.env.wasm.wasmPaths = "/ort/"; // copied from node_modules/onnxruntime-web/dist (v1.29.0)
      ort.env.wasm.numThreads = 1;
      const session = await ort.InferenceSession.create(MODEL_URL, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
      return { ort, session };
    })();
    sessionPromise.catch(() => (sessionPromise = null));
  }
  return sessionPromise;
}

/** Start downloading the model early (e.g. when the log page opens). */
export function preloadYolo() {
  load().catch(() => {});
}

function letterbox(img: HTMLImageElement) {
  const scale = Math.min(SIZE / img.width, SIZE / img.height);
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const padX = Math.floor((SIZE - w) / 2), padY = Math.floor((SIZE - h) / 2);
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "rgb(114,114,114)";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.drawImage(img, padX, padY, w, h);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
  const area = SIZE * SIZE;
  const t = new Float32Array(3 * area);
  for (let i = 0; i < area; i++) {
    t[i] = data[i * 4] / 255;
    t[area + i] = data[i * 4 + 1] / 255;
    t[2 * area + i] = data[i * 4 + 2] / 255;
  }
  return { tensor: t, scale, padX, padY };
}

const iou = (a: number[], b: number[]) => {
  const x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]), x2 = Math.min(a[2], b[2]), y2 = Math.min(a[3], b[3]);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter;
  return u > 0 ? inter / u : 0;
};

/** Run the detector on a data-URL image. Returns detections after NMS, best first. */
export async function detect(dataUrl: string, minScore = 0.25): Promise<Detection[]> {
  const { ort, session } = await load();
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Could not read image"));
    i.src = dataUrl;
  });
  const { tensor, scale, padX, padY } = letterbox(img);
  const input = new ort.Tensor("float32", tensor, [1, 3, SIZE, SIZE]);
  const out = await session.run({ [session.inputNames[0]]: input });
  const o = out[session.outputNames[0]];
  const [, rows, n] = o.dims as number[]; // [1, 4 + classes, anchors]
  const d = o.data as Float32Array;
  const nc = rows - 4;

  const cands: { cls: number; score: number; box: number[] }[] = [];
  for (let a = 0; a < n; a++) {
    let best = 0, cls = -1;
    for (let c = 0; c < nc; c++) {
      const s = d[(4 + c) * n + a];
      if (s > best) { best = s; cls = c; }
    }
    if (best < minScore) continue;
    const cx = d[a], cy = d[n + a], w = d[2 * n + a], h = d[3 * n + a];
    const x1 = (cx - w / 2 - padX) / scale, y1 = (cy - h / 2 - padY) / scale;
    const x2 = (cx + w / 2 - padX) / scale, y2 = (cy + h / 2 - padY) / scale;
    cands.push({ cls, score: best, box: [x1, y1, x2, y2] });
  }
  cands.sort((x, y) => y.score - x.score);
  const kept: typeof cands = [];
  for (const c of cands) {
    if (kept.some((k) => k.cls === c.cls && iou(k.box, c.box) > 0.45)) continue;
    kept.push(c);
    if (kept.length >= 50) break;
  }
  return kept.map((k) => {
    const label = YOLO_CLASSES[k.cls] ?? `class_${k.cls}`;
    return { cls: k.cls, label, dishId: YOLO_TO_DISH[label] ?? null, score: Math.round(k.score * 100) / 100, box: k.box as Detection["box"] };
  });
}

/** One entry per detected dish (best score, how many boxes). Raw ingredients are listed separately. */
export function summarise(dets: Detection[]) {
  const dishes = new Map<string, { dishId: string; label: string; score: number; count: number }>();
  const ingredients = new Map<string, number>();
  for (const x of dets) {
    if (x.dishId) {
      const e = dishes.get(x.dishId);
      if (e) { e.count++; e.score = Math.max(e.score, x.score); }
      else dishes.set(x.dishId, { dishId: x.dishId, label: x.label, score: x.score, count: 1 });
    } else ingredients.set(x.label, Math.max(ingredients.get(x.label) ?? 0, x.score));
  }
  return {
    dishes: [...dishes.values()].sort((a, b) => b.score - a.score),
    ingredients: [...ingredients.entries()].map(([label, score]) => ({ label, score })).sort((a, b) => b.score - a.score),
  };
}
