"use client";
import { useEffect, useState } from "react";
import UserProvider, { useUser } from "@/components/UserProvider";
import { DishRiseChart } from "@/components/Charts";
import { listMeals, listNotes, listReadings, saveNote, uid } from "@/lib/store";
import { dishStats, inLastWeek, riseForMeal, startOfWeek, MIN_INSTANCES } from "@/lib/glucose";
import { fmtTime } from "@/lib/format";
import type { Meal, Note, Reading } from "@/lib/types";

export default function Page() {
  return <UserProvider><Insights /></UserProvider>;
}

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
  const withRise = week.filter((m) => riseForMeal(m, readings).rise != null).length;

  async function generate() {
    if (!user) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/insight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userName: user.name, stats, meals: week.length, mealsWithRise: withRise, readings: inLastWeek(readings, (r) => r.takenAt).length }),
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
      <div className="card">
        <h1>Your patterns (last 7 days)</h1>
        <p className="muted tiny">
          Each bar is the average glucose rise after meals that included that dish. Meals are mixed, so this shows associations, not causes.
          Dishes need {MIN_INSTANCES}+ meals with readings before we describe a pattern.
        </p>
        <DishRiseChart stats={stats} />
      </div>

      <div className="card">
        <div className="row between">
          <h2 style={{ margin: 0 }}>Weekly note</h2>
          <button className="btn small" disabled={busy} onClick={generate}>{busy ? "Writing…" : "Write this week's note"}</button>
        </div>
        {err && <p style={{ color: "var(--bad)" }}>{err}</p>}
        {notes[0] ? (
          <>
            <p className="tiny muted">{fmtTime(notes[0].createdAt)}</p>
            <div className="note">{notes[0].text}</div>
          </>
        ) : (
          <p className="muted">No note yet.</p>
        )}
      </div>
    </main>
  );
}
