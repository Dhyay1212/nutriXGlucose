"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import UserProvider, { useUser } from "@/components/UserProvider";
import { DISH_BY_ID, nutritionFor, registerDish } from "@/lib/dishes";
import { listMeals, listReadings, saveMeal, uid } from "@/lib/store";
import { calibrate, type Calibration } from "@/lib/impact";
import MealInput, { type InputSource } from "@/components/MealInput";
import PlateEditor from "@/components/PlateEditor";
import ImpactCard from "@/components/ImpactCard";
import { blankDraft, toDrafts, type Analysis, type Draft } from "@/lib/analyzeClient";
import { listExperiments, TAG_BY_ID, TAGS, type Experiment } from "@/lib/tags";
import { fromLocalInput, toLocalInput } from "@/lib/format";
import type { MealItem } from "@/lib/types";

export default function Page() {
  return <UserProvider><LogMeal /></UserProvider>;
}

function LogMeal() {
  const { user } = useUser();
  const router = useRouter();
  const started = useRef(Date.now());
  const [source, setSource] = useState<InputSource | "manual">("manual");
  const [photo, setPhoto] = useState<string | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [items, setItems] = useState<Draft[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [aiNote, setAiNote] = useState("");
  const [when, setWhen] = useState(toLocalInput());

  const [detInfo, setDetInfo] = useState<string | null>(null);
  const [cal, setCal] = useState<Calibration | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [recent, setRecent] = useState<{ key: string; label: string; items: MealItem[] }[]>([]);
  const [exps, setExps] = useState<Experiment[]>([]);
  const toggleTag = (id: string) => setTags((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  useEffect(() => {
    started.current = Date.now();
    // Plate handed over from "Before you eat"
    try {
      const pre = sessionStorage.getItem("nxg_prefill");
      if (pre) {
        sessionStorage.removeItem("nxg_prefill");
        const xs: MealItem[] = JSON.parse(pre);
        for (const x of xs) if (x.custom) registerDish(x.custom);
        setItems(toDrafts(xs));
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (!user) return;
    Promise.all([listMeals(user.id), listReadings(user.id)]).then(([m, r]) => {
      setCal(calibrate(m, r));
      // Recent plates for one-tap re-logging (unique combinations, newest first)
      const seen = new Set<string>();
      const rec: { key: string; label: string; items: MealItem[] }[] = [];
      for (const meal of m) {
        const k = meal.items.map((i) => `${i.dishId}:${i.portion}`).sort().join("|");
        if (!k || seen.has(k)) continue;
        seen.add(k);
        rec.push({ key: k, label: meal.items.map((i) => i.name).join(" + "), items: meal.items });
        if (rec.length >= 6) break;
      }
      setRecent(rec);
    }).catch(() => {});
    const ex = listExperiments(user.id);
    setExps(ex);
    setTags((t) => [...new Set([...t, ...ex.map((e) => e.tagId)])]); // pre-tick changes the person is trying
  }, [user?.id]);

  function onResult(a: Analysis, src: InputSource) {
    setItems(a.items);
    setDemo(a.demo);
    setAiNote(a.notes);
    setDetInfo(a.detInfo ?? null);
    setPhoto(a.photo ?? null);
    setThumb(a.thumb ?? null);
    setSource(src);
  }

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
        items: valid.map(({ dishId, portion, aiName, confidence }) => {
          const d = DISH_BY_ID[dishId];
          return { dishId, name: d.name, portion, aiName, confidence, ...(d.source === "AI estimate" ? { custom: d } : {}) };
        }),
        photo: thumb,
        totals,
        logSeconds: Math.round((Date.now() - started.current) / 1000),
        source,
        tags,
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
        <div className="card-head" style={{ marginBottom: 0 }}>
          <h1 style={{ margin: 0 }}>Log a meal</h1>
          <Link href="/check" className="tiny">Before you eat? Check it →</Link>
        </div>
        <MealInput onResult={onResult} />
        {busy && <p className="muted">{busy}</p>}
        {err && <div className="card error">{err}</div>}
        {!items && (
          <button className="btn ghost" onClick={() => { setItems([blankDraft()]); setSource("manual"); }}>Search dishes instead</button>
        )}
        {!items && recent.length > 0 && (
          <div>
            <div className="tiny muted" style={{ marginBottom: 6 }}>Ate the same again? One tap:</div>
            <div className="chips">
              {recent.map((r) => (
                <button key={r.key} className="chip" style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  onClick={() => { setItems(toDrafts(r.items)); setSource("manual"); }}>
                  ↻ {r.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {items && (
        <PlateEditor items={items} setItems={(fn) => setItems((xs) => fn(xs ?? []))}
          badge={demo ? <span className="pill warn">demo result</span> : items.some((i) => i.via === "detector") ? <span className="pill">NutriX detector</span> : null}
          notes={[!demo ? aiNote : null, detInfo]} />
      )}

      {items && valid.length > 0 && (
        <ImpactCard items={valid} cal={cal} onUse={(xs) => setItems(toDrafts(xs))} />
      )}

      {items && (
        <div className="card">
          <div className="stack">
            <label>When did you eat?<input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></label>
            <div>
              <div className="tiny muted" style={{ marginBottom: 6 }}>Anything about this meal? (helps NutriX learn what changes your rise)</div>
              {exps.length > 0 && (
                <div className="tiny" style={{ marginBottom: 6, color: "var(--brand)" }}>
                  You’re trying: {exps.map((e) => `${TAG_BY_ID[e.tagId]?.icon} ${TAG_BY_ID[e.tagId]?.label}`).join(", ")}. Untick if you didn’t do it this time.
                </div>
              )}
              <div className="chips">
                {TAGS.map((t) => (
                  <button key={t.id} type="button" className={"chip" + (tags.includes(t.id) ? " on" : "")} onClick={() => toggleTag(t.id)}>{t.icon} {t.label}</button>
                ))}
              </div>
            </div>
            <div className="stat-grid">
              <div className="stat flat"><b>{totals.carbs} g</b><span>carbs</span></div>
              <div className="stat flat"><b>{totals.kcal}</b><span>kcal</span></div>
              <div className="stat flat"><b>{totals.protein} g</b><span>protein</span></div>
              <div className="stat flat"><b>{totals.fibre} g</b><span>fibre</span></div>
            </div>
            <button className="btn block" disabled={!valid.length || !!busy} onClick={save}>Save meal</button>
            <p className="tiny muted" style={{ margin: 0 }}>Tip: add a glucose reading now (before eating) and about 2 hours after to see this meal’s real effect.</p>
          </div>
        </div>
      )}
    </main>
  );
}
