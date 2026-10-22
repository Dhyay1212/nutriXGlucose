"use client";
import { useEffect, useState } from "react";
import UserProvider, { useUser } from "@/components/UserProvider";
import { GlucoseTimeline } from "@/components/Charts";
import MealList from "@/components/MealList";
import { deleteReading, listMeals, listReadings, saveReading, uid } from "@/lib/store";
import { fmtTime, fromLocalInput, toLocalInput } from "@/lib/format";
import { inLastWeek } from "@/lib/glucose";
import type { Meal, Reading } from "@/lib/types";

export default function Page() {
  return <UserProvider><Glucose /></UserProvider>;
}

function Glucose() {
  const { user } = useUser();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [mgdl, setMgdl] = useState("");
  const [when, setWhen] = useState(toLocalInput());
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const [m, r] = await Promise.all([listMeals(user.id), listReadings(user.id)]);
    setMeals(m);
    setReadings(r);
  };
  useEffect(() => { load(); }, [user?.id]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const v = Number(mgdl);
    if (!user || !Number.isFinite(v) || v < 20 || v > 600) return setErr("Enter a reading between 20 and 600 mg/dL.");
    setErr(null);
    await saveReading({ id: uid(), userId: user.id, takenAt: fromLocalInput(when), mgdl: Math.round(v), createdAt: new Date().toISOString() });
    setMgdl("");
    setWhen(toLocalInput());
    load();
  }

  const wk = inLastWeek(readings, (r) => r.takenAt);
  const inRange = wk.filter((r) => r.mgdl >= 70 && r.mgdl <= 180).length;
  const above = wk.filter((r) => r.mgdl > 180).length;
  const below = wk.filter((r) => r.mgdl < 70).length;
  const avg = wk.length ? Math.round(wk.reduce((s, r) => s + r.mgdl, 0) / wk.length) : null;
  const pct = (n: number) => (wk.length ? Math.round((n / wk.length) * 100) : 0);

  return (
    <main className="wrap">
      <div className="stat-grid">
        <div className="stat"><b style={{ color: "var(--good)" }}>{wk.length ? `${pct(inRange)}%` : "–"}</b><span>✓ in range 70–180 (7 d)</span></div>
        <div className="stat"><b>{avg ?? "–"}</b><span>average mg/dL</span></div>
        <div className="stat"><b>{wk.length ? `${pct(above)}%` : "–"}</b><span>▲ above 180</span></div>
        <div className="stat"><b>{wk.length ? `${pct(below)}%` : "–"}</b><span>▼ below 70</span></div>
      </div>
      {below > 0 && <div className="card warn tiny">You had {below} reading{below === 1 ? "" : "s"} below 70 mg/dL this week. Follow your hypo plan and tell your doctor or educator.</div>}
      <div className="card">
        <h1>Glucose readings</h1>
        <p className="muted tiny">From your meter or CGM. Add one just before a meal and one about 2 hours after.</p>
        <form className="row" onSubmit={add}>
          <label style={{ flex: "1 1 120px" }}>mg/dL<input inputMode="numeric" value={mgdl} onChange={(e) => setMgdl(e.target.value)} placeholder="e.g. 118" /></label>
          <label style={{ flex: "2 1 200px" }}>Time<input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></label>
          <button className="btn" style={{ alignSelf: "end" }}>Add reading</button>
        </form>
        {err && <p style={{ color: "var(--bad)" }}>{err}</p>}
      </div>

      <div className="card">
        <h2>Last 7 days</h2>
        <GlucoseTimeline readings={readings} meals={meals} />
      </div>

      <div className="card">
        <h2>Rise per meal</h2>
        <p className="tiny muted">Rise = highest reading 15–150 min after eating minus the reading up to 60 min before.</p>
        <MealList meals={meals.slice(0, 21)} readings={readings} />
      </div>

      <div className="card">
        <h2>All readings</h2>
        {readings.length === 0 && <p className="muted">None yet.</p>}
        <table>
          <tbody>
            {readings.slice(0, 50).map((r) => (
              <tr key={r.id}>
                <td>{fmtTime(r.takenAt)}</td>
                <td><b>{r.mgdl}</b> mg/dL</td>
                <td style={{ textAlign: "right" }}><button className="btn danger small" onClick={async () => { await deleteReading(r.id); load(); }}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
