"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import UserProvider, { useUser } from "@/components/UserProvider";
import UserSwitch from "@/components/UserSwitch";
import MealList from "@/components/MealList";
import { deleteMeal, listMeals, listReadings, storageMode } from "@/lib/store";
import { inLastWeek, riseForMeal } from "@/lib/glucose";
import type { Meal, Reading } from "@/lib/types";

export default function Page() {
  return <UserProvider><Home /></UserProvider>;
}

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

  const week = inLastWeek(meals, (m) => m.eatenAt);
  const days = new Set(week.map((m) => new Date(m.eatenAt).toDateString())).size || 1;
  const withRise = week.filter((m) => riseForMeal(m, readings).rise != null);
  const latest = meals.find((m) => riseForMeal(m, readings).rise != null);
  const latestRise = latest ? riseForMeal(latest, readings) : null;

  return (
    <main className="wrap">
      <div className="card"><UserSwitch /></div>

      {latest && latestRise && (
        <div className="card">
          <div className="tiny muted">Your latest meal with readings</div>
          <h2 style={{ margin: ".2rem 0" }}>This meal raised your glucose by {latestRise.rise} mg/dL</h2>
          <div className="muted">{latest.items.map((i) => i.name).join(", ")} · {latestRise.pre} → {latestRise.peak} mg/dL</div>
        </div>
      )}

      <div className="stat-grid">
        <div className="stat"><b>{(week.length / days).toFixed(1)}</b><span>meals logged / day (7 days)</span></div>
        <div className="stat"><b>{week.length}</b><span>meals this week</span></div>
        <div className="stat"><b>{withRise.length}</b><span>meals with a glucose rise</span></div>
      </div>

      <div className="row">
        <Link className="btn" href="/log">📷 Snap a meal</Link>
        <Link className="btn ghost" href="/glucose">+ Add glucose reading</Link>
        <Link className="btn ghost" href="/insights">See patterns</Link>
      </div>

      <div className="card">
        <h2>Recent meals</h2>
        <MealList meals={meals.slice(0, 15)} readings={readings} onDelete={async (id) => { await deleteMeal(id); load(); }} />
      </div>
      {storageMode === "browser" && <p className="tiny muted">Supabase not connected: data is stored in this browser only.</p>}
    </main>
  );
}
