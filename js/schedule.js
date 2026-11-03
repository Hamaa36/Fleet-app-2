// Weekly inspection schedule – due every Sunday 08:00, Iraq time (Asia/Baghdad, UTC+3, no DST).
import { IS_KU, kuDate } from "./i18n.js";
const cfg = window.HRID_CONFIG || {};
const TZ = cfg.TIMEZONE || "Asia/Baghdad";
const OFFSET = 3 * 3600e3;
const WEEK = 7 * 864e5;
const DAY = cfg.INSPECTION_WEEKDAY ?? 0;
const HOUR = cfg.INSPECTION_HOUR ?? 8;

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
export function weekKey(now = new Date()) {
  return new Date(getInspectionWindow(now).start.getTime() + OFFSET).toISOString().slice(0, 10);
}
/** Iraq-time calendar date (YYYY-MM-DD) of an ISO timestamp. */
export function localISODate(iso) {
  return new Date(new Date(iso).getTime() + OFFSET).toISOString().slice(0, 10);
}
export function todayISO() {
  return new Date(Date.now() + OFFSET).toISOString().slice(0, 10);
}
/** Iraq-time HH:MM of an ISO timestamp. */
export function fmtTime(iso) {
  if (!iso) return "-";
  return new Date(new Date(iso).getTime() + OFFSET).toISOString().slice(11, 16);
}
export function fmtDateTime(d) {
  if (IS_KU) {
    const l = new Date(d.getTime() + OFFSET);
    return `${kuDate(l.getUTCFullYear(), l.getUTCMonth() + 1, l.getUTCDate(), l.getUTCDay())}، ${String(l.getUTCHours()).padStart(2, "0")}:${String(l.getUTCMinutes()).padStart(2, "0")}`;
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
  if (IS_KU) return `${["کانوونی دووەم", "شوبات", "ئازار", "نیسان", "ئایار", "حوزەیران", "تەمموز", "ئاب", "ئەیلوول", "تشرینی یەکەم", "تشرینی دووەم", "کانوونی یەکەم"][m - 1]} ${y}`;
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 1)));
}
