"use client";
import { useEffect, useRef, useState } from "react";
import { DISH_BY_ID, searchDishes, sourceLabel, UNIT_LABEL } from "@/lib/dishes";

/** Type-to-search dish picker over the full NutriX dish table. */
export default function DishPicker({ value, fallbackName, onPick }: { value: string; fallbackName?: string; onPick: (id: string) => void }) {
  const current = DISH_BY_ID[value];
  const [q, setQ] = useState(current?.name ?? fallbackName ?? "");
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => setQ(current?.name ?? fallbackName ?? ""), [value]);
  useEffect(() => {
    const close = (e: MouseEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const results = open ? searchDishes(q === current?.name ? "" : q) : [];
  return (
    <div className="picker" ref={wrap}>
      <input
        value={q}
        placeholder="Search 1,100+ dishes…"
        onFocus={(e) => { setOpen(true); e.target.select(); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
      />
      {open && (
        <div className="picker-list">
          {results.length === 0 && <div className="picker-empty">No match. Try a simpler name (e.g. “dal”, “dosa”).</div>}
          {results.map((d) => (
            <button key={d.id} type="button" className="picker-item" onClick={() => { onPick(d.id); setQ(d.name); setOpen(false); }}>
              <span>{d.name}</span>
              <span className="tiny muted">{UNIT_LABEL[d.unit].toLowerCase()} · {Math.round(d.perUnit.carbs)} g carbs · {sourceLabel(d)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
