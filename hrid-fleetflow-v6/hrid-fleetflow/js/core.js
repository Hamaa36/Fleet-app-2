// App core: state, routing, page shell, email notifications and shared trip views.
import { langButton } from "./i18n.js";
import { db, MODE } from "./store.js";
import { fmtDateTime, fmtDate, todayISO } from "./schedule.js";
import { vehicleLabel } from "./fleet.js";
import { icon } from "./icons.js";
import { esc, toast, badge, uid, gpsText, paxListHTML, itemsListHTML, itemsCount } from "./ui.js";
import { buildEmails } from "../supabase/functions/_shared/emails.js";

export const app = document.getElementById("app");
export const state = { user: null };
export const hooks = { setup: null, login: null, forceChange: null };
export const ROLE_LABEL = { admin: "Administrator", driver: "Driver", requester: "Employee" };
export const APP_URL = (window.HRID_CONFIG || {}).APP_URL || location.origin + location.pathname;
export const isItems = (r) => r?.trip_type === "items";
export const newReference = () => "TR-" + todayISO().slice(2).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
export const ACTIVE = ["pending", "approved", "started", "delivered"];
export const DONE = ["completed", "delivered"];

/* ---------------- routing ---------------- */
const routes = [];
export const route = (pattern, roles, render) => routes.push({ re: new RegExp(`^${pattern.replace(/:(\w+)/g, "(?<$1>[^/]+)")}$`), roles, render });
export const go = (path) => { if (location.hash === "#" + path) router(); else location.hash = path; };
export const currentPath = () => (location.hash.slice(1) || "/").split("?")[0];
export const query = () => new URLSearchParams(location.hash.split("?")[1] || "");

const session = {
  get() { try { return JSON.parse(localStorage.getItem("hrid_session") || "null"); } catch { return null; } },
  set(u) { localStorage.setItem("hrid_session", JSON.stringify({ id: u.id })); },
  clear() { localStorage.removeItem("hrid_session"); },
};
export { session };

export async function router() {
  const path = currentPath();
  try {
    const users = await db.list("users");
    if (!users.some((u) => u.role === "admin")) return hooks.setup();
    const s = session.get();
    state.user = s ? await db.get("users", s.id) : null;
    if (state.user && state.user.active === false) { session.clear(); state.user = null; }
    if (!state.user) return hooks.login();
    if (state.user.must_change_password) return hooks.forceChange();
    for (const r of routes) {
      const m = path.match(r.re);
      if (!m) continue;
      if (r.roles && !r.roles.includes(state.user.role)) { toast("You do not have access to that page"); return go("/"); }
      return await r.render(m.groups || {});
    }
    go("/");
  } catch (e) {
    console.error(e);
    app.innerHTML = `<main><div class="alert err"><div><b>Something went wrong</b><div class="small">${esc(e.message || e)}</div></div><button class="btn btn-outline btn-sm" type="button" onclick="location.reload()">Reload</button></div></main>`;
  }
}
window.addEventListener("hashchange", router);

/* ---------------- page shell ---------------- */
const NAV = {
  admin: [["/", "Dashboard", "home"], ["/admin/trips", "Trips", "list"], ["/admin/vehicles", "Vehicles", "car"], ["/admin/reports", "Reports", "chart"], ["/admin/users", "Users", "users"]],
  driver: [["/", "Home", "home"], ["/trips", "My trips", "list"], ["/inspection", "Checklist", "clipboard"], ["/report-issue", "Problem", "alert"], ["/profile", "Profile", "user"]],
  requester: [["/", "Home", "home"], ["/requests/new", "New request", "plus"], ["/requests", "My requests", "list"], ["/profile", "Profile", "user"]],
};
function activeNav(path, items) {
  return items.filter(([to]) => (to === "/" ? path === "/" : path === to || path.startsWith(to + "/"))).sort((a, b) => b[0].length - a[0].length)[0]?.[0];
}
export async function shell(title, body) {
  const u = state.user, path = currentPath();
  const items = NAV[u.role] || NAV.requester;
  const cur = activeNav(path, items);
  const dots = {};
  if (u.role === "admin") {
    const [reqs, issues] = await Promise.all([db.list("trip_requests"), db.list("vehicle_issues")]);
    dots["/admin/trips"] = reqs.filter((r) => r.status === "pending").length;
    dots["/admin/vehicles"] = issues.filter((i) => i.status === "open").length;
  } else if (u.role === "requester") {
    dots["/requests"] = (await db.list("trip_requests")).filter((r) => r.requester_id === u.id && r.status === "delivered").length;
  } else {
    dots["/"] = (await db.list("trip_requests")).filter((r) => r.assigned_driver_id === u.id && ["approved", "started"].includes(r.status)).length;
  }
  app.innerHTML = `
  <header class="header"><div class="header-inner">
    <span class="logo"><img src="assets/logo.png" alt="HRID" /></span>
    <div class="head-text"><small>${esc(u.full_name)} · ${esc(ROLE_LABEL[u.role])}</small><h1>${esc(title)}</h1></div>
    ${langButton("on-dark")}
    ${u.role === "admin" ? `<a class="icon-btn" href="#/profile" aria-label="Profile">${icon("user")}</a>` : ""}
    <ul class="top-nav">${items.map(([to, label]) => `<li><a href="#${to}" class="${cur === to ? "active" : ""}" ${cur === to ? 'aria-current="page"' : ""}>${label}${dots[to] ? ` (${dots[to]})` : ""}</a></li>`).join("")}</ul>
  </div></header>
  <main>${MODE === "local" ? `<div class="alert info small no-print" style="margin-bottom:14px"><div>Demo mode: data is saved only on this device. Connect Supabase in <b>config.js</b> to share data between phones.</div></div>` : ""}${body}</main>
  <nav class="bottom-nav" aria-label="Main"><ul style="grid-template-columns:repeat(${items.length},minmax(0,1fr))">
    ${items.map(([to, label, ic]) => `<li><a href="#${to}" class="${cur === to ? "active" : ""}" ${cur === to ? 'aria-current="page"' : ""}>${icon(ic)}<span>${label}</span>${dots[to] ? `<span class="dot">${dots[to]}</span>` : ""}</a></li>`).join("")}
  </ul></nav>`;
  window.scrollTo(0, 0);
}
export const langCorner = () => `<div class="auth-lang">${langButton("on-dark")}</div>`;

/* ---------------- email notifications ----------------
   Each event is written to email_outbox. With Supabase + Microsoft 365 connected a database webhook sends it;
   until then the emails can be previewed under Users → Email log. */
export async function notify(event, { request = null, issues = null, previous_driver_id = null } = {}) {
  try {
    const users = await db.list("users");
    const byId = (id) => users.find((u) => u.id === id) || null;
    const admins = users.filter((u) => u.role === "admin" && u.active !== false && u.email);
    const ctx = issues ? { issues, admins, appUrl: APP_URL } : {
      request, admins, appUrl: APP_URL,
      requesterEmail: request.for_guest ? request.guest_email : byId(request.requester_id)?.email,
      driver: byId(request.assigned_driver_id), previousDriver: byId(previous_driver_id),
    };
    const preview = buildEmails(event, ctx).map(({ to, subject, html }) => ({ to, subject, html }));
    await db.insert("email_outbox", {
      id: uid(), event, request_id: request?.id || null, issue_ids: issues ? issues.map((i) => i.id) : null, previous_driver_id,
      status: MODE === "supabase" ? "queued" : "demo (not sent)", preview, created_at: new Date().toISOString(),
    });
  } catch (e) { console.error("notify failed", e); }
}

/* ---------------- shared trip helpers & views ---------------- */
export const stopsOf = (r) => (r.stops?.length ? r.stops : [r.destination].filter(Boolean));
/** All locations of a trip in order: departure, each destination, and the return to base when it is a return trip. */
export function routePoints(r) {
  const pts = [{ kind: "departure", label: "Pick-up", name: r.origin }];
  stopsOf(r).forEach((s, i, a) => pts.push({ kind: "arrival", label: a.length > 1 ? `Destination ${i + 1}` : "Destination", name: s }));
  if (r.return_time) pts.push({ kind: "return", label: "Back at pick-up", name: r.origin });
  return pts.map((p, i) => ({ ...p, cp: r.checkpoints?.[i] || null }));
}
export const whatText = (r) => (isItems(r) ? `${itemsCount(r.items)} item(s)` : `${r.passenger_count || r.passengers?.length || 0} passenger(s)`);
const stopsShort = (r) => { const s = stopsOf(r); return s.length > 1 ? `${esc(s[0])} <span class="muted">+${s.length - 1} more</span>` : esc(s[0] || ""); };

/** Compact trip card used in every list. */
export function tripCard(r, href, extra = "") {
  return `<a class="tcard s-${esc(r.status)}" href="${href}">
    <div class="row between" style="gap:6px"><span class="route-line"><span data-no-tr>${esc(r.origin)}</span> → <span data-no-tr>${stopsShort(r)}</span></span>
      <span class="row" style="gap:6px">${isItems(r) ? `<span class="badge b-items">${icon("box")} Items</span>` : ""}${r.for_guest ? '<span class="badge b-guest">Guest</span>' : ""}${badge(r.status)}</span></div>
    <div class="meta">${esc(fmtDate(r.trip_date))} · ${esc(r.departure_time)}${r.return_time ? "–" + esc(r.return_time) : ""} · ${whatText(r)} · ${esc(r.reference || "")}</div>
    <div class="who">${esc(r.requester_name)}${r.department ? ` · ${esc(r.department)}` : ""}${r.assigned_driver_name ? ` · ${icon("car")} ${esc(r.assigned_driver_name)} · ${esc(vehicleLabel(r.assigned_vehicle_number))}` : ""}</div>
    ${extra}</a>`;
}
export const listOrEmpty = (list, render, text) => (list.length ? list.map(render).join("") : `<div class="card empty">${esc(text)}</div>`);

/** Main facts of a request / trip. */
export function tripDetails(r) {
  return `<div class="card"><div class="row between" style="margin-bottom:12px"><h2 style="margin:0">${esc(r.reference || "")}</h2>
      <span class="row" style="gap:6px">${isItems(r) ? `<span class="badge b-items">${icon("box")} Documents & items</span>` : `<span class="badge b-hrid">${icon("users")} Passengers</span>`}${r.for_guest ? '<span class="badge b-guest">Guest</span>' : ""}${badge(r.status)}</span></div>
    <dl class="kv">
      <dt>Requested by</dt><dd>${esc(r.requester_name)}${r.department ? ` (${esc(r.department)})` : ""}${r.created_by_admin && r.created_by_name !== r.requester_name ? `<div class="small muted">Entered by ${esc(r.created_by_name)}</div>` : ""}</dd>
      ${r.for_guest ? `<dt>Organisation</dt><dd>${esc(r.guest_organization)}</dd><dt>Phone</dt><dd><a href="tel:${esc(r.guest_phone)}">${esc(r.guest_phone)}</a></dd>${r.guest_email ? `<dt>Email</dt><dd>${esc(r.guest_email)}</dd>` : ""}<dt>HRID host</dt><dd>${esc(r.guest_host)}</dd>` : ""}
      <dt>Date & time</dt><dd>${esc(fmtDate(r.trip_date))} · ${esc(r.departure_time)}${r.return_time ? ` – return ${esc(r.return_time)}` : ""}</dd>
      <dt>Route</dt><dd>${routePoints(r).map((p) => `<div><span class="muted small">${esc(p.label)}</span><span class="muted small">:</span> <span data-no-tr>${esc(p.name)}</span></div>`).join("")}</dd>
      ${isItems(r) ? `<dt>Items</dt><dd>${itemsListHTML(r.items)}</dd><dt>Receiver</dt><dd><span data-no-tr>${esc(r.recipient_name || "-")}</span>${r.recipient_phone ? ` · <a href="tel:${esc(r.recipient_phone)}">${esc(r.recipient_phone)}</a>` : ""}</dd>`
        : `<dt>Passengers (${r.passengers?.length || 0})</dt><dd>${paxListHTML(r.passengers)}</dd>`}
      <dt>Purpose</dt><dd>${esc(r.purpose)}</dd>${r.notes ? `<dt>Notes</dt><dd>${esc(r.notes)}</dd>` : ""}
      ${r.assigned_driver_name ? `<dt>Driver</dt><dd>${esc(r.assigned_driver_name)}</dd><dt>Vehicle</dt><dd>${esc(vehicleLabel(r.assigned_vehicle_number))}</dd>` : ""}
      ${r.admin_comment ? `<dt>Admin comment</dt><dd>${esc(r.admin_comment)}</dd>` : ""}
      ${r.cancel_reason ? `<dt>Cancel reason</dt><dd>${esc(r.cancel_reason)}</dd>` : ""}
      ${r.odometer_start != null ? `<dt>Odometer</dt><dd>${esc(r.odometer_start)} → ${esc(r.odometer_end ?? "…")} km${r.distance_km != null ? ` (${esc(r.distance_km)} km)` : ""}</dd>` : ""}
      ${r.received_by ? `<dt>Handed over to</dt><dd>${esc(r.received_by)}</dd>` : ""}
    </dl></div>`;
}

/** Everything that happened, in order, with times and locations. */
export function timelineHTML(r) {
  const ev = [];
  ev.push(["Requested", r.created_at, `${r.created_by_name || r.requester_name}`, null, ""]);
  if (r.reviewed_at && r.status !== "rejected") ev.push(["Approved", r.reviewed_at, r.reviewed_by, null, "ok"]);
  if (r.status === "rejected") ev.push(["Rejected", r.reviewed_at, `${r.reviewed_by}${r.admin_comment ? " – " + r.admin_comment : ""}`, null, "bad"]);
  routePoints(r).forEach((p) => { if (p.cp?.at) ev.push([p.kind === "departure" ? `Departed from ${p.name}` : p.kind === "return" ? `Back at ${p.name}` : `Arrived at ${p.name}`, p.cp.at, "", p.cp.gps, "ok"]); });
  (r.passengers || []).forEach((p) => { if (p.signed_at) ev.push([`${p.name} signed`, p.signed_at, "", p.signed_gps, "ok"]); });
  if (r.finished_at) ev.push(["Trip finished", r.finished_at, r.assigned_driver_name, r.finished_gps, "ok"]);
  if (r.requester_signed_at) ev.push([`Delivery confirmed by ${r.requester_name}`, r.requester_signed_at, "", r.requester_signed_gps, "ok"]);
  if (r.status === "cancelled") ev.push(["Cancelled", r.cancelled_at, `${r.cancelled_by || ""}${r.cancel_reason ? " – " + r.cancel_reason : ""}`, null, "bad"]);
  ev.sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  return `<div class="card"><h2>Timeline</h2><ul class="timeline">${ev.map(([t, at, who, gps, cls]) => `<li class="${cls}"><div class="t">${esc(t)}</div><div class="s">${at ? esc(fmtDateTime(at)) : ""}${who ? ` · ${esc(who)}` : ""}${gps !== null && gps !== undefined ? ` · ${gpsText(gps)}` : (cls === "ok" && /^(Departed|Arrived|Back)/.test(t) ? ` · ${gpsText(null)}` : "")}</div></li>`).join("")}</ul></div>`;
}

/** Signatures section (passengers or requester). */
export function signaturesHTML(r) {
  if (isItems(r)) return `<div class="card"><h2>Requester signature</h2>${r.requester_signature ? `<img class="sig-img" src="${r.requester_signature}" alt="signature" /><div class="small muted">${esc(r.requester_name)} · ${esc(fmtDateTime(r.requester_signed_at))}</div>` : `<span class="badge b-pending">Not signed yet</span>`}</div>`;
  if (!r.passengers?.length || !r.passengers.some((p) => p.signature)) return "";
  return `<div class="card"><h2>Passenger signatures</h2><div class="table-wrap"><table><tbody>${r.passengers.map((p) => `<tr><td><span data-no-tr>${esc(p.name)}</span></td><td>${p.signature ? `<img class="sig-img" src="${p.signature}" alt="signature" />` : '<span class="badge b-pending">Missing</span>'}</td><td class="small muted">${p.signed_at ? esc(fmtDateTime(p.signed_at)) : ""}</td></tr>`).join("")}</tbody></table></div></div>`;
}
export const printHeader = (title) => `<div class="print-only" style="margin-bottom:12px"><div class="row"><img src="assets/logo.png" style="height:44px" alt="" /><div><b>Hiwa Rauf for Investment & Development</b><div class="small">${esc(title)}</div></div></div></div>`;

/* ---------------- vehicle problems ---------------- */
export const SEV_RANK = { unsafe: 0, major: 1, minor: 2 };
export const issueOrder = (a, b) => (SEV_RANK[a.severity] - SEV_RANK[b.severity]) || String(b.reported_at).localeCompare(String(a.reported_at));
export function issueCard(i, href) {
  return `<a class="tcard ${i.severity === "unsafe" ? "s-rejected" : i.status === "open" ? "s-pending" : "s-completed"}" href="${href}" style="border-inline-start-color:${i.severity === "unsafe" && i.status === "open" ? "var(--danger)" : ""}">
    <div class="row between"><b>${esc(vehicleLabel(i.vehicle_number))}</b><span class="row" style="gap:6px">${badge(i.severity)}${badge(i.status)}</span></div>
    <div>${esc(i.title)}</div>
    <div class="meta">${esc(fmtDateTime(i.reported_at))} · ${esc(i.reported_by_name)}</div></a>`;
}
