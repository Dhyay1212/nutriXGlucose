"use client";
import { useEffect, useState } from "react";
import UserProvider, { useUser } from "@/components/UserProvider";
import { DishRiseChart } from "@/components/Charts";
import { EffectBars, MealTimeBars, ScatterFit } from "@/components/Viz";
import { experimentProgress, listExperiments, startExperiment, stopExperiment, tagEffects, TAG_BY_ID, TAGS, type Experiment } from "@/lib/tags";
import { listEducatorNotes, listMeals, listNotes, listReadings, saveNote, uid } from "@/lib/store";
import { dishStats, inLastDays, inLastWeek, riseForMeal, startOfWeek, MIN_INSTANCES } from "@/lib/glucose";
import { calibrate, MIN_CAL } from "@/lib/impact";
import { fmtTime } from "@/lib/format";
import type { EducatorNote, Meal, Note, Reading } from "@/lib/types";

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
  const [days, setDays] = useState<7 | 30>(7);
  const [exps, setExps] = useState<Experiment[]>([]);
  const [enotes, setEnotes] = useState<EducatorNote[]>([]);
  useEffect(() => { if (user) setExps(listExperiments(user.id)); }, [user?.id]);

  const load = async () => {
    if (!user) return;
    const [m, r, n] = await Promise.all([listMeals(user.id), listReadings(user.id), listNotes(user.id)]);
    setMeals(m);
    setReadings(r);
    setNotes(n);
    setEnotes(await listEducatorNotes(user.id).catch(() => []));
  };
  useEffect(() => { load(); }, [user?.id]);

  const week = inLastDays(meals, (m) => m.eatenAt, days);
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
  const effects = tagEffects(meals, readings, cal);
  const tried = new Set(effects.map((e) => e.tag.id));

  async function generate() {
    if (!user) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/insight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userName: user.name, stats, meals: week.length, mealsWithRise: withRise.length, readings: inLastDays(readings, (r) => r.takenAt, days).length }),
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
        <div className="chips" style={{ marginTop: 10 }}>
          {([7, 30] as const).map((d) => <button key={d} className={"chip" + (days === d ? " on" : "")} onClick={() => setDays(d)}>Last {d} days</button>)}
        </div>
      </div>
      {enotes.length > 0 && (
        <div className="card">
          <h2>From your diabetes educator</h2>
          {enotes.slice(0, 3).map((n) => <div key={n.id} className="note" style={{ marginTop: 8 }}><div className="tiny muted">{n.author} · {fmtTime(n.createdAt)}</div>{n.text}</div>)}
        </div>
      )}

      <section className="card">
        <div className="card-head"><h2>How your body responds to load</h2>{cal.ready && <span className="pill">{cal.n} meals</span>}</div>
        {cal.ready ? (
          <p style={{ marginTop: 0 }}>For you, each unit of meal glucose load adds about <b>{cal.k} mg/dL</b> to your rise{cal.r2 != null ? <> (the line explains {Math.round(cal.r2 * 100)}% of the variation)</> : null}. Another person may respond very differently to the same plate.</p>
        ) : (
          <p style={{ marginTop: 0 }}>Measure {MIN_CAL - cal.n} more meal{MIN_CAL - cal.n === 1 ? "" : "s"} to unlock your personal line. Each dot is a meal with a reading before and ~2 h after.</p>
        )}
        <ScatterFit cal={cal} />
      </section>

      <section className="card">
        <div className="card-head"><h2>What helps you</h2>{effects.length > 0 && <span className="pill">from your readings</span>}</div>
        {effects.length > 0 ? (
          <>
            <p className="tiny muted" style={{ marginTop: 0 }}>Each bar compares meals with that habit to your usual rise for the same load. Green = smaller rise than usual.</p>
            <EffectBars rows={effects.map((e) => ({ label: `${e.tag.icon} ${e.tag.label}`, effect: e.effect, n: e.withN, strength: e.strength }))} />
          </>
        ) : (
          <p className="tiny muted" style={{ marginTop: 0 }}>{cal.ready ? "Tag your meals (walked after, salad first, slept badly…) and NutriX will show which habits change your rise." : "Unlocks after your personal model is ready and a few meals are tagged."}</p>
        )}

        <h3>Try a small experiment</h3>
        {exps.map((e) => {
          const t = TAG_BY_ID[e.tagId];
          const p = experimentProgress(e, meals, readings);
          const eff = effects.find((x) => x.tag.id === e.tagId);
          return (
            <div className="sugg" key={e.tagId}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 650 }}>{t?.icon} {t?.label}</div>
                <div className="tiny muted">{p.measured} of {e.target} measured tries{eff ? ` · so far ${eff.effect > 0 ? "+" : ""}${eff.effect} mg/dL vs usual` : ""}</div>
                <div className="progress" style={{ marginTop: 6 }}><span style={{ width: `${Math.min(100, (p.measured / e.target) * 100)}%` }} /></div>
              </div>
              <button className="btn ghost small" onClick={() => { stopExperiment(user!.id, e.tagId); setExps(listExperiments(user!.id)); }}>{p.measured >= e.target ? "Done" : "Stop"}</button>
            </div>
          );
        })}
        <div className="chips" style={{ marginTop: 8 }}>
          {TAGS.filter((t) => t.kind === "change" && !exps.some((e) => e.tagId === t.id)).map((t) => (
            <button key={t.id} className="chip" title={t.tip} onClick={() => { startExperiment(user!.id, t.id); setExps(listExperiments(user!.id)); }}>
              + {t.icon} {t.label}{tried.has(t.id) ? " (again)" : ""}
            </button>
          ))}
        </div>
        <p className="tiny muted" style={{ margin: "6px 0 0" }}>Pick one change, do it at 3 measured meals, and NutriX compares those rises with your usual. Changes only add or swap; nothing is off-limits.</p>
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
        <div className="card-head"><h2>Average rise per dish</h2><span className="tiny muted">last {days} days</span></div>
        <p className="tiny muted" style={{ marginTop: 0 }}>Meals are mixed, so these are associations, not causes. Dishes need {MIN_INSTANCES}+ measured meals before we call it a pattern.</p>
        <DishRiseChart stats={stats} />
      </section>

      <section className="card">
        <div className="card-head"><h2>Rise by time of day</h2><span className="tiny muted">last {days} days</span></div>
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
