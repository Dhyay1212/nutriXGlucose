"use client";
import { useEffect, useState } from "react";
import { authEnabled, getAuthUser, listEducatorNotes, listMeals, listNotes, listReadings, listUsers, saveEducatorNote, uid } from "@/lib/store";
import { toCsv, download } from "@/lib/csv";
import { TAG_BY_ID } from "@/lib/tags";
import { dishStats, inLastWeek, riseForMeal, MIN_INSTANCES } from "@/lib/glucose";
import { fmtTime, itemPortionLabel } from "@/lib/format";
import { DISH_BY_ID } from "@/lib/dishes";
import { calibrate, mealLoad } from "@/lib/impact";
import { BandChip } from "@/components/Viz";
import type { EducatorNote, Meal, Note, Reading, UserProfile } from "@/lib/types";

const DAY = 86400000;
/** Things an educator should look at first. */
function flagsFor(u: UserProfile, meals: Meal[], readings: Reading[], now = Date.now()) {
  const um = meals.filter((m) => m.userId === u.id);
  const ur = readings.filter((r) => r.userId === u.id);
  const wk = (t: string) => now - new Date(t).getTime() < 7 * DAY;
  const out: { level: "crit" | "warn" | "info"; text: string }[] = [];
  const lows = ur.filter((r) => wk(r.takenAt) && r.mgdl < 70);
  if (lows.length) out.push({ level: "crit", text: `${lows.length} reading${lows.length > 1 ? "s" : ""} below 70 mg/dL this week` });
  const lastR = Math.max(0, ...ur.map((r) => new Date(r.takenAt).getTime()));
  if (!ur.length) out.push({ level: "warn", text: "No glucose readings yet" });
  else if (now - lastR > 2 * DAY) out.push({ level: "warn", text: `No readings for ${Math.floor((now - lastR) / DAY)} days` });
  const lastM = Math.max(0, ...um.map((m) => new Date(m.eatenAt).getTime()));
  if (!um.length) out.push({ level: "warn", text: "No meals logged yet" });
  else if (now - lastM > 2 * DAY) out.push({ level: "warn", text: `No meals logged for ${Math.floor((now - lastM) / DAY)} days` });
  const high = um.filter((m) => wk(m.eatenAt) && mealLoad(m).gl > 40).length;
  if (high >= 3) out.push({ level: "info", text: `${high} high-load meals this week` });
  const highs = ur.filter((r) => wk(r.takenAt) && r.mgdl > 250).length;
  if (highs) out.push({ level: "warn", text: `${highs} reading${highs > 1 ? "s" : ""} above 250 mg/dL this week` });
  return out;
}
const FLAG_COLOR = { crit: "var(--crit, #d03b3b)", warn: "#b07d00", info: "var(--muted)" };

// Read-only educator view: weekly dish table, AI note and meal photos for each participant.
export default function Educator() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [enotes, setEnotes] = useState<EducatorNote[]>([]);
  const [sel, setSel] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [draft, setDraft] = useState("");
  const [author, setAuthor] = useState("");

  useEffect(() => {
    (async () => {
      if (authEnabled) {
        const a = await getAuthUser().catch(() => null);
        const us = await listUsers();
        const me = a ? us.find((u) => u.authId === a.id) : null;
        if (!me || me.role !== "educator") { setDenied(true); return; }
        setAuthor(me.name);
      }
      const [u, m, r, n, e] = await Promise.all([listUsers(), listMeals(), listReadings(), listNotes(), listEducatorNotes().catch(() => [])]);
      const parts = u.filter((x) => x.role !== "educator");
      setUsers(parts);
      setMeals(m);
      setReadings(r);
      setNotes(n);
      setEnotes(e);
      if (parts[0]) setSel(parts[0].id);
    })().catch((e) => setErr(e.message));
  }, []);

  if (denied) return <main className="wrap"><div className="card"><h1>Educator view</h1><p className="muted">This page is only for the pilot’s diabetes educator. Ask the pilot admin to give your account the educator role.</p></div></main>;
  if (err) return <main className="wrap"><div className="card error">{err}</div></main>;

  const exportAll = () => {
    const rows = meals.map((m) => {
      const r = riseForMeal(m, readings);
      return [m.userId, m.eatenAt, m.items.map((i) => `${i.name} x${i.portion}`).join("; "), m.totals.kcal, m.totals.carbs, m.totals.protein, m.totals.fat, m.totals.fibre, Math.round(mealLoad(m).gl), r.pre, r.peak, r.rise, (m.tags ?? []).join(" "), m.source, m.logSeconds];
    });
    download(`nutrix-meals-all-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(["participant", "eaten_at", "dishes", "kcal", "carbs_g", "protein_g", "fat_g", "fibre_g", "glycemic_load", "pre_mgdl", "peak_mgdl", "rise_mgdl", "tags", "source", "log_seconds"], rows));
    download(`nutrix-readings-all-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(["participant", "taken_at", "mgdl"], readings.map((r) => [r.userId, r.takenAt, r.mgdl])));
  };
  const addNote = async () => {
    if (!draft.trim() || !sel) return;
    const n: EducatorNote = { id: uid(), userId: sel, author: author || "Educator", text: draft.trim(), createdAt: new Date().toISOString() };
    await saveEducatorNote(n);
    setEnotes([n, ...enotes]);
    setDraft("");
  };

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
      flags: flagsFor(u, meals, readings),
      methods: (["photo", "voice", "text", "manual"] as const).map((k) => [k, wk.filter((m) => (m.source ?? "manual") === k).length] as const).filter(([, n]) => n > 0),
    };
  });

  const um = inLastWeek(meals.filter((m) => m.userId === sel), (m) => m.eatenAt);
  const stats = dishStats(um, readings);
  const note = notes.find((n) => n.userId === sel);

  return (
    <main className="wrap" style={{ maxWidth: 1100 }}>
      <div className="card">
        <div className="card-head">
          <h1 style={{ margin: 0 }}>Educator view</h1>
          <button className="btn small ghost" onClick={exportAll} disabled={!meals.length}>⬇ Export all (CSV)</button>
        </div>
        <p className="muted tiny">Last 7 days. Rises are associations across mixed meals; check photos and context (exercise, medication, missed readings) before advising.</p>
        <div className="scroll-x">
          <table>
            <thead>
              <tr><th>Participant</th><th>Meals</th><th>Meals/day</th><th>With rise</th><th>Readings</th><th>mg/dL per load</th><th>Avg log time</th><th>Logged by</th><th>Flags</th><th></th></tr>
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
                  <td className="tiny">{o.methods.map(([k, n]) => `${{ photo: "📷", voice: "🎙", text: "⌨️", manual: "🔎" }[k]} ${n}`).join("  ") || "–"}</td>
                  <td className="tiny">{o.flags.length ? o.flags.map((f, i) => <div key={i} style={{ color: FLAG_COLOR[f.level], fontWeight: f.level === "crit" ? 650 : 400 }}>{f.level === "crit" ? "⚠ " : "• "}{f.text}</div>) : <span className="muted">—</span>}</td>
                  <td><button className="btn small ghost" onClick={() => setSel(o.u.id)}>View</button></td>
                </tr>
              ))}
              {!overview.length && <tr><td colSpan={10} className="muted">No participants yet.</td></tr>}
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
            <h2>Review notes · {sel}</h2>
            <p className="tiny muted">Visible to you and the participant. Keep advice general; medication changes go through their doctor.</p>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="e.g. Rice at dinner rises more than at lunch. Try the 10-minute walk after dinner this week." style={{ width: "100%" }} />
            <button className="btn small" style={{ marginTop: 6 }} disabled={!draft.trim()} onClick={addNote}>Save note</button>
            <div className="stack" style={{ marginTop: 10 }}>
              {enotes.filter((n) => n.userId === sel).map((n) => (
                <div key={n.id} className="note"><div className="tiny muted">{n.author} · {fmtTime(n.createdAt)}</div>{n.text}</div>
              ))}
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
                <thead><tr><th>Photo</th><th>When</th><th>Dishes (as confirmed)</th><th>Carbs</th><th>Load</th><th>Pre → peak</th><th>Rise</th><th>Tags</th></tr></thead>
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
                              {i.name} · {itemPortionLabel(i.portion, DISH_BY_ID[i.dishId])}
                              {i.aiName && i.aiName.toLowerCase() !== i.name.toLowerCase() && <span className="tiny muted"> (AI: {i.aiName})</span>}
                            </div>
                          ))}
                        </td>
                        <td>{m.totals.carbs} g</td>
                        <td><BandChip gl={mealLoad(m).gl} label={String(Math.round(mealLoad(m).gl))} /></td>
                        <td>{r.pre ?? "–"} → {r.peak ?? "–"}</td>
                        <td>{r.rise != null ? <b>+{r.rise}</b> : "–"}</td>
                        <td>{(m.tags ?? []).map((t) => <span key={t} title={TAG_BY_ID[t]?.label}>{TAG_BY_ID[t]?.icon ?? t}</span>)}</td>
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
