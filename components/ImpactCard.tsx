"use client";
import { curve, loadForItems, MIN_CAL, predictRise, suggestions, type Calibration } from "@/lib/impact";
import { BandChip, CurveChart, LoadMeter, MacroBar } from "@/components/Viz";
import NutritionPanel from "@/components/NutritionPanel";
import type { MealItem } from "@/lib/types";

/** Glucose impact of a plate: load, personal predicted rise + curve, nutrition, gentler swaps. */
export default function ImpactCard({ items, cal, onUse, title = "Glucose impact", children }: {
  items: Pick<MealItem, "dishId" | "portion" | "name">[];
  cal: Calibration | null;
  onUse: (items: MealItem[]) => void;
  title?: string;
  children?: React.ReactNode;
}) {
  const L = loadForItems(items);
  const pred = cal ? predictRise(L.gl, cal) : null;
  const c = pred != null ? curve(pred, L.fat, L.protein) : null;
  const sugg = suggestions(items as MealItem[]);
  return (
    <div className="card stack">
      <div className="card-head" style={{ marginBottom: 0 }}>
        <h2>{title}</h2>
        <BandChip gl={L.gl} />
      </div>
      <div className="row" style={{ alignItems: "baseline", gap: 8 }}>
        <b style={{ fontSize: "2rem", lineHeight: 1 }}>{Math.round(L.gl)}</b>
        <span className="muted tiny">meal glucose load (estimate) · {L.carbs} g carbs, {L.fibre} g fibre</span>
      </div>
      <LoadMeter gl={L.gl} />
      {L.parts.length > 1 && (
        <div className="tiny muted">Biggest contributor: <b style={{ color: "var(--ink)" }}>{L.parts[0].name}</b> ({Math.round(L.parts[0].share * 100)}% of the load)</div>
      )}

      {pred != null && c ? (
        <div>
          <h3 style={{ margin: "4px 0" }}>Your expected rise: about +{pred} mg/dL</h3>
          <p className="tiny muted" style={{ margin: "0 0 6px" }}>Predicted from your own {cal!.n} measured meals ({cal!.k} mg/dL per unit of load). Check it with a reading ~2 h after eating.</p>
          <CurveChart pts={c.pts} peak={pred} tp={c.tp} />
        </div>
      ) : (
        <div className="stat flat">
          <span>Personal prediction unlocks after {MIN_CAL} measured meals ({cal?.n ?? 0} so far). Add a reading before eating and ~2 h after.</span>
        </div>
      )}

      {children}

      <MacroBar carbs={L.carbs} protein={L.protein} fat={L.fat} />
      <NutritionPanel items={items} />

      {sugg.length > 0 && (
        <div>
          <h3 style={{ marginTop: 6 }}>One small change to try</h3>
          {sugg.map((s, i) => (
            <div className="sugg" key={i}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 650, fontSize: ".92rem" }}>{s.title}</div>
                <div className="tiny muted">{s.detail} New load {Math.round(s.gl)}{pred != null && cal?.k ? ` · expected rise ~+${Math.round(cal.k * s.gl)} mg/dL` : ""}.</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="drop-badge">−{s.drop}%</div>
                <button className="btn ghost small" onClick={() => onUse(s.items)}>Use this</button>
              </div>
            </div>
          ))}
          <p className="tiny muted" style={{ margin: "6px 0 0" }}>Suggestions only add or swap; nothing is off-limits. Not medical advice.</p>
        </div>
      )}
    </div>
  );
}
