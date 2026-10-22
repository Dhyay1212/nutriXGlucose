"use client";
import { useState } from "react";
import UserProvider, { ConsentText, useUser } from "@/components/UserProvider";
import { authEnabled, deleteUserData, exportUserData, signOut } from "@/lib/store";
import { mealLoad } from "@/lib/impact";
import { riseForMeal } from "@/lib/glucose";
import { download, toCsv } from "@/lib/csv";

export default function Page() {
  return <UserProvider allowAnonymous><Privacy /></UserProvider>;
}

function Privacy() {
  const { user, authEmail } = useUser();
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function exportJson() {
    if (!user) return;
    const data = await exportUserData(user.id);
    download(`nutrix-${user.id}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), "application/json");
  }
  async function exportCsv() {
    if (!user) return;
    const d = await exportUserData(user.id);
    const meals = toCsv(
      ["eaten_at", "dishes", "carbs_g", "kcal", "protein_g", "fat_g", "fibre_g", "glucose_load", "pre_mgdl", "peak_mgdl", "rise_mgdl", "tags"],
      d.meals.map((m) => {
        const r = riseForMeal(m, d.readings);
        return [m.eatenAt, m.items.map((i) => `${i.name} x${i.portion}`).join("; "), m.totals.carbs, m.totals.kcal, m.totals.protein, m.totals.fat, m.totals.fibre, mealLoad(m).gl, r.pre, r.peak, r.rise, (m.tags ?? []).join(" ")];
      })
    );
    download(`nutrix-${user.id}-meals.csv`, meals);
    download(`nutrix-${user.id}-readings.csv`, toCsv(["taken_at", "mgdl"], d.readings.map((r) => [r.takenAt, r.mgdl])));
  }
  async function del() {
    if (!user || confirm.trim().toUpperCase() !== user.id) return;
    await deleteUserData(user.id);
    setMsg("All your data has been deleted from " + (authEnabled ? "the pilot database." : "this browser."));
    if (authEnabled) await signOut();
    setTimeout(() => (window.location.href = "/"), 1500);
  }

  return (
    <main className="wrap">
      <div>
        <h1>Privacy &amp; data</h1>
        <p className="muted tiny" style={{ margin: 0 }}>{user ? <>Signed in as <b>{user.id} · {user.name}</b>{authEmail ? ` (${authEmail})` : ""}. Agreed {user.consentAt ? new Date(user.consentAt).toLocaleDateString("en-IN") : "—"}.</> : "No participant selected."}</p>
      </div>
      <section className="card">
        <h2>What NutriX collects</h2>
        <ConsentText />
      </section>
      {user && (
        <>
          <section className="card stack">
            <h2>Download your data</h2>
            <p className="tiny muted" style={{ margin: 0 }}>Everything we hold about you. The CSV files open in Excel or Google Sheets.</p>
            <div className="row">
              <button className="btn ghost" onClick={exportCsv}>Download CSV (meals + readings)</button>
              <button className="btn ghost" onClick={exportJson}>Download everything (JSON)</button>
            </div>
          </section>
          <section className="card stack" style={{ borderColor: "var(--crit)" }}>
            <h2>Delete your data</h2>
            <p className="tiny muted" style={{ margin: 0 }}>Removes your profile, meals, photos, readings, notes and educator notes. This can’t be undone. Type your pilot ID <b>{user.id}</b> to confirm.</p>
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={user.id} />
            <button className="btn" style={{ background: "var(--crit)", color: "#fff" }} disabled={confirm.trim().toUpperCase() !== user.id} onClick={del}>Delete all my data</button>
            {msg && <p className="tiny">{msg}</p>}
          </section>
          {authEnabled && <button className="btn ghost" onClick={async () => { await signOut(); window.location.href = "/"; }}>Sign out</button>}
        </>
      )}
    </main>
  );
}
