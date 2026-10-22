// CGM / meter CSV import. Handles:
//  - Abbott LibreView export (metadata line, then header with "Device Timestamp", "Historic Glucose mg/dL" / "Scan Glucose mg/dL" or mmol/L)
//  - Dexcom Clarity export ("Timestamp (YYYY-MM-DDThh:mm:ss)", "Glucose Value (mg/dL)", "Event Type" = EGV)
//  - Any simple CSV with a time/date column and a glucose/value column.
export interface ParsedReading { takenAt: string; mgdl: number }
export interface ParseResult {
  readings: ParsedReading[];
  format: "LibreView" | "Dexcom Clarity" | "Generic CSV";
  unit: "mg/dL" | "mmol/L";
  skipped: number;
  dayFirst: boolean;
  from?: string;
  to?: string;
}

const MMOL = 18.0182;

function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === delim && !q) { out.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

/** Parse "2026-10-21T08:15:00", "21-10-2026 08:15", "10/21/2026 8:15 AM" etc. */
function parseTime(s: string, dayFirst: boolean): Date | null {
  const t = s.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const d = new Date(t.replace(" ", "T"));
    return isNaN(d.getTime()) ? null : d;
  }
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)?/);
  if (!m) return null;
  let [, a, b, y, hh, mm, ss, ap] = m;
  let day = Number(dayFirst ? a : b), mon = Number(dayFirst ? b : a), year = Number(y.length === 2 ? "20" + y : y), h = Number(hh);
  if (ap) { const pm = ap.toLowerCase() === "pm"; if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
  const d = new Date(year, mon - 1, day, h, Number(mm), Number(ss || 0));
  return isNaN(d.getTime()) || d.getMonth() !== mon - 1 ? null : d;
}

export function parseGlucoseCsv(text: string, forceDayFirst?: boolean): ParseResult {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const delim = [",", ";", "\t"].map((d) => [d, (lines.slice(0, 5).join("\n").match(new RegExp(d === "\t" ? "\t" : `\\${d}`, "g")) || []).length] as const).sort((a, b) => b[1] - a[1])[0][0];

  // Find the header row: has a time-ish column and a glucose-ish column
  let hi = -1;
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const cols = splitLine(lines[i], delim).map((c) => c.toLowerCase());
    if (cols.some((c) => /time|date/.test(c)) && cols.some((c) => /glucose|value|mg\/dl|mmol|reading|bg/.test(c))) { hi = i; break; }
  }
  if (hi < 0) throw new Error("Couldn't find a time column and a glucose column in this file.");
  const header = splitLine(lines[hi], delim);
  const low = header.map((h) => h.toLowerCase());

  const isLibre = low.some((h) => h.includes("device timestamp")) || low.some((h) => h.includes("historic glucose"));
  const isDexcom = low.some((h) => h.startsWith("timestamp (")) || low.some((h) => h.startsWith("glucose value"));
  const format: ParseResult["format"] = isLibre ? "LibreView" : isDexcom ? "Dexcom Clarity" : "Generic CSV";

  const timeIdx = low.findIndex((h) => h.includes("device timestamp")) >= 0 ? low.findIndex((h) => h.includes("device timestamp")) : low.findIndex((h) => /timestamp|time|date/.test(h));
  const valueIdxs = isLibre
    ? low.map((h, i) => (/(historic|scan) glucose/.test(h) ? i : -1)).filter((i) => i >= 0)
    : [low.findIndex((h) => /glucose value|glucose|mg\/dl|mmol|value|reading|bg/.test(h) && !/time|date|type|device|serial/.test(h))].filter((i) => i >= 0);
  if (timeIdx < 0 || !valueIdxs.length) throw new Error("Couldn't find a time column and a glucose column in this file.");
  const eventIdx = low.findIndex((h) => h === "event type");
  const unit: ParseResult["unit"] = valueIdxs.some((i) => low[i].includes("mmol")) ? "mmol/L" : "mg/dL";

  const rows = lines.slice(hi + 1).map((l) => splitLine(l, delim));
  // Auto-detect DD-MM vs MM-DD: if any first part > 12 it's day-first; if any second part > 12 it's month-first; default day-first (India)
  let dayFirst = forceDayFirst ?? true;
  if (forceDayFirst == null) {
    for (const r of rows) {
      const m = (r[timeIdx] || "").match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.]/);
      if (!m) continue;
      if (Number(m[1]) > 12) { dayFirst = true; break; }
      if (Number(m[2]) > 12) { dayFirst = false; break; }
    }
  }

  const out: ParsedReading[] = [];
  let skipped = 0;
  for (const r of rows) {
    if (eventIdx >= 0 && r[eventIdx] && !/egv|glucose/i.test(r[eventIdx])) { skipped++; continue; }
    const t = parseTime(r[timeIdx] || "", dayFirst);
    const raw = valueIdxs.map((i) => r[i]).find((v) => v && v.trim() !== "");
    if (!t || raw == null) { skipped++; continue; }
    let v = Number(String(raw).replace(",", ".").replace(/[^0-9.]/g, ""));
    if (/low/i.test(raw)) v = 40; else if (/high/i.test(raw)) v = 400;
    if (!v) { skipped++; continue; }
    if (unit === "mmol/L" || v < 35) v = v * MMOL; // values under 35 are almost certainly mmol/L
    if (v < 20 || v > 600) { skipped++; continue; }
    out.push({ takenAt: t.toISOString(), mgdl: Math.round(v) });
  }
  out.sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  return { readings: out, format, unit, skipped, dayFirst, from: out[0]?.takenAt, to: out[out.length - 1]?.takenAt };
}

/** Drop readings that duplicate an existing one (same minute). */
export function dedupe(incoming: ParsedReading[], existing: { takenAt: string }[]) {
  const key = (iso: string) => iso.slice(0, 16);
  const have = new Set(existing.map((r) => key(r.takenAt)));
  const out: ParsedReading[] = [];
  for (const r of incoming) {
    const k = key(r.takenAt);
    if (have.has(k)) continue;
    have.add(k);
    out.push(r);
  }
  return out;
}
