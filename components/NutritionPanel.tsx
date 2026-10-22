"use client";
import { useEffect, useState } from "react";
import { fmtNutrient, glucoseMetrics, loadMicros, mealNutrition, NUTRIENTS, type NutrientMeta } from "@/lib/nutrients";
import type { MealItem } from "@/lib/types";

type Items = Pick<MealItem, "dishId" | "portion">[];
const GROUPS: NutrientMeta["group"][] = ["Energy & macros", "Fats", "Minerals", "Vitamins"];

/** Full nutrition label for a plate (or a day): glucose metrics + 35 nutrients with % of daily reference. */
export default function NutritionPanel({ items, title = "Full nutrition", defaultOpen = false }: { items: Items; title?: string; defaultOpen?: boolean }) {
  const [micros, setMicros] = useState<Awaited<ReturnType<typeof loadMicros>> | null>(null);
  const [all, setAll] = useState(defaultOpen);
  useEffect(() => { loadMicros().then(setMicros).catch(() => {}); }, []);
  if (!items.length) return null;

  const n = mealNutrition(items, micros);
  const g = glucoseMetrics(items, n.totals, n.grams);
  const shownGroups = all ? GROUPS : GROUPS.slice(0, 2);
  const microItems = n.coverage.sodium ?? 0;

  const tiles: { label: string; value: string; hint: string }[] = [
    { label: "Avg GI (est.)", value: g.gi != null ? String(g.gi) : "–", hint: "carb-weighted, by dish type" },
    { label: "Net carbs", value: fmtNutrient(n.totals.netCarbs, "g"), hint: "carbs − fibre" },
    { label: "Energy from carbs", value: g.carbEnergyPct != null ? `${g.carbEnergyPct}%` : "–", hint: "of this plate’s kcal" },
    { label: "Protein per g carb", value: g.proteinPerCarb != null ? String(g.proteinPerCarb) : "–", hint: "higher slows the rise" },
    { label: "Fibre / 100 kcal", value: g.fibrePer100kcal != null ? `${g.fibrePer100kcal} g` : "–", hint: "higher is gentler" },
    { label: "Energy density", value: g.energyDensity != null ? `${g.energyDensity} kcal/g` : "–", hint: "kcal per gram of food" },
  ];

  return (
    <div className="nutri">
      <div className="card-head" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <span className="tiny muted">{n.grams ? `~${Math.round(n.grams)} g · ` : ""}{Math.round(n.totals.kcal ?? 0)} kcal</span>
      </div>
      <div className="mini-grid">
        {tiles.map((t) => (
          <div className="mini" key={t.label} title={t.hint}><b>{t.value}</b><span>{t.label}</span></div>
        ))}
      </div>

      {shownGroups.map((grp) => (
        <div key={grp}>
          <div className="nutri-group">{grp}</div>
          <table className="nutri-table">
            <tbody>
              {NUTRIENTS.filter((m) => m.group === grp).map((m) => {
                const v = n.totals[m.key];
                const pct = v != null && m.ref ? Math.round((v / m.ref) * 100) : null;
                return (
                  <tr key={m.key}>
                    <td style={{ paddingLeft: m.indent ? 18 : 6 }}>{m.label}{m.limit && <span className="limit">limit</span>}</td>
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
        </div>
      ))}
      <button className="linkbtn" style={{ marginTop: 6, fontSize: ".85rem" }} onClick={() => setAll(!all)}>
        {all ? "Show fewer nutrients" : `Show all ${NUTRIENTS.length} nutrients (minerals & vitamins)`}
      </button>
      <p className="tiny muted" style={{ margin: "6px 0 0" }}>
        % = share of a daily reference for a 2,000 kcal adult (Codex food-label values; “limit” = upper guide). Minerals and vitamins: {microItems} of {n.items} dish{n.items === 1 ? "" : "es"} have data (INDB or AI estimate). Estimates, not medical advice.
      </p>
    </div>
  );
}
