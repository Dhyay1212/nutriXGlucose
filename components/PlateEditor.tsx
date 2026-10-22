"use client";
import { DISH_BY_ID, PORTION_OPTIONS, UNIT_LABEL, nutritionFor, sourceLabel } from "@/lib/dishes";
import { blankDraft, type Draft } from "@/lib/analyzeClient";
import DishPicker from "@/components/DishPicker";

/** Editable list of dishes + portions (after a photo, text, voice or manual start). */
export default function PlateEditor({ items, setItems, title = "Check the dishes", badge, notes = [] }: {
  items: Draft[];
  setItems: (fn: (xs: Draft[]) => Draft[]) => void;
  title?: string;
  badge?: React.ReactNode;
  notes?: (string | null | undefined)[];
}) {
  const update = (key: string, patch: Partial<Draft>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const aiNumbers = items.some((i) => DISH_BY_ID[i.dishId]?.source === "AI estimate");
  return (
    <div className="card">
      <div className="row between">
        <h2 style={{ margin: 0 }}>{title}</h2>
        {badge}
      </div>
      <p className="muted tiny">
        Fix anything that’s wrong. {aiNumbers ? "Numbers marked AI estimate are for the portion you showed or described; the closest Indian Nutrient Databank (INDB) dish is noted. " : ""}Dishes you pick by search use INDB values.
      </p>
      {notes.filter(Boolean).map((n, i) => <p key={i} className="tiny muted">{n}</p>)}

      {items.map((it) => {
        const d = DISH_BY_ID[it.dishId];
        const opts = d ? PORTION_OPTIONS[d.unit] : [];
        const n = d ? nutritionFor(it.dishId, it.portion) : null;
        const saw = it.via === "detector" ? "Detector saw" : it.via === "text" ? "You said" : "AI saw";
        return (
          <div className="item" key={it.key}>
            <div>
              <DishPicker value={it.dishId} fallbackName={it.aiName} onPick={(id) => {
                const nd = DISH_BY_ID[id];
                const allowed = nd ? PORTION_OPTIONS[nd.unit] : [1];
                update(it.key, { dishId: id, name: nd?.name ?? it.name, matched: !!nd, portion: allowed.includes(it.portion) ? it.portion : 1 });
              }} />
              <div className="tiny muted" style={{ marginTop: 4 }}>
                {it.aiName && <>{saw} “{it.aiName}”{it.confidence != null && it.via !== "text" && ` · ${Math.round(it.confidence * 100)}% sure`} · </>}
                {n && d ? <>{n.grams ? `${n.grams} g · ` : ""}{n.carbs} g carbs · {n.kcal} kcal · <span title={d.sourceName} className={d.source === "AI estimate" ? "pill warn" : undefined}>{sourceLabel(d)}</span>{it.note && <div style={{ color: "var(--accent)", marginTop: 2 }}>{it.note}</div>}</> : <span style={{ color: "var(--bad)" }}>Not found yet: pick the closest dish</span>}
              </div>
            </div>
            <button className="btn danger small" onClick={() => setItems((xs) => xs.filter((x) => x.key !== it.key))}>Remove</button>
            {d && (
              <div className="controls">
                <span className="tiny muted">{UNIT_LABEL[d.unit]}</span>
                {opts.map((p) => (
                  <button key={p} className={"chip" + (it.portion === p ? " on" : "")} onClick={() => update(it.key, { portion: p })}>
                    {p === 0.5 ? "½" : p === 1.5 ? "1½" : p}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <button className="btn ghost small" style={{ marginTop: 8 }} onClick={() => setItems((xs) => [...xs, blankDraft()])}>+ Add a dish</button>
    </div>
  );
}
