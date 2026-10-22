"use client";
import { useEffect, useState } from "react";
import UserProvider, { useUser } from "@/components/UserProvider";
import { GlucoseTimeline } from "@/components/Charts";
import MealList from "@/components/MealList";
import { addReadings, deleteReading, listMeals, listReadings, saveReading, uid } from "@/lib/store";
import { dedupe, parseGlucoseCsv, type ParseResult } from "@/lib/cgm";
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
  const [csv, setCsv] = useState<{ name: string; text: string; res: ParseResult; fresh: number } | null>(null);
  const [csvMsg, setCsvMsg] = useState<string | null>(null);

  function readCsv(f: File | undefined, dayFirst?: boolean, textIn?: string, nameIn?: string) {
    setCsvMsg(null);
    const go = (text: string, name: string) => {
      try {
        const res = parseGlucoseCsv(text, dayFirst);
        setCsv({ name, text, res, fresh: dedupe(res.readings, readings).length });
      } catch (e: any) { setCsv(null); setCsvMsg(e.message); }
    };
    if (textIn != null) return go(textIn, nameIn ?? "file");
    if (!f) return;
    f.text().then((t) => go(t, f.name));
  }
  async function importCsv() {
    if (!user || !csv) return;
    const fresh = dedupe(csv.res.readings, readings);
    await addReadings(fresh.map((r) => ({ id: uid(), userId: user.id, takenAt: r.takenAt, mgdl: r.mgdl, createdAt: new Date().toISOString() })));
    setCsvMsg(`Imported ${fresh.length} readings. Meals in that period now show their measured rise.`);
    setCsv(null);
    load();
  }

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
        <div className="card-head"><h2>Import from a CGM or meter</h2><span className="tiny muted">CSV</span></div>
        <p className="tiny muted" style={{ marginTop: 0 }}>FreeStyle Libre: LibreView → Glucose History → Download. Dexcom: Clarity → Export. Or any CSV with a time and a glucose column (mg/dL or mmol/L).</p>
        <input type="file" accept=".csv,text/csv,.txt" onChange={(e) => readCsv(e.target.files?.[0])} />
        {csv && (
          <div className="stack" style={{ marginTop: 10 }}>
            <div className="stat flat">
              <b style={{ fontSize: "1.1rem" }}>{csv.res.readings.length} readings · {csv.res.format}</b>
              <span>{csv.res.from && new Date(csv.res.from).toLocaleString("en-IN")} → {csv.res.to && new Date(csv.res.to).toLocaleString("en-IN")} · {csv.res.unit}{csv.res.unit === "mmol/L" ? " (converted to mg/dL)" : ""} · {csv.fresh} new, {csv.res.readings.length - csv.fresh} already here{csv.res.skipped ? ` · ${csv.res.skipped} rows skipped` : ""}</span>
            </div>
            <label className="row" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={csv.res.dayFirst} onChange={(e) => readCsv(undefined, e.target.checked, csv.text, csv.name)} />
              Dates are day-first (DD-MM-YYYY)
            </label>
            <button className="btn" disabled={!csv.fresh} onClick={importCsv}>Import {csv.fresh} readings</button>
          </div>
        )}
        {csvMsg && <p className="tiny" style={{ marginBottom: 0 }}>{csvMsg}</p>}
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
