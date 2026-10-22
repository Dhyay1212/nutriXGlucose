"use client";
import type { Meal, Reading } from "@/lib/types";
import { riseForMeal } from "@/lib/glucose";
import { DISH_BY_ID } from "@/lib/dishes";
import { fmtTime, itemPortionLabel } from "@/lib/format";
import { mealLoad } from "@/lib/impact";
import { BandChip } from "./Viz";
import { TAG_BY_ID } from "@/lib/tags";

export default function MealList({ meals, readings, onDelete }: { meals: Meal[]; readings: Reading[]; onDelete?: (id: string) => void }) {
  if (!meals.length) return <p className="muted">No meals logged yet. Tap the camera button to snap your first plate.</p>;
  return (
    <div>
      {meals.map((m) => {
        const r = riseForMeal(m, readings);
        const load = mealLoad(m);
        const ageMin = (Date.now() - new Date(m.eatenAt).getTime()) / 60000;
        return (
          <div className="meal" key={m.id}>
            {m.photo ? <img className="thumb" src={m.photo} alt="" /> : <div className="thumb">🍽️</div>}
            <div style={{ minWidth: 0 }}>
              <div className="meal-title">{m.items.map((i) => `${i.name} ${itemPortionLabel(i.portion, DISH_BY_ID[i.dishId])}`).join(" · ")}</div>
              <div className="row" style={{ gap: 6, marginTop: 4 }}>
                <BandChip gl={load.gl} label={`Load ${Math.round(load.gl)}`} />
                <span className="tiny muted">{fmtTime(m.eatenAt)}</span>
                {(m.tags ?? []).length > 0 && <span className="tiny" title={(m.tags ?? []).map((t) => TAG_BY_ID[t]?.label).join(", ")}>{(m.tags ?? []).map((t) => TAG_BY_ID[t]?.icon).join(" ")}</span>}
                {onDelete && <button className="linkbtn" onClick={() => confirm("Delete this meal?") && onDelete(m.id)} aria-label="Delete meal">Delete</button>}
              </div>
            </div>
            <div className="rise">
              {r.rise != null ? (
                <>
                  <b>{r.rise >= 0 ? "+" : ""}{r.rise}</b>
                  <div className="tiny muted">mg/dL</div>
                </>
              ) : (
                <span className="pill grey">{r.pre == null ? "no pre-meal" : ageMin < 150 ? "2-h reading due" : "no 2-h reading"}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
