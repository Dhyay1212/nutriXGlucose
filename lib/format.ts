export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
/** Value for <input type="datetime-local"> in local time */
export const toLocalInput = (d = new Date()) => {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 16);
};
export const fromLocalInput = (s: string) => new Date(s).toISOString();
export const portionLabel = (p: number, unit: "katori" | "piece") => {
  const n = p === 0.5 ? "½" : p === 1.5 ? "1½" : String(p);
  return unit === "katori" ? `${n} katori` : `${n} pc`;
};
