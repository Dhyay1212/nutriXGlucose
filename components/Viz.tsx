"use client";
// Small SVG charts for NutriX Glucose. Every mark carries a <title> for hover/long-press tooltips.
import { BAND_LABEL, BAND_LIMITS, bandFor, type Band, type Calibration } from "@/lib/impact";

const BAND_VAR: Record<Band, string> = { low: "var(--good)", moderate: "var(--warn)", high: "var(--crit)" };

export function BandChip({ gl, label }: { gl: number; label?: string }) {
  const b = bandFor(gl);
  return <span className={`band ${b}`}><i />{label ?? BAND_LABEL[b]}</span>;
}

/** Horizontal gauge: low | moderate | high, with a marker at the meal's load. */
export function LoadMeter({ gl, max = 60 }: { gl: number; max?: number }) {
  const pos = Math.min(100, (gl / max) * 100);
  return (
    <div>
      <div className="meter" role="img" aria-label={`Glucose load ${gl}, ${BAND_LABEL[bandFor(gl)]}`}
        style={{ gridTemplateColumns: `${BAND_LIMITS.low}fr ${BAND_LIMITS.high - BAND_LIMITS.low}fr ${max - BAND_LIMITS.high}fr` }}>
        <span /><span /><span />
        <div className="marker" style={{ left: `${pos}%` }} />
      </div>
      <div className="meter-scale"><span>0</span><span>{BAND_LIMITS.low}</span><span>{BAND_LIMITS.high}</span><span>{max}+</span></div>
    </div>
  );
}

/** Progress ring (e.g. time in range). */
export function Ring({ value, size = 92, stroke = 10, label, sub, color = "currentColor", track = "rgba(255,255,255,.25)" }: { value: number; size?: number; stroke?: number; label: string; sub?: string; color?: string; track?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, value));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label} ${sub ?? ""}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="48%" textAnchor="middle" fontSize="20" fontWeight="750" fill={color}>{label}</text>
      {sub && <text x="50%" y="66%" textAnchor="middle" fontSize="10.5" fill={color} opacity=".85">{sub}</text>}
    </svg>
  );
}

/** 100% stacked bar of where the energy came from (carbs / protein / fat), with legend. */
export function MacroBar({ carbs, protein, fat }: { carbs: number; protein: number; fat: number }) {
  const kc = carbs * 4, kp = protein * 4, kf = fat * 9, tot = kc + kp + kf;
  if (!tot) return <p className="muted tiny">Nothing logged yet.</p>;
  const parts = [
    { k: "Carbs", g: carbs, v: kc, c: "var(--s1)" },
    { k: "Protein", g: protein, v: kp, c: "var(--s3)" },
    { k: "Fat", g: fat, v: kf, c: "var(--s2)" },
  ];
  let x = 0;
  return (
    <div>
      <svg className="chart" viewBox="0 0 300 18" preserveAspectRatio="none" style={{ height: 18 }} role="img" aria-label="Energy split by macronutrient">
        {parts.map((p) => {
          const w = (p.v / tot) * 300, el = (
            <rect key={p.k} className="mark" x={x + (x ? 1 : 0)} y="0" width={Math.max(0, w - (x ? 1 : 0))} height="18" fill={p.c} rx="4">
              <title>{`${p.k}: ${Math.round(p.g)} g · ${Math.round((p.v / tot) * 100)}% of energy`}</title>
            </rect>
          );
          x += w;
          return el;
        })}
      </svg>
      <div className="legend">
        {parts.map((p) => <span key={p.k}><i style={{ background: p.c }} />{p.k} {Math.round(p.g)} g · {Math.round((p.v / tot) * 100)}%</span>)}
      </div>
    </div>
  );
}

/** Daily total glucose load for the last 7 days, bars coloured by the day's highest meal band. */
export function DailyLoadChart({ days }: { days: { label: string; gl: number; meals: number; maxMealGl: number }[] }) {
  const W = 340, H = 170, L = 28, B = 24, T = 10;
  const max = Math.max(60, ...days.map((d) => d.gl)) * 1.1;
  const bw = (W - L) / days.length;
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const ticks = [0, Math.round(max / 2 / 10) * 10, Math.round(max / 10) * 10].filter((v, i, a) => a.indexOf(v) === i);
  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Daily glucose load, last 7 days">
        {ticks.map((t) => (
          <g key={t}><line x1={L} x2={W} y1={y(t)} y2={y(t)} stroke="var(--grid)" /><text x={L - 6} y={y(t) + 4} textAnchor="end">{t}</text></g>
        ))}
        {days.map((d, i) => {
          const h = y(0) - y(d.gl);
          return (
            <g key={i}>
              {d.gl > 0 && (
                <rect className="mark" x={L + i * bw + bw * 0.22} y={y(d.gl)} width={bw * 0.56} height={Math.max(2, h)} rx="5" fill="var(--s1)">
                  <title>{`${d.label}: total load ${Math.round(d.gl)} from ${d.meals} meal${d.meals === 1 ? "" : "s"}; highest meal ${Math.round(d.maxMealGl)} (${BAND_LABEL[bandFor(d.maxMealGl)]})`}</title>
                </rect>
              )}
              {d.gl > 0 && <circle cx={L + i * bw + bw / 2} cy={y(d.gl) - 9} r="4" fill={BAND_VAR[bandFor(d.maxMealGl)]}><title>{`Highest meal: ${BAND_LABEL[bandFor(d.maxMealGl)]}`}</title></circle>}
              <text x={L + i * bw + bw / 2} y={H - 6} textAnchor="middle">{d.label}</text>
            </g>
          );
        })}
        <line x1={L} x2={W} y1={y(0)} y2={y(0)} stroke="var(--grey)" />
      </svg>
      <div className="legend">
        <span><i style={{ background: "var(--s1)" }} />daily load (sum of meals)</span>
        <span><i style={{ background: "var(--good)", borderRadius: 9 }} />dot = highest meal: low</span>
        <span><i style={{ background: "var(--warn)", borderRadius: 9 }} />moderate</span>
        <span><i style={{ background: "var(--crit)", borderRadius: 9 }} />high</span>
      </div>
    </>
  );
}

/** Measured rise vs meal glucose load, with the person's fitted line. */
export function ScatterFit({ cal }: { cal: Calibration }) {
  const W = 340, H = 230, L = 34, B = 30, T = 24, R = 10;
  const pts = cal.points;
  const xmax = Math.max(40, ...pts.map((p) => p.gl)) * 1.1;
  const ymax = Math.max(60, ...pts.map((p) => p.rise)) * 1.1;
  const x = (v: number) => L + (v / xmax) * (W - L - R);
  const y = (v: number) => T + (1 - v / ymax) * (H - T - B);
  const xt = [0, Math.round(xmax / 2), Math.round(xmax)];
  const yt = [0, Math.round(ymax / 2), Math.round(ymax)];
  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Measured glucose rise against meal glucose load">
        {yt.map((t) => <g key={"y" + t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--grid)" /><text x={L - 6} y={y(t) + 4} textAnchor="end">{t}</text></g>)}
        {xt.map((t) => <text key={"x" + t} x={x(t)} y={H - 12} textAnchor="middle">{t}</text>)}
        <text x={(W + L) / 2} y={H} textAnchor="middle">meal glucose load →</text>
        <text x={4} y={10} fontSize="10">mg/dL rise ↑</text>
        {cal.ready && cal.k != null && (
          <line x1={x(0)} y1={y(0)} x2={x(Math.min(xmax, ymax / cal.k))} y2={y(Math.min(ymax, cal.k * xmax))} stroke="var(--s2)" strokeWidth="2" strokeDasharray="5 4">
            <title>{`Your model: rise ≈ ${cal.k} × load`}</title>
          </line>
        )}
        {pts.map((p) => (
          <circle key={p.mealId} className="mark" cx={x(p.gl)} cy={y(p.rise)} r="5.5" fill="var(--s1)" stroke="var(--card)" strokeWidth="2">
            <title>{`${new Date(p.when).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}: load ${p.gl}, measured rise +${p.rise} mg/dL`}</title>
          </circle>
        ))}
      </svg>
      <div className="legend">
        <span><i style={{ background: "var(--s1)", borderRadius: 9 }} />a measured meal</span>
        {cal.ready && <span><i style={{ background: "var(--s2)", height: 3 }} />your fitted line</span>}
      </div>
    </>
  );
}

/** Expected glucose curve after a meal (mg/dL above the pre-meal level). */
export function CurveChart({ pts, peak, tp }: { pts: { t: number; v: number }[]; peak: number; tp: number }) {
  const W = 340, H = 150, L = 30, B = 24, T = 14, R = 8;
  const ymax = Math.max(40, peak * 1.25);
  const x = (t: number) => L + (t / 180) * (W - L - R);
  const y = (v: number) => T + (1 - v / ymax) * (H - T - B);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(180)} ${y(0)} L${x(0)} ${y(0)} Z`;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Expected rise peaking at about ${peak} mg/dL after ${tp} minutes`}>
      {[0, 60, 120, 180].map((t) => <g key={t}><line x1={x(t)} x2={x(t)} y1={T} y2={y(0)} stroke="var(--grid)" /><text x={x(t)} y={H - 6} textAnchor="middle">{t === 0 ? "meal" : `${t / 60} h`}</text></g>)}
      <path d={area} fill="var(--s1)" opacity=".14" />
      <path d={line} fill="none" stroke="var(--s1)" strokeWidth="2.5" />
      <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="var(--grey)" />
      <circle cx={x(tp)} cy={y(peak)} r="5" fill="var(--s1)" stroke="var(--card)" strokeWidth="2"><title>{`Peak ≈ +${peak} mg/dL at ~${tp} min`}</title></circle>
      <text x={x(tp) + 9} y={y(peak) + 4} className="ink" fontWeight="650" fontSize="12">+{peak} mg/dL</text>
    </svg>
  );
}

/** Average measured rise by time of day (one series, so one colour). */
export function MealTimeBars({ rows }: { rows: { label: string; avg: number | null; n: number }[] }) {
  const has = rows.filter((r) => r.avg != null);
  if (!has.length) return <p className="muted tiny">Needs meals with readings.</p>;
  const W = 340, rowH = 34, L = 86, R = 70;
  const max = Math.max(40, ...has.map((r) => r.avg!));
  const x = (v: number) => L + (v / max) * (W - L - R);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${rows.length * rowH + 6}`} role="img" aria-label="Average rise by time of day">
      {rows.map((r, i) => {
        const yy = i * rowH + 6;
        return (
          <g key={r.label}>
            <text x={L - 8} y={yy + 16} textAnchor="end" className="ink" fontSize="12">{r.label}</text>
            {r.avg != null ? (
              <>
                <rect className="mark" x={L} y={yy + 4} width={Math.max(3, x(r.avg) - L)} height="16" rx="5" fill="var(--s1)"><title>{`${r.label}: average +${r.avg} mg/dL over ${r.n} meals`}</title></rect>
                <text x={x(r.avg) + 6} y={yy + 16} className="ink" fontSize="12" fontWeight="650">+{r.avg} <tspan fill="var(--faint)" fontWeight="400">n={r.n}</tspan></text>
              </>
            ) : <text x={L} y={yy + 16} fontSize="11">no readings yet</text>}
          </g>
        );
      })}
    </svg>
  );
}

/** Diverging bars: mg/dL vs the person's usual rise. Left (lower) is gentler, right (higher) is bigger. Labels carry the sign. */
export function EffectBars({ rows }: { rows: { label: string; effect: number; n: number; strength: string }[] }) {
  if (!rows.length) return null;
  // Each habit gets its own line of text, with a diverging bar underneath, so labels never collide with bars.
  const W = 340, rowH = 48, mid = 170, half = 120;
  const max = Math.max(20, ...rows.map((r) => Math.abs(r.effect)));
  const x = (v: number) => mid + (v / max) * half;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${rows.length * rowH + 22}`} role="img" aria-label="Effect of each habit on your glucose rise">
      <line x1={mid} x2={mid} y1="16" y2={rows.length * rowH} stroke="var(--grey)" />
      <text x={mid - 6} y={rows.length * rowH + 16} textAnchor="end">← smaller rise</text>
      <text x={mid + 6} y={rows.length * rowH + 16}>bigger rise →</text>
      {rows.map((r, i) => {
        const y = i * rowH;
        const good = r.effect < 0;
        const x0 = Math.min(x(r.effect), mid), w = Math.max(3, Math.abs(x(r.effect) - mid));
        return (
          <g key={r.label}>
            <text x={4} y={y + 13} className="ink" fontSize="11.5" fontWeight="600">{r.label}<tspan fontWeight="400" fill="var(--faint)" fontSize="10">{`  ${r.strength} · ${r.n} meals`}</tspan></text>
            <rect className="mark" x={x0} y={y + 20} width={w} height="16" rx="5" fill={good ? "var(--good)" : "var(--crit)"} opacity=".85">
              <title>{`${r.label}: ${r.effect > 0 ? "+" : ""}${r.effect} mg/dL vs your usual rise (${r.n} meals, ${r.strength})`}</title>
            </rect>
            <text x={good ? x0 - 5 : x0 + w + 5} y={y + 32} textAnchor={good ? "end" : "start"} className="ink" fontSize="11.5" fontWeight="650">{r.effect > 0 ? "+" : "−"}{Math.abs(r.effect)} mg/dL</text>
          </g>
        );
      })}
    </svg>
  );
}
