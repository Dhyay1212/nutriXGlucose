"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import UserProvider, { useUser } from "@/components/UserProvider";
import UserSwitch from "@/components/UserSwitch";
import MealList from "@/components/MealList";
import { BandChip, DailyLoadChart, MacroBar, Ring } from "@/components/Viz";
import NutritionPanel from "@/components/NutritionPanel";
import { deleteMeal, listMeals, listReadings, saveMeal, storageMode } from "@/lib/store";
import { fmtTime } from "@/lib/format";
import { inLastWeek, riseForMeal } from "@/lib/glucose";
import { BAND_LABEL, bandFor, calibrate, MIN_CAL, mealLoad } from "@/lib/impact";
import type { Meal, Reading } from "@/lib/types";

export default function Page() {
  return <UserProvider><Home /></UserProvider>;
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

function Home() {
  const { user } = useUser();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const load = async () => {
    if (!user) return;
    const [m, r] = await Promise.all([listMeals(user.id), listReadings(user.id)]);
    setMeals(m);
    setReadings(r);
  };
  useEffect(() => { load(); }, [user?.id]);

  const now = new Date();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  const todayMeals = meals.filter((m) => sameDay(new Date(m.eatenAt), now));
  const useYest = todayMeals.length === 0 && meals.some((m) => sameDay(new Date(m.eatenAt), yest));
  const dayWord = useYest ? "Yesterday" : "Today";
  const today = useYest ? meals.filter((m) => sameDay(new Date(m.eatenAt), yest)) : todayMeals;
  const todayLoad = today.reduce((s, m) => s + mealLoad(m).gl, 0);
  const macros = today.reduce((a, m) => ({ c: a.c + m.totals.carbs, p: a.p + m.totals.protein, f: a.f + m.totals.fat }), { c: 0, p: 0, f: 0 });

  const week = inLastWeek(meals, (m) => m.eatenAt);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - i));
    const dm = meals.filter((m) => sameDay(new Date(m.eatenAt), d));
    const gls = dm.map((m) => mealLoad(m).gl);
    return { label: d.toLocaleDateString("en-IN", { weekday: "short" }), gl: gls.reduce((s, v) => s + v, 0), meals: dm.length, maxMealGl: gls.length ? Math.max(...gls) : 0 };
  });
  const loggedDays = days.filter((d) => d.meals > 0).length || 1;

  const wkReadings = inLastWeek(readings, (r) => r.takenAt);
  const tir = wkReadings.length ? wkReadings.filter((r) => r.mgdl >= 70 && r.mgdl <= 180).length / wkReadings.length : null;
  const avg = wkReadings.length ? Math.round(wkReadings.reduce((s, r) => s + r.mgdl, 0) / wkReadings.length) : null;

  const cal = calibrate(meals, readings);

  // Logging streak: consecutive days with at least one meal, ending today (or yesterday if nothing yet today)
  let streak = 0;
  for (let i = todayMeals.length ? 0 : 1; i < 365; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    if (meals.some((m) => sameDay(new Date(m.eatenAt), d))) streak++;
    else break;
  }
  // 2-hour readings due: meals eaten 30–180 min ago with no post-meal reading yet
  const due = meals.filter((m) => {
    const mins = (now.getTime() - new Date(m.eatenAt).getTime()) / 60000;
    return mins >= 30 && mins <= 180 && riseForMeal(m, readings).peak == null;
  });
  const latest = meals.find((m) => riseForMeal(m, readings).rise != null);
  const latestRise = latest ? riseForMeal(latest, readings) : null;

  return (
    <main className="wrap">
      <section className="hero">
        <div className="row between">
          <div>
            <div className="tiny">Hi {user?.name?.split(" ")[0]} 👋</div>
            <h1>{dayWord}’s glucose load</h1>
          </div>
          <Link className="btn small" href="/log">📷 Snap meal</Link>
        </div>
        <div className="hero-grid">
          <Ring value={tir ?? 0} label={tir != null ? `${Math.round(tir * 100)}%` : "–"} sub="in range" color="#fff" />
          <div className="hero-stat">
            <b>{Math.round(todayLoad)}</b>
            <div className="tiny">{today.length} meal{today.length === 1 ? "" : "s"} {dayWord.toLowerCase()}{today.length ? ` · ${BAND_LABEL[bandFor(Math.max(...today.map((m) => mealLoad(m).gl)))].toLowerCase()} at most` : ""}</div>
            <div className="tiny" style={{ marginTop: 6 }}>{avg != null ? `7-day average glucose ${avg} mg/dL · time in range 70–180` : "Add glucose readings to see time in range"}</div>
          </div>
        </div>
      </section>

      {due.map((m) => {
        const mins = Math.round((now.getTime() - new Date(m.eatenAt).getTime()) / 60000);
        const walked = (m.tags ?? []).includes("walk");
        return (
          <section className="card warn" key={m.id}>
            <div style={{ fontWeight: 650 }}>⏰ {mins >= 100 ? "2-hour reading due now" : `2-hour reading due in ~${120 - mins} min`}</div>
            <div className="tiny muted" style={{ margin: "2px 0 8px" }}>{m.items.map((i) => i.name).join(", ")} · eaten {fmtTime(m.eatenAt)}</div>
            <div className="row">
              <Link className="btn small" href="/glucose">Add reading</Link>
              <button className="btn ghost small" disabled={walked} onClick={async () => { await saveMeal({ ...m, tags: [...(m.tags ?? []), "walk"] }); load(); }}>{walked ? "🚶 Walk logged" : "🚶 I walked after"}</button>
            </div>
          </section>
        );
      })}

      {latest && latestRise && (
        <section className="card">
          <div className="tiny muted">Your latest measured meal</div>
          <h2 style={{ margin: ".2rem 0 .5rem" }}>This meal raised your glucose by {latestRise.rise} mg/dL</h2>
          <div className="row" style={{ gap: 8 }}>
            <BandChip gl={mealLoad(latest).gl} label={`Load ${Math.round(mealLoad(latest).gl)}`} />
            <span className="tiny muted">{latest.items.map((i) => i.name).join(", ")} · {latestRise.pre} → {latestRise.peak} mg/dL</span>
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head"><h2>Your personal model</h2><Link href="/insights" className="tiny">See how →</Link></div>
        {cal.ready ? (
          <p style={{ margin: 0 }}>Each unit of meal load raises <b>your</b> glucose by about <b>{cal.k} mg/dL</b>, learned from {cal.n} measured meals. New meals now show a predicted rise before you eat.</p>
        ) : (
          <>
            <p style={{ margin: "0 0 10px" }}>Measure {MIN_CAL - cal.n} more meal{MIN_CAL - cal.n === 1 ? "" : "s"} (a reading before and ~2 h after) and NutriX will start predicting <b>your</b> rise for each plate.</p>
            <div className="progress"><span style={{ width: `${(cal.n / MIN_CAL) * 100}%` }} /></div>
            <div className="tiny muted" style={{ marginTop: 4 }}>{cal.n} of {MIN_CAL} measured meals</div>
          </>
        )}
      </section>

      <div className="stat-grid">
        <div className="stat"><b>🔥 {streak}</b><span>day logging streak</span></div>
        <div className="stat"><b>{(week.length / loggedDays).toFixed(1)}</b><span>meals logged / day</span></div>
        <div className="stat"><b>{week.length}</b><span>meals this week</span></div>
        <div className="stat"><b>{week.filter((m) => riseForMeal(m, readings).rise != null).length}</b><span>with a measured rise</span></div>
      </div>

      <section className="card">
        <div className="card-head"><h2>Glucose load, last 7 days</h2></div>
        <DailyLoadChart days={days} />
      </section>

      <section className="card">
        <div className="card-head"><h2>{dayWord}’s plate</h2><span className="tiny muted">{macros.c + macros.p + macros.f ? `${macros.c} g carbs` : ""}</span></div>
        <MacroBar carbs={macros.c} protein={macros.p} fat={macros.f} />
        {today.length > 0 && <div style={{ marginTop: 12 }}><NutritionPanel items={today.flatMap((m) => m.items)} title={`${dayWord}’s full nutrition`} /></div>}
      </section>

      <section className="card">
        <div className="card-head"><h2>Recent meals</h2><Link href="/glucose" className="tiny">+ Add reading</Link></div>
        <MealList meals={meals.slice(0, 12)} readings={readings} onDelete={async (id) => { await deleteMeal(id); load(); }} />
      </section>

      <section className="card"><UserSwitch /></section>
      {storageMode === "browser" && <p className="tiny muted" style={{ textAlign: "center" }}>Data is stored in this browser only.</p>}
    </main>
  );
}
