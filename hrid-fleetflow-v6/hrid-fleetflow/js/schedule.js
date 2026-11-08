// Dates and times – always Iraq time (Asia/Baghdad, UTC+3, no daylight saving).
import { IS_KU, kuDate, kuMonth } from "./i18n.js";
const cfg = window.HRID_CONFIG || {};
const TZ = cfg.TIMEZONE || "Asia/Baghdad";
const OFFSET = 3 * 3600e3;
const WEEK = 7 * 864e5;
const DAY = cfg.INSPECTION_WEEKDAY ?? 0;
const HOUR = cfg.INSPECTION_HOUR ?? 8;
export const ON_TIME_MINUTES = cfg.ON_TIME_MINUTES ?? 15;

/* Weekly checklist window: [last Sunday 08:00, next Sunday 08:00) */
export function getInspectionWindow(now = new Date()) {
  const local = new Date(now.getTime() + OFFSET);
  const back = (local.getUTCDay() - DAY + 7) % 7;
  let s = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - back, HOUR);
  if (local.getTime() < s) s -= WEEK;
  const start = new Date(s - OFFSET);
  return { start, end: new Date(start.getTime() + WEEK) };
}
export function isInspectionDue(lastSubmittedAt, now = new Date()) {
  if (!lastSubmittedAt) return true;
  const t = new Date(lastSubmittedAt).getTime();
  return Number.isNaN(t) || t < getInspectionWindow(now).start.getTime();
}
export const weekKey = (now = new Date()) => new Date(getInspectionWindow(now).start.getTime() + OFFSET).toISOString().slice(0, 10);
/** Sundays in a month whose checklist window has already opened. */
export function weeksDueIn(month) {
  const [y, m] = month.split("-").map(Number);
  const out = [];
  for (let d = 1; d <= 31; d++) {
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCMonth() !== m - 1) break;
    const iso = dt.toISOString().slice(0, 10);
    if (dt.getUTCDay() === DAY && Date.parse(`${iso}T${String(HOUR).padStart(2, "0")}:00:00+03:00`) <= Date.now()) out.push(iso);
  }
  return out;
}

export const localISODate = (iso) => new Date(new Date(iso).getTime() + OFFSET).toISOString().slice(0, 10);
export const todayISO = () => new Date(Date.now() + OFFSET).toISOString().slice(0, 10);
export const fmtTime = (iso) => (iso ? new Date(new Date(iso).getTime() + OFFSET).toISOString().slice(11, 16) : "-");
/** Planned departure as a timestamp (ms). */
export const plannedAt = (date, time) => (date && time ? Date.parse(`${date}T${time}:00+03:00`) : NaN);
export const hoursBetween = (a, b) => (a && b ? (new Date(b) - new Date(a)) / 3600e3 : null);
export const daysInMonth = (month) => { const [y, m] = month.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
export const prevMonth = (month) => { const [y, m] = month.split("-").map(Number); const d = new Date(Date.UTC(y, m - 2, 1)); return d.toISOString().slice(0, 7); };

export function fmtDateTime(d) {
  d = d instanceof Date ? d : new Date(d);
  if (IS_KU) {
    const l = new Date(d.getTime() + OFFSET);
    return `${kuDate(l.getUTCFullYear(), l.getUTCMonth() + 1, l.getUTCDate(), l.getUTCDay())}، ${l.toISOString().slice(11, 16)}`;
  }
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}
export function fmtDate(iso) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  if (IS_KU) return kuDate(y, m, d, new Date(Date.UTC(y, m - 1, d)).getUTCDay());
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, d)));
}
export function fmtMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  if (IS_KU) return kuMonth(y, m);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 1)));
}
