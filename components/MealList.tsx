"use client";
import type { Meal, Reading } from "@/lib/types";
import { riseForMeal } from "@/lib/glucose";
import { DISH_BY_ID } from "@/lib/dishes";
import { fmtTime, portionLabel } from "@/lib/format";

export default function MealList({ meals, readings, onDelete }: { meals: Meal[]; readings: Reading[]; onDelete?: (id: string) => void }) {
  if (!meals.length) return <p className="muted">No meals logged yet.</p>;
  return (
    <div>
      {meals.map((m) => {
        const r = riseForMeal(m, readings);
        const ageMin = (Date.now() - new Date(m.eatenAt).getTime()) / 60000;
        return (
          <div className="meal" key={m.id}>
            {m.photo ? <img className="thumb" src={m.photo} alt="" /> : <div className="thumb">🍽️</div>}
            <div>
              <div className="tiny muted">{fmtTime(m.eatenAt)} · {m.totals.carbs} g carbs · {m.totals.kcal} kcal</div>
              <div>{m.items.map((i) => `${i.name} (${portionLabel(i.portion, DISH_BY_ID[i.dishId]?.unit ?? "katori")})`).join(", ")}</div>
              {onDelete && <button className="btn danger small" style={{ marginTop: 6 }} onClick={() => confirm("Delete this meal?") && onDelete(m.id)}>Delete</button>}
            </div>
            <div className="rise">
              {r.rise != null ? (
                <>
                  <b>{r.rise >= 0 ? "+" : ""}{r.rise}</b>
                  <div className="tiny muted">mg/dL rise</div>
                </>
              ) : (
                <span className="pill grey">{r.pre == null ? "need pre-meal reading" : ageMin < 150 ? "add 2-h reading" : "no 2-h reading"}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
