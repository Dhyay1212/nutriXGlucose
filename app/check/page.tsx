"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import UserProvider, { useUser } from "@/components/UserProvider";
import MealInput from "@/components/MealInput";
import PlateEditor from "@/components/PlateEditor";
import ImpactCard from "@/components/ImpactCard";
import { blankDraft, toDrafts, type Analysis, type Draft } from "@/lib/analyzeClient";
import { DISH_BY_ID } from "@/lib/dishes";
import { listMeals, listReadings } from "@/lib/store";
import { calibrate, type Calibration } from "@/lib/impact";
import { dishStats, riseForMeal } from "@/lib/glucose";
import { tagEffects } from "@/lib/tags";
import type { Meal, Reading } from "@/lib/types";

export default function Page() {
  return <UserProvider><Check /></UserProvider>;
}

const slot = (d: Date) => { const h = d.getHours(); return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 19 ? "snack" : "dinner"; };

/** "Before you eat": what is this plate likely to do to MY glucose? Nothing is saved. */
function Check() {
  const { user } = useUser();
  const router = useRouter();
  const [items, setItems] = useState<Draft[] | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [cal, setCal] = useState<Calibration | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([listMeals(user.id), listReadings(user.id)]).then(([m, r]) => { setMeals(m); setReadings(r); setCal(calibrate(m, r)); }).catch(() => {});
  }, [user?.id]);

  const onResult = (a: Analysis) => { setItems(a.items); setNotes([a.notes, a.detInfo ?? ""].filter(Boolean)); };
  const valid = (items ?? []).filter((i) => DISH_BY_ID[i.dishId]);

  // What this person's own history says about this plate
  const history: string[] = [];
  if (valid.length && meals.length) {
    const stats = dishStats(meals, readings);
    for (const it of valid) {
      const s = stats.find((x) => x.dishId === it.dishId);
      if (s && s.avgRise != null && s.timesWithRise >= 2) history.push(`${s.name}: meals with it rose +${s.avgRise} mg/dL on average for you (${s.timesWithRise} measured).`);
    }
    const now = slot(new Date());
    const bySlot: Record<string, number[]> = {};
    for (const m of meals) {
      const r = riseForMeal(m, readings).rise;
      if (r != null) (bySlot[slot(new Date(m.eatenAt))] ??= []).push(r);
    }
    const avg = (xs?: number[]) => (xs && xs.length >= 3 ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
    const here = now === "snack" ? null : avg(bySlot[now]);
    const others = (["breakfast", "lunch", "dinner"] as const).filter((k) => k !== now).map((k) => [k, avg(bySlot[k])] as const).filter(([, v]) => v != null) as [string, number][];
    if (here != null && others.length) {
      const lowest = others.sort((a, b) => a[1] - b[1])[0];
      history.push(lowest[1] < here - 8
        ? `Your ${now} rises average +${here} mg/dL, vs +${lowest[1]} at ${lowest[0]}. The same plate has tended to land softer at ${lowest[0]} for you.`
        : `Your ${now} rises average +${here} mg/dL, about the same as other meals.`);
    }
    const walk = tagEffects(meals, readings, cal ?? undefined).find((e) => e.tag.id === "walk");
    if (walk && walk.effect < -3) history.push(`A 10-minute walk after eating has meant about ${Math.abs(walk.effect)} mg/dL smaller rises for you (${walk.withN} meals, ${walk.strength}).`);
  }

  return (
    <main className="wrap">
      <div className="card stack">
        <div>
          <h1 style={{ margin: 0 }}>Before you eat</h1>
          <p className="muted tiny" style={{ margin: "4px 0 0" }}>See what a plate is likely to do to your glucose, and a gentler version. Nothing is saved unless you log it.</p>
        </div>
        <MealInput onResult={onResult} compact />
        {!items && <button className="btn ghost" onClick={() => setItems([blankDraft()])}>Search dishes instead</button>}
      </div>

      {items && <PlateEditor items={items} setItems={(fn) => setItems((xs) => fn(xs ?? []))} title="Your plate" notes={notes} />}

      {items && valid.length > 0 && (
        <ImpactCard items={valid} cal={cal} onUse={(xs) => setItems(toDrafts(xs))} title="If you eat this">
          {history.length > 0 && (
            <div className="stat flat" style={{ alignItems: "flex-start" }}>
              <b style={{ fontSize: ".95rem" }}>From your own data</b>
              <ul className="tiny" style={{ margin: "4px 0 0", paddingLeft: 18, lineHeight: 1.55 }}>
                {history.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </div>
          )}
        </ImpactCard>
      )}

      {items && valid.length > 0 && (
        <div className="card row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => {
            try { sessionStorage.setItem("nxg_prefill", JSON.stringify(valid.map(({ dishId, portion, name, custom }) => ({ dishId, portion, name, custom: custom ?? (DISH_BY_ID[dishId]?.source === "AI estimate" ? DISH_BY_ID[dishId] : undefined) })))); } catch {}
            router.push("/log");
          }}>I’m eating this: log it</button>
          <button className="btn ghost" onClick={() => { setItems(null); setNotes([]); }}>Check another</button>
        </div>
      )}
    </main>
  );
}
