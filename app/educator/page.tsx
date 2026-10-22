"use client";
import { useEffect, useState } from "react";
import { listMeals, listNotes, listReadings, listUsers } from "@/lib/store";
import { dishStats, inLastWeek, riseForMeal, MIN_INSTANCES } from "@/lib/glucose";
import { fmtTime, portionLabel } from "@/lib/format";
import { DISH_BY_ID } from "@/lib/dishes";
import { calibrate, mealLoad } from "@/lib/impact";
import { BandChip } from "@/components/Viz";
import type { Meal, Note, Reading, UserProfile } from "@/lib/types";

// Read-only educator view: weekly dish table, AI note and meal photos for each participant.
export default function Educator() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [sel, setSel] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listUsers(), listMeals(), listReadings(), listNotes()])
      .then(([u, m, r, n]) => {
        setUsers(u);
        setMeals(m);
        setReadings(r);
        setNotes(n);
        if (u[0]) setSel(u[0].id);
      })
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <main className="wrap"><div className="card error">{err}</div></main>;

  const overview = users.map((u) => {
    const wk = inLastWeek(meals.filter((m) => m.userId === u.id), (m) => m.eatenAt);
    const days = new Set(wk.map((m) => new Date(m.eatenAt).toDateString())).size || 1;
    return {
      u,
      meals: wk.length,
      perDay: wk.length / days,
      withRise: wk.filter((m) => riseForMeal(m, readings).rise != null).length,
      readings: inLastWeek(readings.filter((r) => r.userId === u.id), (r) => r.takenAt).length,
      avgLog: avg(wk.map((m) => m.logSeconds).filter((x): x is number => typeof x === "number")),
      k: calibrate(meals.filter((m) => m.userId === u.id), readings).k,
    };
  });

  const um = inLastWeek(meals.filter((m) => m.userId === sel), (m) => m.eatenAt);
  const stats = dishStats(um, readings);
  const note = notes.find((n) => n.userId === sel);

  return (
    <main className="wrap" style={{ maxWidth: 1100 }}>
      <div className="card">
        <h1>Educator view</h1>
        <p className="muted tiny">Read-only. Last 7 days. Rises are associations across mixed meals; check photos and context (exercise, medication, missed readings) before advising.</p>
        <div className="scroll-x">
          <table>
            <thead>
              <tr><th>Participant</th><th>Meals</th><th>Meals/day</th><th>With rise</th><th>Readings</th><th>mg/dL per load</th><th>Avg log time</th><th></th></tr>
            </thead>
            <tbody>
              {overview.map((o) => (
                <tr key={o.u.id} style={o.u.id === sel ? { background: "var(--brand-soft)" } : undefined}>
                  <td><b>{o.u.id}</b> {o.u.name}</td>
                  <td>{o.meals}</td>
                  <td>{o.perDay.toFixed(1)}</td>
                  <td>{o.withRise}</td>
                  <td>{o.readings}</td>
                  <td>{o.k ?? "–"}</td>
                  <td>{o.avgLog != null ? `${o.avgLog}s` : "–"}</td>
                  <td><button className="btn small ghost" onClick={() => setSel(o.u.id)}>View</button></td>
                </tr>
              ))}
              {!overview.length && <tr><td colSpan={8} className="muted">No participants yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {sel && (
        <>
          <div className="card">
            <h2>Weekly dish table · {sel}</h2>
            <div className="scroll-x">
              <table>
                <thead>
                  <tr><th>Dish</th><th>Times eaten</th><th>With readings</th><th>Avg rise</th><th>Range</th><th>Avg meal carbs</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {stats.map((s) => (
                    <tr key={s.dishId}>
                      <td>{s.name}</td>
                      <td>{s.times}</td>
                      <td>{s.timesWithRise}</td>
                      <td>{s.avgRise != null ? `+${s.avgRise} mg/dL` : "–"}</td>
                      <td>{s.minRise != null ? `${s.minRise} to ${s.maxRise}` : "–"}</td>
                      <td>{s.avgCarbsMeal != null ? `${s.avgCarbsMeal} g` : "–"}</td>
                      <td>{s.enoughData ? <span className="pill">pattern</span> : <span className="pill grey">not enough data (&lt;{MIN_INSTANCES})</span>}</td>
                    </tr>
                  ))}
                  {!stats.length && <tr><td colSpan={7} className="muted">No meals this week.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2>Latest AI pattern note</h2>
            {note ? <><p className="tiny muted">{fmtTime(note.createdAt)}</p><div className="note">{note.text}</div></> : <p className="muted">No note generated yet.</p>}
          </div>

          <div className="card">
            <h2>Meals this week</h2>
            <div className="scroll-x">
              <table>
                <thead><tr><th>Photo</th><th>When</th><th>Dishes (as confirmed)</th><th>Carbs</th><th>Load</th><th>Pre → peak</th><th>Rise</th></tr></thead>
                <tbody>
                  {um.map((m) => {
                    const r = riseForMeal(m, readings);
                    return (
                      <tr key={m.id}>
                        <td>{m.photo ? <img src={m.photo} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8 }} /> : "–"}</td>
                        <td>{fmtTime(m.eatenAt)}</td>
                        <td>
                          {m.items.map((i, k) => (
                            <div key={k}>
                              {i.name} · {portionLabel(i.portion, DISH_BY_ID[i.dishId]?.unit ?? "katori")}
                              {i.aiName && i.aiName.toLowerCase() !== i.name.toLowerCase() && <span className="tiny muted"> (AI: {i.aiName})</span>}
                            </div>
                          ))}
                        </td>
                        <td>{m.totals.carbs} g</td>
                        <td><BandChip gl={mealLoad(m).gl} label={String(Math.round(mealLoad(m).gl))} /></td>
                        <td>{r.pre ?? "–"} → {r.peak ?? "–"}</td>
                        <td>{r.rise != null ? <b>+{r.rise}</b> : "–"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function avg(xs: number[]) {
  return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
}
