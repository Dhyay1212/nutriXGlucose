"use client";
import { useEffect, useState } from "react";
import UserProvider, { useUser } from "@/components/UserProvider";
import { DishRiseChart } from "@/components/Charts";
import { MealTimeBars, ScatterFit } from "@/components/Viz";
import { listMeals, listNotes, listReadings, saveNote, uid } from "@/lib/store";
import { dishStats, inLastWeek, riseForMeal, startOfWeek, MIN_INSTANCES } from "@/lib/glucose";
import { calibrate, MIN_CAL } from "@/lib/impact";
import { fmtTime } from "@/lib/format";
import type { Meal, Note, Reading } from "@/lib/types";

export default function Page() {
  return <UserProvider><Insights /></UserProvider>;
}

const slot = (iso: string) => {
  const h = new Date(iso).getHours();
  return h < 11 ? "Breakfast" : h < 16 ? "Lunch" : h < 19 ? "Snack" : "Dinner";
};

function Insights() {
  const { user } = useUser();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const [m, r, n] = await Promise.all([listMeals(user.id), listReadings(user.id), listNotes(user.id)]);
    setMeals(m);
    setReadings(r);
    setNotes(n);
  };
  useEffect(() => { load(); }, [user?.id]);

  const week = inLastWeek(meals, (m) => m.eatenAt);
  const stats = dishStats(week, readings);
  const withRise = week.filter((m) => riseForMeal(m, readings).rise != null);
  const cal = calibrate(meals, readings);

  const slots = ["Breakfast", "Lunch", "Snack", "Dinner"].map((label) => {
    const rs = withRise.filter((m) => slot(m.eatenAt) === label).map((m) => riseForMeal(m, readings).rise as number);
    return { label, n: rs.length, avg: rs.length ? Math.round(rs.reduce((a, b) => a + b, 0) / rs.length) : null };
  }).filter((r) => r.label !== "Snack" || r.n > 0);

  // Biggest surprises: meals that rose much more (or less) than the model expected
  const surprises = cal.ready && cal.k
    ? cal.points.map((p) => ({ ...p, diff: Math.round(p.rise - cal.k! * p.gl) })).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 3)
    : [];
  const mealById = new Map(meals.map((m) => [m.id, m]));

  async function generate() {
    if (!user) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/insight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userName: user.name, stats, meals: week.length, mealsWithRise: withRise.length, readings: inLastWeek(readings, (r) => r.takenAt).length }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await saveNote({ id: uid(), userId: user.id, weekStart: startOfWeek().toISOString().slice(0, 10), text: data.text, createdAt: new Date().toISOString() });
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap">
      <div>
        <h1>Your patterns</h1>
        <p className="muted tiny" style={{ margin: 0 }}>How your own meals affect your own glucose. Patterns, not diagnoses.</p>
      </div>

      <section className="card">
        <div className="card-head"><h2>How your body responds to load</h2>{cal.ready && <span className="pill">{cal.n} meals</span>}</div>
        {cal.ready ? (
          <p style={{ marginTop: 0 }}>For you, each unit of meal glucose load adds about <b>{cal.k} mg/dL</b> to your rise{cal.r2 != null ? <> (the line explains {Math.round(cal.r2 * 100)}% of the variation)</> : null}. Another person may respond very differently to the same plate.</p>
        ) : (
          <p style={{ marginTop: 0 }}>Measure {MIN_CAL - cal.n} more meal{MIN_CAL - cal.n === 1 ? "" : "s"} to unlock your personal line. Each dot is a meal with a reading before and ~2 h after.</p>
        )}
        <ScatterFit cal={cal} />
      </section>

      {surprises.length > 0 && (
        <section className="card">
          <div className="card-head"><h2>Meals that surprised the model</h2></div>
          <p className="tiny muted" style={{ marginTop: 0 }}>Bigger or smaller rises than your line predicts. Worth checking: portion, a walk after eating, sleep, or medication timing.</p>
          <table>
            <thead><tr><th>Meal</th><th className="num">Load</th><th className="num">Rise</th><th className="num">vs expected</th></tr></thead>
            <tbody>
              {surprises.map((s) => {
                const m = mealById.get(s.mealId);
                return (
                  <tr key={s.mealId}>
                    <td>{m?.items.map((i) => i.name).join(", ")}<div className="tiny muted">{m && fmtTime(m.eatenAt)}</div></td>
                    <td className="num">{s.gl}</td>
                    <td className="num">+{s.rise}</td>
                    <td className="num" style={{ fontWeight: 650 }}>{s.diff > 0 ? "+" : ""}{s.diff}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <section className="card">
        <div className="card-head"><h2>Average rise per dish</h2><span className="tiny muted">last 7 days</span></div>
        <p className="tiny muted" style={{ marginTop: 0 }}>Meals are mixed, so these are associations, not causes. Dishes need {MIN_INSTANCES}+ measured meals before we call it a pattern.</p>
        <DishRiseChart stats={stats} />
      </section>

      <section className="card">
        <div className="card-head"><h2>Rise by time of day</h2><span className="tiny muted">last 7 days</span></div>
        <MealTimeBars rows={slots} />
      </section>

      <section className="card">
        <div className="card-head"><h2>Weekly note</h2><button className="btn small" disabled={busy} onClick={generate}>{busy ? "Writing…" : "Write this week’s note"}</button></div>
        {err && <p style={{ color: "var(--crit)" }}>{err}</p>}
        {notes[0] ? (
          <>
            <p className="tiny muted">{fmtTime(notes[0].createdAt)}</p>
            <div className="note">{notes[0].text}</div>
          </>
        ) : (
          <p className="muted">No note yet. Your educator sees the same note.</p>
        )}
      </section>
    </main>
  );
}
