"use client";
import type { DishStat } from "@/lib/glucose";
import type { Meal, Reading } from "@/lib/types";

/** Horizontal bars: average glucose rise per dish. Grey = fewer than 3 meals with readings. */
export function DishRiseChart({ stats }: { stats: DishStat[] }) {
  const rows = stats.filter((s) => s.avgRise != null);
  if (!rows.length) return <p className="muted">No meals with both a pre-meal and a 2-hour reading yet.</p>;
  const max = Math.max(60, ...rows.map((r) => r.maxRise ?? r.avgRise ?? 0));
  const W = 460, rowH = 30, left = 140, right = 66;
  const H = rows.length * rowH + 24;
  const x = (v: number) => left + (Math.max(0, v) / max) * (W - left - right);
  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Average glucose rise per dish">
        {[0, Math.round(max / 2), Math.round(max)].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={0} y2={H - 18} stroke="var(--line)" />
            <text x={x(t)} y={H - 4} textAnchor="middle">{t}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const y = i * rowH + 4;
          const color = r.enoughData ? "var(--brand)" : "var(--grey)";
          return (
            <g key={r.dishId}>
              <text x={left - 8} y={y + 16} textAnchor="end" style={{ fill: "var(--ink)", fontSize: 12 }}>{r.name.length > 20 ? r.name.slice(0, 19) + "…" : r.name}</text>
              {r.minRise != null && r.maxRise != null && r.timesWithRise > 1 && (
                <line x1={x(r.minRise)} x2={x(r.maxRise)} y1={y + 12} y2={y + 12} stroke={color} strokeOpacity={0.35} strokeWidth={10} strokeLinecap="round" />
              )}
              <rect x={left} y={y + 6} width={Math.max(2, x(r.avgRise!) - left)} height={12} rx={4} fill={color} />
              <text x={x(r.avgRise!) + 6} y={y + 16} style={{ fill: "var(--ink)", fontSize: 12, fontWeight: 600 }}>
                +{r.avgRise} <tspan style={{ fill: "var(--muted)", fontWeight: 400 }}>n={r.timesWithRise}</tspan>
              </text>
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <span><i style={{ background: "var(--brand)" }} />avg rise, mg/dL (3+ meals)</span>
        <span><i style={{ background: "var(--grey)" }} />not enough data (&lt;3 meals)</span>
        <span><i style={{ background: "var(--brand)", opacity: 0.35 }} />range</span>
      </div>
    </>
  );
}

/** Glucose readings over time with meal markers. */
export function GlucoseTimeline({ readings, meals, days = 7 }: { readings: Reading[]; meals: Meal[]; days?: number }) {
  const now = Date.now();
  const from = now - days * 86400000;
  const rs = readings.map((r) => ({ t: new Date(r.takenAt).getTime(), v: r.mgdl })).filter((r) => r.t >= from).sort((a, b) => a.t - b.t);
  const ms = meals.map((m) => new Date(m.eatenAt).getTime()).filter((t) => t >= from);
  if (!rs.length) return <p className="muted">No glucose readings in the last {days} days.</p>;
  const W = 640, H = 200, L = 36, R = 10, T = 10, B = 26;
  const lo = Math.min(70, ...rs.map((r) => r.v)) - 10;
  const hi = Math.max(200, ...rs.map((r) => r.v)) + 10;
  const x = (t: number) => L + ((t - from) / (now - from)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const ticks = Array.from({ length: days + 1 }, (_, i) => {
    const d = new Date(from + i * 86400000);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }).filter((t) => t >= from);
  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Glucose readings with meals">
        <rect x={L} y={y(180)} width={W - L - R} height={y(70) - y(180)} fill="var(--brand-soft)" />
        {[70, 140, 180].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray="3 3" />
            <text x={L - 4} y={y(v) + 4} textAnchor="end">{v}</text>
          </g>
        ))}
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={H - 6} textAnchor="middle">{new Date(t).toLocaleDateString("en-IN", { weekday: "short" })}</text>
        ))}
        {ms.map((t, i) => (
          <line key={i} x1={x(t)} x2={x(t)} y1={T} y2={H - B} stroke="var(--accent)" strokeOpacity={0.6} />
        ))}
        <polyline fill="none" stroke="var(--brand)" strokeWidth={1.5} points={rs.map((r) => `${x(r.t)},${y(r.v)}`).join(" ")} />
        {rs.map((r, i) => (
          <circle key={i} cx={x(r.t)} cy={y(r.v)} r={3} fill="var(--brand)" />
        ))}
      </svg>
      <div className="legend">
        <span><i style={{ background: "var(--brand)" }} />glucose (mg/dL)</span>
        <span><i style={{ background: "var(--accent)" }} />meal</span>
        <span><i style={{ background: "var(--brand-soft)" }} />70–180 band</span>
      </div>
    </>
  );
}
