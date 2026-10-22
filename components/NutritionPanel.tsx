"use client";
import { useEffect, useState } from "react";
import { fmtNutrient, glucoseMetrics, loadMicros, mealNutrition, NUTRIENT_BY_KEY, type NutrientKey } from "@/lib/nutrients";
import type { MealItem } from "@/lib/types";

type Items = Pick<MealItem, "dishId" | "portion">[];
// Short list: the nutrients that matter most for glucose and everyday diabetes care.
const SHORT: NutrientKey[] = ["kcal", "carbs", "sugar", "fibre", "protein", "fat", "sodium", "potassium", "iron"];

/** Compact nutrition for a plate: 3 glucose tiles + key nutrients that have a value. */
export default function NutritionPanel({ items, title = "Nutrition" }: { items: Items; title?: string; defaultOpen?: boolean }) {
  const [micros, setMicros] = useState<Awaited<ReturnType<typeof loadMicros>> | null>(null);
  useEffect(() => { loadMicros().then(setMicros).catch(() => {}); }, []);
  if (!items.length) return null;

  const n = mealNutrition(items, micros);
  const g = glucoseMetrics(items, n.totals, n.grams);
  const rows = SHORT.map((k) => NUTRIENT_BY_KEY[k]).filter((m) => (n.totals[m.key] ?? 0) > 0);

  const tiles: { label: string; value: string; hint: string }[] = [
    { label: "Avg GI (est.)", value: g.gi != null ? String(g.gi) : "–", hint: "carb-weighted, by dish type" },
    { label: "Net carbs", value: fmtNutrient(n.totals.netCarbs, "g"), hint: "carbs − fibre" },
    { label: "Energy from carbs", value: g.carbEnergyPct != null ? `${g.carbEnergyPct}%` : "–", hint: "of this plate’s kcal" },
  ];

  return (
    <div className="nutri">
      <div className="card-head" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <span className="tiny muted">{n.grams ? `~${Math.round(n.grams)} g` : ""}</span>
      </div>
      <div className="mini-grid three">
        {tiles.map((t) => (
          <div className="mini" key={t.label} title={t.hint}><b>{t.value}</b><span>{t.label}</span></div>
        ))}
      </div>
      <table className="nutri-table">
        <tbody>
          {rows.map((m) => {
            const v = n.totals[m.key];
            const pct = v != null && m.ref ? Math.round((v / m.ref) * 100) : null;
            return (
              <tr key={m.key}>
                <td style={{ paddingLeft: m.key === "sugar" || m.key === "fibre" ? 18 : 6 }}>{m.label}{m.limit && <span className="limit">limit</span>}</td>
                <td className="num">{fmtNutrient(v, m.unit)}</td>
                <td className="bar-cell">
                  {pct != null && (
                    <div className="dv" title={`${pct}% of the daily ${m.limit ? "upper guide" : "reference"} (${m.ref} ${m.unit})`}>
                      <span style={{ width: `${Math.min(100, pct)}%`, background: m.limit ? (pct > 33 ? "var(--accent)" : "var(--faint)") : "var(--s3)" }} />
                    </div>
                  )}
                </td>
                <td className="num pct">{pct != null ? `${pct}%` : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="tiny muted" style={{ margin: "6px 0 0" }}>% of a daily reference for an adult (“limit” = upper guide). Estimates, not medical advice.</p>
    </div>
  );
}
