"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import UserProvider, { useUser } from "@/components/UserProvider";
import { DISH_BY_ID, PORTION_OPTIONS, UNIT_LABEL, nutritionFor, sourceLabel } from "@/lib/dishes";
import DishPicker from "@/components/DishPicker";
import { detect, preloadYolo, summarise } from "@/lib/yolo";
import { resizeImage } from "@/lib/image";
import { saveMeal, uid } from "@/lib/store";
import { fromLocalInput, toLocalInput } from "@/lib/format";
import type { MealItem } from "@/lib/types";

export default function Page() {
  return <UserProvider><LogMeal /></UserProvider>;
}

interface Draft extends MealItem { key: string; matched: boolean; via?: string }


function LogMeal() {
  const { user } = useUser();
  const router = useRouter();
  const started = useRef(Date.now());
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [items, setItems] = useState<Draft[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [aiNote, setAiNote] = useState("");
  const [when, setWhen] = useState(toLocalInput());

  const [detInfo, setDetInfo] = useState<string | null>(null);
  useEffect(() => { started.current = Date.now(); preloadYolo(); }, []);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setErr(null);
    setItems(null);
    setDetInfo(null);
    try {
      setBusy("Reading photo…");
      const [big, small] = await Promise.all([resizeImage(f, 1024, 0.8), resizeImage(f, 320, 0.7)]);
      setPhoto(big);
      setThumb(small);
      setBusy("Running the NutriX detector on your phone…");
      let detector: ReturnType<typeof summarise> | null = null;
      try {
        const t0 = performance.now();
        const dets = await detect(big);
        detector = summarise(dets);
        const ms = Math.round(performance.now() - t0);
        setDetInfo(detector.dishes.length || detector.ingredients.length
          ? `Detector (${ms} ms): ${[...detector.dishes.map((d) => `${d.label} ${Math.round(d.score * 100)}%`), ...detector.ingredients.slice(0, 4).map((i) => `${i.label} ${Math.round(i.score * 100)}%`)].join(", ")}`
          : `Detector (${ms} ms): nothing recognised`);
      } catch (e) {
        console.warn("YOLO detector failed", e);
        setDetInfo("Detector unavailable on this device; using AI only.");
      }
      setBusy("Finding dishes…");
      const res = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image: big, detector }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setDemo(!!data.demo);
      setAiNote(data.notes || "");
      const list: Draft[] = data.dishes.map((d: any) => ({
          key: uid(),
          dishId: d.dishId ?? "",
          name: d.name,
          aiName: d.aiName,
          portion: d.portion,
          confidence: d.confidence,
          matched: d.matched,
          via: d.via,
        }));
      setItems(list.length ? list : [{ key: uid(), dishId: "", name: "", portion: 1, matched: false }]);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  }

  const update = (key: string, patch: Partial<Draft>) => setItems((xs) => xs!.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const valid = (items ?? []).filter((i) => DISH_BY_ID[i.dishId]);
  const totals = valid.reduce(
    (a, it) => {
      const n = nutritionFor(it.dishId, it.portion);
      return { kcal: a.kcal + n.kcal, carbs: a.carbs + n.carbs, protein: a.protein + n.protein, fat: a.fat + n.fat, fibre: Math.round((a.fibre + n.fibre) * 10) / 10 };
    },
    { kcal: 0, carbs: 0, protein: 0, fat: 0, fibre: 0 }
  );

  async function save() {
    if (!user || !valid.length) return;
    setBusy("Saving…");
    try {
      await saveMeal({
        id: uid(),
        userId: user.id,
        eatenAt: fromLocalInput(when),
        items: valid.map(({ dishId, portion, aiName, confidence }) => ({ dishId, name: DISH_BY_ID[dishId].name, portion, aiName, confidence })),
        photo: thumb,
        totals,
        logSeconds: Math.round((Date.now() - started.current) / 1000),
        source: photo ? "photo" : "manual",
        createdAt: new Date().toISOString(),
      });
      router.push("/");
    } catch (e: any) {
      setErr(e.message);
      setBusy(null);
    }
  }

  return (
    <main className="wrap">
      <div className="card stack">
        <h1>Snap a meal</h1>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        {photo ? (
          <img className="preview" src={photo} alt="Your meal" onClick={() => fileRef.current?.click()} />
        ) : (
          <div className="drop" onClick={() => fileRef.current?.click()}>
            <div style={{ fontSize: "2rem" }}>📷</div>
            <b>Take or upload a photo of your plate</b>
            <span className="muted tiny">Thalis, dosa, roti-sabzi… we list each dish with a katori portion.</span>
          </div>
        )}
        {busy && <p className="muted">{busy}</p>}
        {err && <div className="card error">{err}</div>}
        {!items && !busy && (
          <button className="btn ghost" onClick={() => setItems([])}>Log without a photo</button>
        )}
      </div>

      {items && (
        <div className="card">
          <div className="row between">
            <h2 style={{ margin: 0 }}>Check the dishes</h2>
            {demo ? <span className="pill warn">demo result</span> : items.some((i) => i.via === "detector") ? <span className="pill">NutriX detector</span> : null}
          </div>
          <p className="muted tiny">Fix anything that's wrong, then save. Nutrition comes from the NutriX dish table (Indian Nutrient Databank), not the AI.</p>
          {aiNote && !demo && <p className="tiny muted">{aiNote}</p>}
          {detInfo && <p className="tiny muted">{detInfo}</p>}

          {items.map((it) => {
            const d = DISH_BY_ID[it.dishId];
            const opts = d ? PORTION_OPTIONS[d.unit] : [];
            const n = d ? nutritionFor(it.dishId, it.portion) : null;
            return (
              <div className="item" key={it.key}>
                <div>
                  <DishPicker value={it.dishId} fallbackName={it.aiName} onPick={(id) => {
                    const nd = DISH_BY_ID[id];
                    const allowed = nd ? PORTION_OPTIONS[nd.unit] : [1];
                    update(it.key, { dishId: id, name: nd?.name ?? it.name, matched: !!nd, portion: allowed.includes(it.portion) ? it.portion : 1 });
                  }} />
                  <div className="tiny muted" style={{ marginTop: 4 }}>
                    {it.aiName && <>{it.via === "detector" ? "Detector saw" : "AI saw"} “{it.aiName}”{it.confidence != null && ` · ${Math.round(it.confidence * 100)}% sure`} · </>}
                    {n && d ? <>{n.grams ? `${n.grams} g · ` : ""}{n.carbs} g carbs · {n.kcal} kcal · <span title={d.sourceName}>{sourceLabel(d)}</span></> : <span style={{ color: "var(--bad)" }}>Not in the NutriX table yet: pick the closest dish</span>}
                  </div>
                </div>
                <button className="btn danger small" onClick={() => setItems((xs) => xs!.filter((x) => x.key !== it.key))}>Remove</button>
                {d && (
                  <div className="controls">
                    <span className="tiny muted">{UNIT_LABEL[d.unit]}</span>
                    {opts.map((p) => (
                      <button key={p} className={"chip" + (it.portion === p ? " on" : "")} onClick={() => update(it.key, { portion: p })}>
                        {p === 0.5 ? "½" : p === 1.5 ? "1½" : p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <button className="btn ghost small" style={{ marginTop: 8 }} onClick={() => setItems((xs) => [...xs!, { key: uid(), dishId: "", name: "", portion: 1, matched: false }])}>+ Add a dish</button>

          <hr />
          <div className="stack">
            <label>When did you eat?<input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></label>
            <div className="stat-grid">
              <div className="stat"><b>{totals.carbs} g</b><span>carbs (estimate)</span></div>
              <div className="stat"><b>{totals.kcal}</b><span>kcal (estimate)</span></div>
              <div className="stat"><b>{totals.protein} g</b><span>protein</span></div>
              <div className="stat"><b>{totals.fibre} g</b><span>fibre</span></div>
            </div>
            <button className="btn" disabled={!valid.length || !!busy} onClick={save}>Save meal</button>
            <p className="tiny muted">Tip: add a glucose reading now (before eating) and about 2 hours after to see this meal's effect.</p>
          </div>
        </div>
      )}
    </main>
  );
}
