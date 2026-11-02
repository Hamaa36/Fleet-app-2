/* HRID FleetFlow – trip requests, driver assignment, passenger signatures and weekly vehicle checklists.
   Plain HTML/CSS/JS – no build step. Works on Azure Static Web Apps, GitHub Pages or any static host. */
import { langButton } from "./js/i18n.js";
import { db, MODE } from "./js/store.js";
import { getInspectionWindow, isInspectionDue, weekKey, fmtDateTime, fmtDate, todayISO } from "./js/schedule.js";
import { CHECKLIST } from "./js/checklist.js";
import { FLEET, fleetOptions, vehicleLabel, vehicleModel } from "./js/fleet.js";
import { icon } from "./js/icons.js";
import {
  esc, uid, norm, toast, modal, field, readForm, validate, badge, getGPS, gpsText,
  cleanStops, stopsEditor, routeHTML, newPax, paxRecord, paxOf, paxErrors, paxListHTML, paxBadge, passengerEditor,
} from "./js/ui.js";
import { buildEmails } from "./supabase/functions/_shared/emails.js";

const app = document.getElementById("app");
const ROLE_LABEL = { admin: "Administrator", driver: "Driver", requester: "Employee" };
const APP_URL = (window.HRID_CONFIG || {}).APP_URL || location.origin + location.pathname;
const newReference = () => "TR-" + todayISO().slice(2).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();

/* ---------------- email notifications ----------------
   Each event is written to email_outbox. In Supabase mode a database webhook calls the send-email
   function, which sends through Microsoft 365. In demo mode emails are only shown in the Email log. */
async function notify(event, request, extra = {}) {
  try {
    const users = await db.list("users");
    const byId = (id) => users.find((u) => u.id === id) || null;
    const ctx = {
      request, appUrl: APP_URL,
      admins: users.filter((u) => u.role === "admin" && u.active !== false && u.email),
      requesterEmail: request.is_guest ? request.guest_email : byId(request.requester_id)?.email,
      driver: byId(request.assigned_driver_id),
      previousDriver: byId(extra.previous_driver_id),
    };
    const preview = buildEmails(event, ctx).map(({ to, subject, html }) => ({ to, subject, html }));
    await db.insert("email_outbox", {
      id: uid(), event, request_id: request.id, previous_driver_id: extra.previous_driver_id || null,
      status: MODE === "supabase" ? "queued" : "demo (not sent)", preview, created_at: new Date().toISOString(),
    });
  } catch (e) { console.error("notify failed", e); }
}

/* ---------------- auth ---------------- */
async function hash(password, salt) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${password}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const session = {
  get() { try { return JSON.parse(localStorage.getItem("hrid_session") || "null"); } catch { return null; } },
  set(u) { localStorage.setItem("hrid_session", JSON.stringify({ id: u.id })); },
  clear() { localStorage.removeItem("hrid_session"); },
};
let currentUser = null;
async function loadUser() {
  const s = session.get();
  if (!s) return null;
  const u = await db.get("users", s.id);
  if (!u || u.active === false) { session.clear(); return null; }
  return u;
}
async function employeeList() {
  return (await db.list("users")).filter((u) => u.active !== false).sort((a, b) => a.full_name.localeCompare(b.full_name));
}

/* ---------------- routing ---------------- */
const routes = [];
const route = (pattern, roles, render) => routes.push({ re: new RegExp(`^${pattern.replace(/:(\w+)/g, "(?<$1>[^/]+)")}$`), roles, render });
const go = (path) => { location.hash = path; };
const currentPath = () => (location.hash.slice(1) || "/").split("?")[0];

const NAV = {
  driver: [["/", "Dashboard", "home"], ["/trips", "My trips", "list"], ["/trips/new", "New trip", "plus"], ["/inspection", "Checklist", "clipboard"], ["/profile", "Profile", "user"]],
  requester: [["/", "Dashboard", "home"], ["/requests/new", "Request", "send"], ["/requests", "My requests", "list"], ["/profile", "Profile", "user"]],
  admin: [["/", "Dashboard", "home"], ["/admin/requests", "Requests", "inbox"], ["/trips", "Trips", "list"], ["/admin/inspections", "Checklists", "clipboard"], ["/admin/users", "Users", "users"]],
};
function activeNav(path, items) {
  return items.filter(([to]) => (to === "/" ? path === "/" : path === to || path.startsWith(to + "/")))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[0];
}

async function shell(title, body) {
  const path = currentPath();
  const items = NAV[currentUser.role] || NAV.driver;
  const cur = activeNav(path, items);
  let pending = 0;
  if (currentUser.role === "admin") pending = (await db.list("trip_requests")).filter((r) => r.status === "pending").length;
  const dot = (to) => (to === "/admin/requests" && pending ? `<span class="dot">${pending}</span>` : "");
  app.innerHTML = `
  <header class="header">
    <div class="header-inner">
      <span class="logo"><img src="assets/logo.png" alt="HRID" /></span>
      <div class="head-text">
        <small>${esc(currentUser.full_name)} · ${esc(ROLE_LABEL[currentUser.role])}${currentUser.employee_no ? " · #" + esc(currentUser.employee_no) : ""}</small>
        <h1>${esc(title)}</h1>
      </div>
      ${langButton("on-dark")}
      ${currentUser.role === "admin" ? `<a class="icon-btn mobile-only" href="#/profile" aria-label="Profile">${icon("user")}</a>` : ""}
      <ul class="top-nav">${items.map(([to, label]) => `<li><a href="#${to}" class="${cur === to ? "active" : ""}" ${cur === to ? 'aria-current="page"' : ""}>${label}${pending && to === "/admin/requests" ? ` (${pending})` : ""}</a></li>`).join("")}
        ${currentUser.role === "admin" ? `<li><a href="#/profile" class="${path === "/profile" ? "active" : ""}">Profile</a></li>` : ""}
      </ul>
    </div>
  </header>
  <main>${MODE === "local" ? `<div class="alert info small no-print" style="margin-bottom:14px"><div>Demo mode: data is saved only on this device. Connect Supabase in <b>config.js</b> to share data between phones.</div></div>` : ""}${body}</main>
  <nav class="bottom-nav" aria-label="Main">
    <ul style="grid-template-columns:repeat(${items.length},minmax(0,1fr))">
      ${items.map(([to, label, ic]) => `<li><a href="#${to}" class="${cur === to ? "active" : ""}" ${cur === to ? 'aria-current="page"' : ""}>${icon(ic)}<span>${label}</span>${dot(to)}</a></li>`).join("")}
    </ul>
  </nav>`;
  window.scrollTo(0, 0);
}

async function router() {
  const path = currentPath();
  try {
    const users = await db.list("users");
    if (!users.some((u) => u.role === "admin")) return renderSetup();
    if (path === "/guest") return renderGuest();
    currentUser = await loadUser();
    if (!currentUser) return renderLogin();
    if (currentUser.must_change_password) return renderForceChange();
    for (const r of routes) {
      const m = path.match(r.re);
      if (!m) continue;
      if (r.roles && !r.roles.includes(currentUser.role)) { toast("You do not have access to that page"); return go("/"); }
      return await r.render(m.groups || {});
    }
    go("/");
  } catch (e) {
    console.error(e);
    app.innerHTML = `<main><div class="alert err"><div><b>Something went wrong</b><div class="small">${esc(e.message || e)}</div></div><button class="btn btn-outline btn-sm" type="button" onclick="location.reload()">Reload</button></div></main>`;
  }
}
window.addEventListener("hashchange", router);

/* ---------------- CSV import ---------------- */
function parseCSV(text) {
  const rows = []; let row = [], cur = "", q = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
/** Birth date (YYYY-MM-DD, DD/MM/YYYY or DD-MM-YYYY) → DDMMYYYY */
function birthPassword(v) {
  v = String(v || "").trim();
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[3].padStart(2, "0") + m[2].padStart(2, "0") + m[1];
  m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return m[1].padStart(2, "0") + m[2].padStart(2, "0") + m[3];
  return null;
}
async function importUsersCSV(file, done) {
  if (!file) return;
  const rows = parseCSV(await file.text());
  if (!rows.length) return alert("The file is empty.");
  const head = rows.shift().map((h) => h.trim().toLowerCase());
  const col = (n) => head.indexOf(n);
  if (["employee_no", "full_name", "birth_date", "email"].some((n) => col(n) < 0)) return alert("CSV must have the columns: employee_no, full_name, birth_date, email, role");
  const existing = await db.list("users");
  let added = 0, updated = 0; const skipped = [];
  for (const r of rows) {
    const get = (n) => (col(n) >= 0 ? String(r[col(n)] ?? "").trim() : "");
    const name = get("full_name").replace(/\s+/g, " "), no = get("employee_no"), email = get("email").toLowerCase();
    const role = ["admin", "driver", "requester"].includes(get("role").toLowerCase()) ? get("role").toLowerCase() : "requester";
    const pw = birthPassword(get("birth_date"));
    if (!name || !no || !pw) { skipped.push(name || no || "(blank row)"); continue; }
    const found = existing.find((u) => String(u.employee_no) === no);
    const rec = { full_name: name, username: norm(name), employee_no: no, email, role, department: get("department") || found?.department || "" };
    if (found) { await db.update("users", found.id, rec); updated++; }
    else {
      const salt = uid();
      await db.insert("users", { id: uid(), ...rec, salt, password_hash: await hash(pw, salt), must_change_password: true, active: true, created_at: new Date().toISOString() });
      added++;
    }
  }
  alert(`Import finished: ${added} added, ${updated} updated (existing passwords kept)${skipped.length ? `, ${skipped.length} skipped (missing name, number or birth date): ${skipped.join(", ")}` : ""}.`);
  done?.();
}

/* ---------------- setup, login, password ---------------- */
function renderSetup() {
  app.innerHTML = `<div class="auth"><div class="auth-lang">${langButton("on-dark")}</div><form class="card stack" id="setup" novalidate>
    <div class="brand"><img src="assets/logo.png" alt="" /><div><h2 style="font-size:19px">HRID FleetFlow</h2><p class="muted small">First-time setup</p></div></div>
    <label class="btn btn-blue btn-block" for="setup-csv">${icon("users")} Import employees from CSV</label>
    <input id="setup-csv" type="file" accept=".csv,text/csv" hidden />
    <p class="muted small">Use hrid-users-import.csv. Passwords are set to each person's date of birth (DDMMYYYY) and must be changed at first sign-in.</p>
    <div class="muted small" style="text-align:center">— or create one administrator manually —</div>
    ${field("full_name", "Full name", { required: true })}
    <div class="grid two">${field("employee_no", "Employee number", { required: true })}${field("email", "Email", { type: "email" })}</div>
    ${field("password", "Password", { type: "password", required: true, attrs: 'autocomplete="new-password"' })}
    ${field("password2", "Confirm password", { type: "password", required: true, attrs: 'autocomplete="new-password"' })}
    <button class="btn btn-primary btn-block" type="submit">Create administrator</button>
  </form></div>`;
  document.getElementById("setup-csv").addEventListener("change", (e) => importUsersCSV(e.target.files[0], () => { toast("Employees imported – please sign in"); router(); }));
  document.getElementById("setup").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    if (!validate(f, (d) => (d.password.length < 8 ? { password: "At least 8 characters" } : d.password !== d.password2 ? { password2: "Passwords do not match" } : {}))) return;
    const d = readForm(f);
    const salt = uid();
    const u = await db.insert("users", { id: uid(), full_name: d.full_name, username: norm(d.full_name), employee_no: d.employee_no, email: d.email.toLowerCase(), role: "admin", salt, password_hash: await hash(d.password, salt), active: true, created_at: new Date().toISOString() });
    session.set(u); toast("Administrator created"); go("/"); router();
  });
}

function renderLogin() {
  app.innerHTML = `<div class="auth"><div class="auth-lang">${langButton("on-dark")}</div><form class="card stack" id="login" novalidate>
    <div class="brand"><img src="assets/logo.png" alt="" /><div><h2 style="font-size:19px">HRID FleetFlow</h2><p class="muted small">Driver Trip & Vehicle Management</p></div></div>
    ${field("username", "Employee number or email", { required: true, attrs: 'autocomplete="username"' })}
    ${field("password", "Password", { type: "password", required: true, attrs: 'autocomplete="current-password"' })}
    <div class="err-text" id="login-err" role="alert"></div>
    <button class="btn btn-primary btn-block" type="submit">Sign in</button>
    <p class="muted small">First time? Your password is your date of birth as DDMMYYYY (for example 08/09/2003 → 08092003). You will be asked to change it.</p>
    <a class="btn btn-outline btn-block" href="#/guest">Not an HRID employee? Request a trip as a guest</a>
    <p class="muted small" style="text-align:center">Hiwa Rauf for Investment & Development</p>
  </form></div>`;
  document.getElementById("login").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate(e.target)) return;
    const d = readForm(e.target);
    const key = norm(d.username).replace(/^#/, "");
    const u = (await db.list("users")).find((x) => x.active !== false && (String(x.employee_no || "").toLowerCase() === key || norm(x.email) === key || x.username === key));
    if (!u || (await hash(d.password, u.salt)) !== u.password_hash) { document.getElementById("login-err").textContent = "Incorrect employee number/email or password."; return; }
    session.set(u); go("/"); router();
  });
}

function passwordRules(d) {
  if (d.password.length < 8) return { password: "At least 8 characters" };
  if (/^\d+$/.test(d.password)) return { password: "Use letters and numbers – not only digits (not your birthday)" };
  if (d.password !== d.password2) return { password2: "Passwords do not match" };
  return {};
}
function renderForceChange() {
  app.innerHTML = `<div class="auth"><div class="auth-lang">${langButton("on-dark")}</div><form class="card stack" id="fc" novalidate>
    <div class="brand"><img src="assets/logo.png" alt="" /><div><h2 style="font-size:19px">Welcome, ${esc(currentUser.full_name)}</h2><p class="muted small">Please choose your own password to continue.</p></div></div>
    ${field("password", "New password", { type: "password", required: true, attrs: 'autocomplete="new-password"' })}
    ${field("password2", "Confirm new password", { type: "password", required: true, attrs: 'autocomplete="new-password"' })}
    <button class="btn btn-primary btn-block" type="submit">Save password</button>
    <button class="btn btn-outline btn-block" type="button" id="fc-out">Sign out</button>
  </form></div>`;
  document.getElementById("fc-out").addEventListener("click", () => { session.clear(); router(); });
  document.getElementById("fc").addEventListener("submit", async (e) => {
    e.preventDefault(); const f = e.target;
    if (!validate(f, passwordRules)) return;
    const salt = uid();
    await db.update("users", currentUser.id, { salt, password_hash: await hash(f.password.value, salt), must_change_password: false });
    toast("Password saved"); go("/"); router();
  });
}

/* ---------------- shared request form parts ---------------- */
const routeCard = () => `<div class="card"><h2>Route</h2>
  ${field("origin", "Pick-up location", { required: true })}
  <div class="field" style="margin-top:14px"><span class="label">Destinations <span class="req">*</span></span><div id="stops"></div><span class="err-text" data-err="stops"></span></div>
</div>`;
const timeFields = () => `
  ${field("trip_date", "Trip date", { type: "date", required: true, attrs: `min="${todayISO()}"` })}
  ${field("departure_time", "Departure time", { type: "time", required: true })}
  ${field("return_time", "Return time (if return trip)", { type: "time" })}`;
function requestRules(d, stops, others, all) {
  const er = {};
  if (!cleanStops(stops).length) er.stops = "Enter at least one destination";
  if (d.trip_date && d.trip_date < todayISO()) er.trip_date = "Date cannot be in the past";
  if (d.return_time && d.departure_time && d.return_time <= d.departure_time) er.return_time = "Must be after departure";
  const pe = paxErrors(others, all);
  if (pe) er.passengers = pe;
  return er;
}

/* ---------------- guest request (no login) ---------------- */
function renderGuest() {
  const stops = [""], others = [];
  app.innerHTML = `<div class="auth" style="place-items:start center"><div class="auth-lang">${langButton("on-dark")}</div><form class="stack" id="gq" novalidate style="width:100%;max-width:680px;margin:12px 0">
    <div class="card"><div class="brand" style="margin-bottom:0"><img src="assets/logo.png" alt="" /><div><h2 style="font-size:19px;margin:0">Guest trip request</h2><p class="muted small">For visitors and partners of Hiwa Rauf for Investment & Development. Requests need approval from the HRID transport administrators.</p></div></div></div>
    <div class="card"><h2>Your details</h2><div class="grid two">
      ${field("guest_name", "Full name", { required: true })}
      ${field("guest_organization", "Company / organisation", { required: true })}
      ${field("guest_phone", "Phone number", { type: "tel", required: true, placeholder: "07XX XXX XXXX" })}
      ${field("guest_email", "Email (to receive updates)", { type: "email" })}
    </div><div style="margin-top:12px">${field("guest_host", "HRID contact person you are visiting", { required: true })}</div></div>
    ${routeCard()}
    <div class="card"><h2>Date & time</h2><div class="grid two">${timeFields()}</div></div>
    <div class="card"><h2>Passengers</h2>
      <label class="check highlight"><input type="checkbox" name="self_passenger" /><span>I am a passenger on this trip</span></label>
      <h3 style="margin:16px 0 8px">Other passengers</h3>
      <div id="pax"></div>
      <span class="err-text" data-err="passengers"></span>
      <p class="small" id="paxcount" style="margin-top:10px;font-weight:600"></p>
    </div>
    <div class="card stack">
      ${field("purpose", "Purpose of visit / trip", { type: "textarea", required: true })}
      <label class="check"><input type="checkbox" name="consent" /><span>I confirm the information is correct and agree that HRID may contact me about this request.</span></label>
      <span class="err-text" data-err="consent"></span>
      <button class="btn btn-primary btn-block" type="submit">${icon("send")} Submit request</button>
      <a class="btn btn-outline btn-block" href="#/">Back to sign in</a>
    </div>
  </form></div>`;
  const form = document.getElementById("gq");
  const all = () => [...(form.self_passenger.checked ? [paxRecord({ type: "external", name: form.guest_name.value, organization: form.guest_organization.value })] : []), ...others.map(paxRecord)];
  const count = () => (document.getElementById("paxcount").textContent = `Total passengers: ${all().length}`);
  stopsEditor(document.getElementById("stops"), stops);
  passengerEditor(document.getElementById("pax"), others, { allowHRID: false, onChange: count, emptyText: "Add anyone else travelling with you." });
  form.self_passenger.addEventListener("change", count); count();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate(form, (d) => {
      const er = requestRules(d, stops, others, all());
      if (!form.consent.checked) er.consent = "Please confirm";
      if (d.guest_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.guest_email)) er.guest_email = "Enter a valid email";
      if (d.guest_phone && d.guest_phone.replace(/\D/g, "").length < 7) er.guest_phone = "Enter a valid phone number";
      return er;
    })) return;
    const d = readForm(form); delete d.consent; delete d.self_passenger;
    const s = cleanStops(stops), pax = all();
    form.querySelector("[type=submit]").disabled = true;
    const r = {
      id: uid(), reference: newReference(), is_guest: true, requester_id: null, requester_name: d.guest_name, department: "Guest", ...d,
      guest_email: d.guest_email.toLowerCase(), stops: s, destination: s.join(" → "), self_passenger: form.self_passenger.checked,
      passengers: pax, passenger_count: pax.length, status: "pending", created_at: new Date().toISOString(),
    };
    await db.insert("trip_requests", r);
    await notify("request_created", r);
    app.innerHTML = `<div class="auth"><div class="auth-lang">${langButton("on-dark")}</div><div class="card stack" style="text-align:center"><img src="assets/logo.png" alt="" style="height:52px;margin:0 auto" />
      <h2>Request submitted</h2><p>Your reference number is</p><p style="font-size:22px;font-weight:700;color:var(--primary)">${esc(r.reference)}</p>
      <p class="muted small">The HRID transport administrators will review your request${r.guest_email ? " and email you at " + esc(r.guest_email) : ". They will contact you by phone"}.</p>
      <a class="btn btn-outline btn-block" href="#/">Done</a></div></div>`;
  });
}

/* ---------------- dashboard ---------------- */
route("/", null, async () => {
  if (currentUser.role === "admin") return adminDashboard();
  if (currentUser.role === "requester") return requesterDashboard();
  return driverDashboard();
});

async function lastInspection(driverId) {
  return (await db.list("vehicle_inspections")).filter((i) => i.driver_id === driverId).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))[0] || null;
}
function inspectionCard(last) {
  const w = getInspectionWindow();
  if (isInspectionDue(last?.submitted_at)) return `<div class="alert warn"><div><b>Weekly vehicle checklist due</b><div class="small">Safety & maintenance check – due every Sunday at 08:00. This week started ${esc(fmtDateTime(w.start))}.</div></div><a class="btn btn-blue" href="#/inspection">Complete checklist</a></div>`;
  return `<div class="alert ok"><div><b>Checklist completed this week</b><div class="small">Submitted ${esc(fmtDateTime(new Date(last.submitted_at)))}. Next due ${esc(fmtDateTime(w.end))}.</div></div><a class="btn btn-outline btn-sm" href="#/inspection">View</a></div>`;
}
function tripStats(trips) {
  const t = trips.filter((x) => x.trip_date === todayISO());
  const done = t.filter((x) => x.status === "submitted");
  return `<div class="grid stats">
    <div class="card stat"><div class="v">${trips.filter((x) => x.status === "draft").length}</div><div class="l">Draft trips</div></div>
    <div class="card stat"><div class="v">${done.length}</div><div class="l">Completed today</div></div>
    <div class="card stat"><div class="v">${done.reduce((s, x) => s + (x.passengers?.length || 0), 0)}</div><div class="l">Passengers today</div></div>
    <div class="card stat"><div class="v">${done.reduce((s, x) => s + (Number(x.distance_km) || 0), 0)} km</div><div class="l">Distance today</div></div>
  </div>`;
}
const stopsShort = (r) => { const s = r.stops?.length ? r.stops : [r.destination]; return s.length > 1 ? `${esc(s[0])} <span class="muted">+${s.length - 1} more</span>` : esc(s[0]); };
function requestItem(r, href, extra = "") {
  return `<a class="list-item" href="${href}"><div class="row between"><b>${esc(r.origin)} → ${stopsShort(r)}</b><span class="row" style="gap:6px">${r.is_guest ? '<span class="badge b-hrid">Guest</span>' : ""}${badge(r.status)}</span></div>
    ${r.reference ? `<div class="small muted">${esc(r.reference)}</div>` : ""}
    <div class="small muted">${esc(fmtDate(r.trip_date))} · ${esc(r.departure_time)}${r.return_time ? "–" + esc(r.return_time) : ""} · ${esc(r.passenger_count)} passenger(s)</div>
    <div class="small">${esc(r.purpose)}</div>${extra}</a>`;
}

async function driverDashboard() {
  const trips = (await db.list("trips")).filter((t) => t.driver_id === currentUser.id);
  const assigned = (await db.list("trip_requests")).filter((r) => r.assigned_driver_id === currentUser.id && r.status === "approved").sort((a, b) => (a.trip_date + a.departure_time).localeCompare(b.trip_date + b.departure_time));
  await shell("Dashboard", `
    ${inspectionCard(await lastInspection(currentUser.id))}
    <div style="margin-top:14px">${tripStats(trips)}</div>
    <div class="section-title"><h2>Assigned trips</h2><span class="muted small">${assigned.length}</span></div>
    ${assigned.length ? assigned.map((r) => requestItem(r, `#/trips/new?request=${r.id}`, `<div class="row" style="margin-top:8px"><span class="btn btn-primary btn-sm">${icon("play")} Start trip</span><span class="small muted">${esc(vehicleLabel(r.assigned_vehicle_number))} · Requested by ${esc(r.requester_name)}</span></div>`)).join("") : `<div class="card empty">No trips assigned to you right now.</div>`}
    <div class="grid two" style="margin-top:14px">
      <a class="btn btn-primary" href="#/trips/new">${icon("plus")} New trip</a>
      <a class="btn btn-outline" href="#/trips">${icon("list")} My trips</a>
    </div>`);
}

async function requesterDashboard() {
  const reqs = (await db.list("trip_requests")).filter((r) => r.requester_id === currentUser.id);
  const upcoming = reqs.filter((r) => r.status === "approved" && r.trip_date >= todayISO()).sort((a, b) => (a.trip_date + a.departure_time).localeCompare(b.trip_date + b.departure_time));
  await shell("Dashboard", `
    <a class="btn btn-primary btn-block" href="#/requests/new">${icon("send")} Request a trip</a>
    <div class="grid stats" style="margin-top:14px">
      <div class="card stat"><div class="v">${reqs.filter((r) => r.status === "pending").length}</div><div class="l">Pending approval</div></div>
      <div class="card stat"><div class="v">${upcoming.length}</div><div class="l">Approved upcoming</div></div>
      <div class="card stat"><div class="v">${reqs.filter((r) => r.status === "completed").length}</div><div class="l">Completed</div></div>
      <div class="card stat"><div class="v">${reqs.filter((r) => r.status === "rejected").length}</div><div class="l">Rejected</div></div>
    </div>
    <div class="section-title"><h2>Next approved trip</h2></div>
    ${upcoming[0] ? requestItem(upcoming[0], `#/requests/${upcoming[0].id}`, `<div class="small" style="margin-top:6px">Driver: <b>${esc(upcoming[0].assigned_driver_name)}</b> · <b>${esc(vehicleLabel(upcoming[0].assigned_vehicle_number))}</b></div>`) : `<div class="card empty">No upcoming approved trips.</div>`}`);
}

async function adminDashboard() {
  const [reqs, trips, users, insp] = await Promise.all([db.list("trip_requests"), db.list("trips"), db.list("users"), db.list("vehicle_inspections")]);
  const pending = reqs.filter((r) => r.status === "pending");
  const drivers = users.filter((u) => u.role === "driver" && u.active !== false);
  const wk = weekKey();
  const thisWeek = insp.filter((i) => i.week_key === wk);
  const doneIds = new Set(thisWeek.map((i) => i.driver_id));
  const defects = thisWeek.filter((i) => i.has_defects);
  await shell("Admin dashboard", `
    ${tripStats(trips)}
    <div class="grid stats" style="margin-top:12px">
      <a class="card stat" href="#/admin/requests" style="text-decoration:none"><div class="v" style="color:${pending.length ? "var(--warning)" : "var(--primary)"}">${pending.length}</div><div class="l">Requests awaiting approval</div></a>
      <div class="card stat"><div class="v">${drivers.length}</div><div class="l">Active drivers</div></div>
      <a class="card stat" href="#/admin/inspections" style="text-decoration:none"><div class="v">${doneIds.size}/${drivers.length}</div><div class="l">Checklists this week</div></a>
      <a class="card stat" href="#/admin/inspections" style="text-decoration:none"><div class="v" style="color:${defects.length ? "var(--danger)" : "var(--primary)"}">${defects.length}</div><div class="l">Vehicles with defects</div></a>
    </div>
    <div class="section-title"><h2>Pending requests</h2><a href="#/admin/requests" class="small">View all</a></div>
    ${pending.length ? pending.slice(0, 5).map((r) => requestItem(r, `#/admin/requests/${r.id}`, `<div class="small muted">Requested by ${esc(r.requester_name)} · ${esc(r.department)}</div>`)).join("") : `<div class="card empty">No pending requests.</div>`}
    <div class="section-title"><h2>Weekly checklist status</h2><span class="small muted">Week of ${esc(fmtDate(wk))}</span></div>
    <div class="card">${drivers.length ? drivers.map((d) => `<div class="row between" style="padding:6px 0"><span>${esc(d.full_name)}</span>${doneIds.has(d.id) ? (defects.some((x) => x.driver_id === d.id) ? '<span class="badge b-defect">Defects reported</span>' : '<span class="badge b-ok">Completed</span>') : '<span class="badge b-overdue">Not submitted</span>'}</div>`).join("") : '<p class="muted">No drivers yet. Add them under Users.</p>'}</div>`);
}

/* ---------------- weekly inspection (driver) ---------------- */
route("/inspection", ["driver"], async () => {
  const last = await lastInspection(currentUser.id);
  const w = getInspectionWindow();
  if (!isInspectionDue(last?.submitted_at)) {
    return shell("Weekly checklist", `<div class="alert ok"><div><b>This week's checklist is complete</b><div class="small">Next checklist due ${esc(fmtDateTime(w.end))}</div></div></div>${inspectionView(last)}`);
  }
  await shell("Weekly checklist", `
    <form id="insp" class="stack" novalidate>
      <div class="alert warn"><div><b>Due: ${esc(fmtDateTime(w.start))}</b><div class="small">Complete one safety & maintenance checklist every Sunday at 08:00.</div></div></div>
      <div class="card"><h2>Vehicle</h2><div class="grid two">
        ${field("vehicle_number", "Vehicle", { required: true, value: currentUser.default_vehicle || "", options: fleetOptions() })}
        ${field("odometer_km", "Odometer reading (km)", { type: "number", required: true, attrs: 'min="0" inputmode="numeric"' })}
      </div></div>
      ${CHECKLIST.map((sec) => `<div class="card"><h2>${esc(sec.title)}</h2>${sec.items.map(([key, label]) => `
        <div class="ci" data-key="${key}"><div class="ci-top"><span>${esc(label)}</span>
          <span class="seg" role="group" aria-label="${esc(label)}">
            <button type="button" class="ok" data-v="ok" aria-pressed="false">OK</button>
            <button type="button" class="bad" data-v="attention" aria-pressed="false">Needs attention</button>
            <button type="button" class="na" data-v="na" aria-pressed="false">N/A</button>
          </span></div>
          <textarea class="input" data-comment hidden placeholder="Describe the problem (required)"></textarea>
          <span class="err-text" data-ci-err></span></div>`).join("")}</div>`).join("")}
      <div class="card stack">
        ${field("notes", "Additional notes", { type: "textarea" })}
        <label class="check"><input type="checkbox" name="declaration" /> <span>I confirm that I personally inspected this vehicle and the information above is correct.</span></label>
        <span class="err-text" data-err="declaration"></span>
        <button class="btn btn-primary btn-block" type="submit">${icon("check")} Submit checklist</button>
      </div>
    </form>`);
  const form = document.getElementById("insp");
  form.querySelectorAll(".ci").forEach((ci) => {
    ci.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => {
      ci.querySelectorAll(".seg button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      ci.dataset.value = b.dataset.v;
      ci.querySelector("[data-comment]").hidden = b.dataset.v !== "attention";
      ci.querySelector("[data-ci-err]").textContent = "";
    }));
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    let ok = validate(form, (d) => {
      const er = {};
      if (!form.declaration.checked) er.declaration = "Please confirm the declaration";
      if (d.odometer_km !== "" && Number(d.odometer_km) < 0) er.odometer_km = "Cannot be negative";
      return er;
    });
    const items = {};
    form.querySelectorAll(".ci").forEach((ci) => {
      const v = ci.dataset.value, c = ci.querySelector("[data-comment]").value.trim();
      const err = ci.querySelector("[data-ci-err]");
      if (!v) { err.textContent = "Select OK, Needs attention or N/A"; ok = false; }
      else if (v === "attention" && !c) { err.textContent = "Comment required"; ok = false; }
      items[ci.dataset.key] = { status: v, comment: v === "attention" ? c : "" };
    });
    if (!ok) { [...form.querySelectorAll(".err-text")].find((x) => x.textContent)?.scrollIntoView({ behavior: "smooth", block: "center" }); return toast("Please complete all checklist items"); }
    const btn = form.querySelector("[type=submit]"); btn.disabled = true; btn.textContent = "Saving…";
    const d = readForm(form);
    await db.insert("vehicle_inspections", {
      id: uid(), driver_id: currentUser.id, driver_name: currentUser.full_name, vehicle_number: d.vehicle_number, vehicle_model: vehicleModel(d.vehicle_number),
      week_key: weekKey(), odometer_km: Number(d.odometer_km), items, notes: d.notes,
      has_defects: Object.values(items).some((i) => i.status === "attention"), driver_declaration: true,
      gps: await getGPS(), submitted_at: new Date().toISOString(),
    });
    toast("Checklist submitted"); go("/");
  });
});
function inspectionView(i) {
  const lbl = { ok: "OK", attention: "Needs attention", na: "N/A" };
  const cls = { ok: "b-ok", attention: "b-defect", na: "b-na" };
  return `<div class="card" style="margin-top:14px"><h2>Checklist – ${esc(vehicleLabel(i.vehicle_number))}</h2>
    <dl class="kv"><dt>Driver</dt><dd>${esc(i.driver_name)}</dd><dt>Week of</dt><dd>${esc(fmtDate(i.week_key))}</dd><dt>Submitted</dt><dd>${esc(fmtDateTime(new Date(i.submitted_at)))}</dd><dt>Odometer</dt><dd>${esc(i.odometer_km)} km</dd><dt>Location</dt><dd>${gpsText(i.gps)}</dd>${i.notes ? `<dt>Notes</dt><dd>${esc(i.notes)}</dd>` : ""}</dl></div>
    ${CHECKLIST.map((s) => `<div class="card"><h3 style="margin-bottom:8px">${esc(s.title)}</h3>${s.items.map(([k, l]) => { const it = i.items[k] || {}; return `<div class="ci"><div class="ci-top"><span>${esc(l)}</span><span class="badge ${cls[it.status] || "b-na"}">${lbl[it.status] || "-"}</span></div>${it.comment ? `<div class="small" style="color:var(--danger)">${esc(it.comment)}</div>` : ""}</div>`; }).join("")}</div>`).join("")}`;
}
route("/admin/inspections", ["admin"], async () => {
  const list = (await db.list("vehicle_inspections")).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
  const drivers = (await db.list("users")).filter((u) => u.role === "driver" && u.active !== false);
  const wk = weekKey();
  const thisWeek = list.filter((i) => i.week_key === wk);
  await shell("Weekly checklists", `
    <div class="card"><h2>Drivers – this week (from ${esc(fmtDateTime(getInspectionWindow().start))})</h2>
    <div class="table-wrap"><table><thead><tr><th>Driver</th><th>Status</th><th>Vehicle</th><th>Submitted</th></tr></thead><tbody>
    ${drivers.map((u) => { const i = thisWeek.find((x) => x.driver_id === u.id); return `<tr><td>${esc(u.full_name)}</td><td>${i ? (i.has_defects ? '<span class="badge b-defect">Defects</span>' : '<span class="badge b-ok">Completed</span>') : '<span class="badge b-overdue">Not submitted</span>'}</td><td>${i ? esc(vehicleLabel(i.vehicle_number)) : "-"}</td><td>${i ? `<a href="#/admin/inspections/${i.id}">${esc(fmtDateTime(new Date(i.submitted_at)))}</a>` : "-"}</td></tr>`; }).join("") || '<tr><td colspan="4" class="muted">No drivers</td></tr>'}
    </tbody></table></div></div>
    <div class="card"><h2>Fleet – this week</h2>
    <div class="table-wrap"><table><thead><tr><th>No.</th><th>Vehicle</th><th>Plate</th><th>Checklist</th></tr></thead><tbody>
    ${FLEET.map((v) => { const i = thisWeek.filter((x) => x.vehicle_number === v.plate).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))[0]; return `<tr><td>${v.no}</td><td>${esc(v.model)}</td><td dir="ltr" style="text-align:inherit">${esc(v.plate)}</td><td>${i ? `<a href="#/admin/inspections/${i.id}">${i.has_defects ? '<span class="badge b-defect">Defects</span>' : '<span class="badge b-ok">Checked</span>'}</a>` : '<span class="badge b-na">Not checked</span>'}</td></tr>`; }).join("")}
    </tbody></table></div></div>
    <div class="section-title"><h2>History</h2></div>
    ${list.length ? list.map((i) => `<a class="list-item" href="#/admin/inspections/${i.id}"><div class="row between"><b>${esc(vehicleLabel(i.vehicle_number))} · ${esc(i.driver_name)}</b>${i.has_defects ? '<span class="badge b-defect">Defects</span>' : '<span class="badge b-ok">OK</span>'}</div><div class="small muted">${esc(fmtDateTime(new Date(i.submitted_at)))} · ${esc(i.odometer_km)} km</div></a>`).join("") : '<div class="card empty">No checklists submitted yet.</div>'}`);
});
route("/admin/inspections/:id", ["admin"], async ({ id }) => {
  const i = await db.get("vehicle_inspections", id);
  if (!i) return go("/admin/inspections");
  await shell("Checklist details", `<div class="row no-print"><a class="btn btn-outline btn-sm" href="#/admin/inspections">← Back</a><button class="btn btn-outline btn-sm" type="button" onclick="window.print()">${icon("printer")} Print / PDF</button></div>${inspectionView(i)}`);
});

/* ---------------- trip requests (employee) ---------------- */
route("/requests/new", ["requester", "admin"], async () => {
  const employees = (await employeeList()).filter((e) => e.id !== currentUser.id);
  const stops = [""], others = [];
  await shell("Request a trip", `<form id="rq" class="stack" novalidate>
    ${routeCard()}
    <div class="card"><h2>Date & time</h2><div class="grid two">
      ${timeFields()}
      ${field("department", "Your department", { required: true, value: currentUser.department || "" })}
    </div></div>
    <div class="card"><h2>Passengers</h2>
      <label class="check highlight"><input type="checkbox" name="self_passenger" /><span>I, <b>${esc(currentUser.full_name)}</b>, am a passenger on this trip</span></label>
      <h3 style="margin:16px 0 8px">Other passengers</h3>
      <div id="pax"></div>
      <span class="err-text" data-err="passengers"></span>
      <p class="small" id="paxcount" style="margin-top:10px;font-weight:600"></p>
    </div>
    <div class="card stack">
      ${field("purpose", "Purpose of trip", { type: "textarea", required: true })}
      ${field("notes", "Notes for the transport team", { type: "textarea" })}
      <button class="btn btn-primary btn-block" type="submit">${icon("send")} Submit request</button>
    </div>
  </form>`);
  const form = document.getElementById("rq");
  const selfPax = () => paxRecord({ type: "hrid", user_id: currentUser.id, name: currentUser.full_name, employee_no: currentUser.employee_no, department: form.department.value });
  const all = () => [...(form.self_passenger.checked ? [selfPax()] : []), ...others.map(paxRecord)];
  const count = () => (document.getElementById("paxcount").textContent = `Total passengers: ${all().length}`);
  stopsEditor(document.getElementById("stops"), stops);
  passengerEditor(document.getElementById("pax"), others, { employees, onChange: count, emptyText: "Add anyone else travelling – choose HRID employees from the list or enter non-HRID people." });
  form.self_passenger.addEventListener("change", count); count();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate(form, (d) => requestRules(d, stops, others, all()))) return;
    const d = readForm(form); delete d.self_passenger;
    const s = cleanStops(stops), pax = all();
    form.querySelector("[type=submit]").disabled = true;
    const r = {
      id: uid(), reference: newReference(), is_guest: false, requester_id: currentUser.id, requester_name: currentUser.full_name, ...d,
      stops: s, destination: s.join(" → "), self_passenger: form.self_passenger.checked, passengers: pax, passenger_count: pax.length,
      status: "pending", created_at: new Date().toISOString(),
    };
    await db.insert("trip_requests", r);
    if (d.department !== (currentUser.department || "")) await db.update("users", currentUser.id, { department: d.department });
    await notify("request_created", r);
    toast("Request submitted – you and the administrators have been emailed");
    go(currentUser.role === "admin" ? "/admin/requests" : "/requests");
  });
});
route("/requests", ["requester"], async () => {
  const list = (await db.list("trip_requests")).filter((r) => r.requester_id === currentUser.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  await shell("My requests", list.length ? list.map((r) => requestItem(r, `#/requests/${r.id}`)).join("") : `<div class="card empty">You have not requested any trips yet.<div style="margin-top:12px"><a class="btn btn-primary" href="#/requests/new">Request a trip</a></div></div>`);
});
function requestDetails(r) {
  return `<div class="card"><div class="row between" style="margin-bottom:12px"><h2 style="margin:0">Trip request</h2><span class="row" style="gap:6px">${r.is_guest ? '<span class="badge b-hrid">Guest</span>' : ""}${badge(r.status)}</span></div>
    <dl class="kv">${r.reference ? `<dt>Reference</dt><dd>${esc(r.reference)}</dd>` : ""}<dt>Requested by</dt><dd>${esc(r.requester_name)} (${esc(r.is_guest ? "Guest" : r.department)})</dd>
    ${r.is_guest ? `<dt>Organisation</dt><dd>${esc(r.guest_organization)}</dd><dt>Phone</dt><dd><a href="tel:${esc(r.guest_phone)}">${esc(r.guest_phone)}</a></dd><dt>Email</dt><dd>${esc(r.guest_email || "-")}</dd><dt>HRID contact</dt><dd>${esc(r.guest_host)}</dd>` : ""}
    <dt>Route</dt><dd>${routeHTML(r)}</dd>
    <dt>Date</dt><dd>${esc(fmtDate(r.trip_date))}</dd><dt>Time</dt><dd>${esc(r.departure_time)}${r.return_time ? " – return " + esc(r.return_time) : ""}</dd>
    <dt>Passengers (${esc(r.passenger_count)})</dt><dd>${paxListHTML(paxOf(r))}</dd>
    <dt>Purpose</dt><dd>${esc(r.purpose)}</dd>${r.notes ? `<dt>Notes</dt><dd>${esc(r.notes)}</dd>` : ""}
    ${r.assigned_driver_name ? `<dt>Driver</dt><dd>${esc(r.assigned_driver_name)}</dd><dt>Vehicle</dt><dd>${esc(vehicleLabel(r.assigned_vehicle_number))}</dd>` : ""}
    ${r.reviewed_by ? `<dt>Reviewed by</dt><dd>${esc(r.reviewed_by)} · ${esc(fmtDateTime(new Date(r.reviewed_at)))}</dd>` : ""}${r.admin_comment ? `<dt>Comment</dt><dd>${esc(r.admin_comment)}</dd>` : ""}
    <dt>Submitted</dt><dd>${esc(fmtDateTime(new Date(r.created_at)))}</dd></dl></div>`;
}
route("/requests/:id", ["requester"], async ({ id }) => {
  const r = await db.get("trip_requests", id);
  if (!r || r.requester_id !== currentUser.id) return go("/requests");
  await shell("Request details", `<a class="btn btn-outline btn-sm" href="#/requests">← Back</a><div style="margin-top:12px">${requestDetails(r)}</div>${r.status === "pending" ? `<button class="btn btn-danger btn-block" id="cancel" type="button" style="margin-top:14px">Cancel request</button>` : ""}`);
  document.getElementById("cancel")?.addEventListener("click", async () => {
    if (!confirm("Cancel this trip request?")) return;
    const upd = await db.update("trip_requests", id, { status: "cancelled", cancelled_at: new Date().toISOString() });
    await notify("request_cancelled", upd); toast("Request cancelled"); router();
  });
});

/* ---------------- admin: approve & assign ---------------- */
let adminTab = "pending";
route("/admin/requests", ["admin"], async () => {
  const all = (await db.list("trip_requests")).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const tabs = [["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["completed", "Completed"], ["cancelled", "Cancelled"], ["all", "All"]];
  const list = adminTab === "all" ? all : all.filter((r) => r.status === adminTab);
  await shell("Trip requests", `
    <div class="row between no-print" style="margin-bottom:10px"><span></span><a class="btn btn-outline btn-sm" href="#/requests/new">${icon("plus")} New request</a></div>
    <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${adminTab === k}">${l} (${k === "all" ? all.length : all.filter((r) => r.status === k).length})</button>`).join("")}</div>
    ${list.length ? list.map((r) => requestItem(r, `#/admin/requests/${r.id}`, `<div class="small muted">By ${esc(r.requester_name)} · ${esc(r.department)}${r.assigned_driver_name ? ` · Driver: ${esc(r.assigned_driver_name)}` : ""}</div>`)).join("") : `<div class="card empty">No ${adminTab === "all" ? "" : adminTab} requests.</div>`}`);
  app.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { adminTab = b.dataset.tab; router(); }));
});
const toMin = (t) => { if (!t) return null; const [h, m] = t.split(":").map(Number); return h * 60 + m; };
function overlaps(a, b) {
  const as = toMin(a.departure_time), ae = toMin(a.return_time) ?? as + 120;
  const bs = toMin(b.departure_time), be = toMin(b.return_time) ?? bs + 120;
  return as < be && bs < ae;
}
route("/admin/requests/:id", ["admin"], async ({ id }) => {
  const r = await db.get("trip_requests", id);
  if (!r) return go("/admin/requests");
  const drivers = (await db.list("users")).filter((u) => u.role === "driver" && u.active !== false).sort((a, b) => a.full_name.localeCompare(b.full_name));
  const canReview = r.status === "pending" || r.status === "approved";
  await shell("Review request", `<a class="btn btn-outline btn-sm" href="#/admin/requests">← Back</a><div style="margin-top:12px">${requestDetails(r)}</div>
    ${canReview ? `<form id="rv" class="card stack" novalidate><h2>${r.status === "approved" ? "Change assignment" : "Approve & assign driver"}</h2>
      <div class="grid two">
        ${field("driver_id", "Driver", { required: true, value: r.assigned_driver_id || "", options: drivers.map((d) => [d.id, d.full_name]) })}
        ${field("vehicle", "Vehicle", { required: true, value: r.assigned_vehicle_number || "", options: fleetOptions() })}
      </div>
      <div id="conflict"></div>
      ${field("comment", "Comment (required when rejecting)", { type: "textarea", value: r.admin_comment || "" })}
      <div class="grid two"><button class="btn btn-primary" type="submit">${icon("check")} ${r.status === "approved" ? "Save assignment" : "Approve"}</button><button class="btn btn-danger" type="button" id="reject">Reject</button></div>
    </form>` : ""}`);
  const form = document.getElementById("rv");
  if (!form) return;
  const checkConflict = async (fromDriver) => {
    const did = form.driver_id.value, plate = form.vehicle.value, box = document.getElementById("conflict");
    const d = drivers.find((x) => x.id === did);
    if (fromDriver && d?.default_vehicle && !plate) form.vehicle.value = d.default_vehicle;
    const same = (await db.list("trip_requests")).filter((x) => x.id !== r.id && x.status === "approved" && x.trip_date === r.trip_date && overlaps(x, r));
    const dc = did ? same.filter((x) => x.assigned_driver_id === did) : [];
    const vc = form.vehicle.value ? same.filter((x) => x.assigned_vehicle_number === form.vehicle.value) : [];
    const line = (c) => `${esc(c.departure_time)} ${esc(c.origin)} → ${esc(c.destination)}`;
    box.innerHTML = [
      dc.length ? `<div class="alert warn small"><div>${esc(d.full_name)} already has ${dc.length} approved trip(s) at an overlapping time on this date: ${dc.map(line).join("; ")}</div></div>` : "",
      vc.length ? `<div class="alert warn small" style="margin-top:8px"><div>${esc(vehicleLabel(form.vehicle.value))} is already booked at an overlapping time: ${vc.map(line).join("; ")}</div></div>` : "",
    ].join("");
  };
  form.driver_id.addEventListener("change", () => checkConflict(true));
  form.vehicle.addEventListener("change", () => checkConflict(false));
  checkConflict(false);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate(form)) return;
    const d = readForm(form), drv = drivers.find((x) => x.id === d.driver_id);
    form.querySelector("[type=submit]").disabled = true;
    const prev = r.assigned_driver_id && r.assigned_driver_id !== drv.id ? r.assigned_driver_id : null;
    const upd = await db.update("trip_requests", id, {
      status: "approved", assigned_driver_id: drv.id, assigned_driver_name: drv.full_name,
      assigned_vehicle_number: d.vehicle, assigned_vehicle_label: vehicleLabel(d.vehicle),
      admin_comment: d.comment, reviewed_by: currentUser.full_name, reviewed_at: new Date().toISOString(),
    });
    await notify("request_approved", upd, { previous_driver_id: prev });
    toast(`Approved – ${drv.full_name} and the requester have been emailed`); go("/admin/requests");
  });
  document.getElementById("reject").addEventListener("click", async () => {
    const c = form.comment.value.trim();
    if (!c) { form.comment.classList.add("invalid"); form.querySelector('[data-err="comment"]').textContent = "Please give a reason for rejecting"; form.comment.focus(); return; }
    if (!confirm("Reject this request?")) return;
    const prev = r.assigned_driver_id || null;
    const upd = await db.update("trip_requests", id, { status: "rejected", admin_comment: c, assigned_driver_id: null, assigned_driver_name: null, assigned_vehicle_number: null, assigned_vehicle_label: null, reviewed_by: currentUser.full_name, reviewed_at: new Date().toISOString() });
    await notify("request_rejected", upd, { previous_driver_id: prev });
    toast("Request rejected – the requester has been emailed"); go("/admin/requests");
  });
});

/* ---------------- trips (driver) ---------------- */
route("/trips", ["driver", "admin"], async () => {
  let list = (await db.list("trips")).sort((a, b) => (b.trip_date + b.departure_time).localeCompare(a.trip_date + a.departure_time));
  if (currentUser.role === "driver") list = list.filter((t) => t.driver_id === currentUser.id);
  await shell(currentUser.role === "admin" ? "All trips" : "My trips", `
    <div class="field no-print" style="margin-bottom:12px"><label for="q">Search trips</label><input class="input" id="q" type="search" placeholder="Driver, vehicle, place, passenger…" /></div>
    <div id="tlist"></div>`);
  const draw = (q = "") => {
    const n = norm(q);
    const f = list.filter((t) => !n || norm([t.driver_name, t.vehicle_number, t.vehicle_type, t.origin, t.destination, t.purpose, ...(t.passengers || []).map((p) => p.name)].join(" ")).includes(n));
    document.getElementById("tlist").innerHTML = f.length ? f.map((t) => `<a class="list-item" href="#/trips/${t.id}"><div class="row between"><b>${esc(t.origin)} → ${stopsShort(t)}</b>${badge(t.status)}</div><div class="small muted">${esc(fmtDate(t.trip_date))} · ${esc(t.departure_time)} · ${esc(vehicleLabel(t.vehicle_number))} · ${t.passengers?.length || 0} passenger(s)${currentUser.role === "admin" ? " · " + esc(t.driver_name) : ""}</div></a>`).join("") : `<div class="card empty">No trips found.</div>`;
  };
  document.getElementById("q").addEventListener("input", (e) => draw(e.target.value));
  draw();
});

route("/trips/new", ["driver", "admin"], async () => tripForm(null));
route("/trips/:id/edit", ["driver", "admin"], async ({ id }) => {
  const t = await db.get("trips", id);
  if (!t || t.status !== "draft" || (currentUser.role === "driver" && t.driver_id !== currentUser.id)) return go("/trips");
  return tripForm(t);
});

async function tripForm(existing) {
  const qs = new URLSearchParams(location.hash.split("?")[1] || "");
  const req = !existing && qs.get("request") ? await db.get("trip_requests", qs.get("request")) : null;
  if (req && (req.status !== "approved" || (currentUser.role === "driver" && req.assigned_driver_id !== currentUser.id))) { toast("This trip is not assigned to you"); return go("/"); }
  const employees = await employeeList();
  const t = existing || {
    id: uid(), driver_id: currentUser.id, driver_name: currentUser.full_name, employee_no: currentUser.employee_no || "",
    vehicle_number: req?.assigned_vehicle_number || currentUser.default_vehicle || "",
    trip_date: req?.trip_date || todayISO(), departure_time: req?.departure_time || "", return_time: req?.return_time || "",
    origin: req?.origin || "", stops: req ? (req.stops?.length ? [...req.stops] : [req.destination]) : [""],
    purpose: req?.purpose || "", notes: "", request_id: req?.id || null, status: "draft",
    passengers: req ? paxOf(req).map((p) => ({ ...newPax(p.type), ...paxRecord(p), id: uid(), signature: null, signed_at: null })) : [],
  };
  if (!t.stops?.length) t.stops = t.destination ? [t.destination] : [""];
  t.passengers = (t.passengers || []).map((p) => ({ ...newPax(), ...p, type: p.type || (p.user_id ? "hrid" : "external") }));
  if (!t.passengers.length) t.passengers.push(newPax());

  await shell(existing ? "Edit trip" : "New trip", `
    ${req ? `<div class="alert info small" style="margin-bottom:12px"><div>Trip pre-filled from request ${esc(req.reference || "")} by ${esc(req.requester_name)}.</div></div>` : ""}
    <form id="trip" class="stack" novalidate>
      <div class="card"><h2>Driver & vehicle</h2><div class="grid two">
        ${field("driver_name", "Driver name", { required: true, value: t.driver_name, attrs: currentUser.role === "driver" ? "readonly" : "" })}
        ${field("employee_no", "Driver employee number", { value: t.employee_no, attrs: currentUser.role === "driver" ? "readonly" : "" })}
        ${field("vehicle_number", "Vehicle", { required: true, value: t.vehicle_number, options: fleetOptions() })}
        ${field("odometer_start", "Odometer at start (km)", { type: "number", required: true, value: t.odometer_start ?? "", attrs: 'min="0" inputmode="numeric"' })}
        ${field("odometer_end", "Odometer at end (km)", { type: "number", value: t.odometer_end ?? "", attrs: 'min="0" inputmode="numeric"' })}
      </div></div>
      <div class="card"><h2>Route</h2>
        ${field("origin", "Pick-up location", { required: true, value: t.origin })}
        <div class="field" style="margin-top:14px"><span class="label">Destinations <span class="req">*</span></span><div id="stops"></div><span class="err-text" data-err="stops"></span></div>
        <div class="grid two" style="margin-top:14px">
          ${field("trip_date", "Trip date", { type: "date", required: true, value: t.trip_date })}
          ${field("departure_time", "Departure time", { type: "time", required: true, value: t.departure_time })}
          ${field("return_time", "Return time", { type: "time", value: t.return_time })}
        </div>
        <div style="margin-top:12px">${field("purpose", "Purpose of trip", { type: "textarea", required: true, value: t.purpose })}</div>
        <div style="margin-top:12px">${field("notes", "Notes", { type: "textarea", value: t.notes })}</div>
        <div class="grid two" style="margin-top:12px">
          <div><button type="button" class="btn btn-outline btn-block" data-gps="start">${icon("pin")} Capture start GPS</button><div class="small muted" id="gps-start" style="margin-top:4px">${gpsText(t.gps_start)}</div></div>
          <div><button type="button" class="btn btn-outline btn-block" data-gps="end">${icon("pin")} Capture end GPS</button><div class="small muted" id="gps-end" style="margin-top:4px">${gpsText(t.gps_end)}</div></div>
        </div>
      </div>
      <div class="card"><h2>Passengers & signatures</h2>
        <div id="pax"></div><span class="err-text" data-err="passengers"></span></div>
      <div class="card stack">
        <label class="check"><input type="checkbox" name="declaration" ${t.driver_declaration ? "checked" : ""} /><span>I declare that the trip details above are correct and every passenger signed personally.</span></label>
        <span class="err-text" data-err="declaration"></span>
        <div class="grid two"><button type="button" class="btn btn-outline" id="draft">Save draft</button><button type="submit" class="btn btn-primary">${icon("check")} Submit trip</button></div>
      </div>
    </form>`);

  const form = document.getElementById("trip");
  stopsEditor(document.getElementById("stops"), t.stops);
  passengerEditor(document.getElementById("pax"), t.passengers, { employees, signatures: true });
  form.querySelectorAll("[data-gps]").forEach((b) => b.addEventListener("click", async () => {
    b.disabled = true; const k = b.dataset.gps; const el = document.getElementById("gps-" + k); el.textContent = "Locating…";
    const g = await getGPS(); t["gps_" + k] = g; el.innerHTML = g ? gpsText(g) : "Location unavailable – allow location access";
    b.disabled = false;
  }));

  const save = async (status) => {
    const d = readForm(form);
    const s = cleanStops(t.stops);
    const pax = t.passengers.filter((p) => p.user_id || String(p.name || "").trim() || p.signature).map((p) => ({ ...paxRecord(p), signature: p.signature, signed_at: p.signed_at }));
    const rec = {
      ...t, ...d, stops: s, destination: s.join(" → "), passengers: pax,
      vehicle_type: vehicleModel(d.vehicle_number),
      odometer_start: d.odometer_start === "" ? null : Number(d.odometer_start), odometer_end: d.odometer_end === "" ? null : Number(d.odometer_end),
      driver_declaration: form.declaration.checked, status, updated_at: new Date().toISOString(),
    };
    delete rec.declaration;
    rec.distance_km = rec.odometer_start != null && rec.odometer_end != null ? rec.odometer_end - rec.odometer_start : null;
    if (status === "submitted") rec.submitted_at = new Date().toISOString();
    if (await db.get("trips", t.id)) await db.update("trips", t.id, rec); else await db.insert("trips", { ...rec, created_at: new Date().toISOString() });
    if (status === "submitted" && rec.request_id) await db.update("trip_requests", rec.request_id, { status: "completed", trip_id: t.id });
    return rec;
  };
  document.getElementById("draft").addEventListener("click", async () => { await save("draft"); toast("Draft saved"); go("/trips"); });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ok = validate(form, (d) => {
      const er = {};
      if (!form.declaration.checked) er.declaration = "Please confirm the driver declaration";
      if (!cleanStops(t.stops).length) er.stops = "Enter at least one destination";
      if (d.odometer_end !== "" && Number(d.odometer_end) < Number(d.odometer_start)) er.odometer_end = "Must be greater than the start reading";
      if (d.return_time && d.return_time <= d.departure_time) er.return_time = "Must be after departure";
      const pe = paxErrors(t.passengers);
      if (pe) er.passengers = pe;
      else if (t.passengers.some((p) => !p.signature)) er.passengers = "Every passenger must sign before the trip can be submitted";
      return er;
    });
    if (!ok) return toast("Please fix the highlighted fields");
    form.querySelector("[type=submit]").disabled = true;
    await save("submitted"); toast("Trip submitted"); go(`/trips/${t.id}`);
  });
}

route("/trips/:id", ["driver", "admin"], async ({ id }) => {
  const t = await db.get("trips", id);
  if (!t || (currentUser.role === "driver" && t.driver_id !== currentUser.id)) return go("/trips");
  await shell("Trip summary", `
    <div class="row no-print" style="margin-bottom:12px"><a class="btn btn-outline btn-sm" href="#/trips">← Back</a>
      ${t.status === "draft" ? `<a class="btn btn-blue btn-sm" href="#/trips/${t.id}/edit">Edit trip</a>` : ""}
      <button class="btn btn-outline btn-sm" type="button" onclick="window.print()">${icon("printer")} Export PDF</button></div>
    <div class="print-only" style="margin-bottom:12px"><div class="row"><img src="assets/logo.png" style="height:44px" alt="" /><div><b>Hiwa Rauf for Investment & Development</b><div class="small">Employee Transportation Trip Report</div></div></div></div>
    <div class="card"><div class="row between" style="margin-bottom:12px"><h2 style="margin:0">Trip report</h2>${badge(t.status)}</div>
      <div class="grid two">
        <dl class="kv"><dt>Driver</dt><dd>${esc(t.driver_name)}${t.employee_no ? " (#" + esc(t.employee_no) + ")" : ""}</dd><dt>Vehicle</dt><dd>${esc(vehicleLabel(t.vehicle_number))}</dd><dt>Odometer</dt><dd>${esc(t.odometer_start ?? "-")} → ${esc(t.odometer_end ?? "-")} km</dd><dt>Distance</dt><dd>${t.distance_km != null ? esc(t.distance_km) + " km" : "-"}</dd><dt>Date</dt><dd>${esc(fmtDate(t.trip_date))}</dd><dt>Departure</dt><dd>${esc(t.departure_time)}</dd><dt>Return</dt><dd>${esc(t.return_time || "-")}</dd></dl>
        <dl class="kv"><dt>Route</dt><dd>${routeHTML(t)}</dd><dt>Start GPS</dt><dd>${gpsText(t.gps_start)}</dd><dt>End GPS</dt><dd>${gpsText(t.gps_end)}</dd></dl>
      </div>
      <dl class="kv" style="margin-top:10px"><dt>Purpose</dt><dd>${esc(t.purpose)}</dd>${t.notes ? `<dt>Notes</dt><dd>${esc(t.notes)}</dd>` : ""}${t.submitted_at ? `<dt>Submitted</dt><dd>${esc(fmtDateTime(new Date(t.submitted_at)))}</dd>` : ""}<dt>Declaration</dt><dd>${t.driver_declaration ? "Confirmed by driver" : "Not confirmed"}</dd></dl></div>
    <div class="card"><h2>Passengers (${t.passengers.length})</h2><div class="table-wrap"><table><thead><tr><th>#</th><th>Passenger</th><th>Signature</th></tr></thead><tbody>
      ${t.passengers.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.name)}<div style="margin-top:4px">${paxBadge({ ...p, type: p.type || (p.user_id ? "hrid" : "external") })}</div></td><td>${p.signature ? `<img class="sig-img" src="${p.signature}" alt="signature" /><div class="small muted">${esc(fmtDateTime(new Date(p.signed_at)))}</div>` : '<span class="badge b-pending">Missing</span>'}</td></tr>`).join("")}
    </tbody></table></div></div>`);
});

/* ---------------- users (admin) ---------------- */
route("/admin/users", ["admin"], async () => {
  const users = (await db.list("users")).sort((a, b) => a.role.localeCompare(b.role) || a.full_name.localeCompare(b.full_name));
  await shell("Users", `
    <div class="grid three no-print">
      <button class="btn btn-primary" type="button" id="addu">${icon("plus")} Add user</button>
      <label class="btn btn-blue" for="imp">${icon("users")} Import CSV</label><input id="imp" type="file" accept=".csv,text/csv" hidden />
      <a class="btn btn-outline" href="#/admin/emails">${icon("send")} Email log</a>
    </div>
    <div class="field no-print" style="margin-top:14px"><label for="uq">Search users</label><input class="input" id="uq" type="search" placeholder="Name, employee no., email, role…" /></div>
    <p class="small muted" style="margin-top:8px" id="ucount"></p>
    <div class="card" style="margin-top:8px"><div class="table-wrap"><table><thead><tr><th>Name</th><th>No.</th><th>Role</th><th>Email</th><th>Status</th><th></th></tr></thead><tbody id="ubody"></tbody></table></div></div>`);
  const open = (u) => {
    modal(`<form class="stack" novalidate><h2>${u ? "Edit user" : "Add user"}</h2>
      ${field("full_name", "Full name", { required: true, value: u?.full_name || "" })}
      ${field("role", "Role", { required: true, value: u?.role || "requester", options: [["requester", "Employee (requests trips)"], ["driver", "Driver"], ["admin", "Administrator"]] })}
      <div class="grid two">${field("employee_no", "Employee number", { required: true, value: u?.employee_no || "" })}${field("email", "Email (for notifications)", { type: "email", value: u?.email || "" })}</div>
      ${field("department", "Department", { value: u?.department || "" })}
      ${field("default_vehicle", "Default vehicle (drivers)", { value: u?.default_vehicle || "", options: fleetOptions() })}
      ${field("password", u ? "Set a temporary password (leave blank to keep)" : "Temporary password (e.g. birthday DDMMYYYY)", { type: "password", required: !u, attrs: 'autocomplete="new-password"' })}
      <p class="small muted">The user must change a temporary password at their next sign-in.</p>
      ${u && u.id !== currentUser.id ? `<label class="check"><input type="checkbox" name="active" ${u.active !== false ? "checked" : ""} /><span>Account active</span></label>` : ""}
      <div class="grid two"><button class="btn btn-outline" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">Save</button></div></form>`, (bg, close) => {
      const f = bg.querySelector("form");
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const all = await db.list("users");
        if (!validate(f, (d) => {
          const er = {};
          if (all.some((x) => String(x.employee_no) === d.employee_no && x.id !== u?.id)) er.employee_no = "This employee number already exists";
          if (d.email && all.some((x) => norm(x.email) === norm(d.email) && x.id !== u?.id)) er.email = "This email is already used";
          if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) er.email = "Enter a valid email";
          if (d.password && d.password.length < 6) er.password = "At least 6 characters";
          if (u?.id === currentUser.id && d.role !== "admin") er.role = "You cannot remove your own administrator role";
          return er;
        })) return;
        const d = readForm(f);
        const rec = { full_name: d.full_name.replace(/\s+/g, " "), username: norm(d.full_name), role: d.role, employee_no: d.employee_no, email: d.email.toLowerCase(), department: d.department, default_vehicle: d.default_vehicle, vehicle_type: vehicleModel(d.default_vehicle) };
        if (u && u.id !== currentUser.id) rec.active = f.active.checked;
        if (d.password) { rec.salt = uid(); rec.password_hash = await hash(d.password, rec.salt); rec.must_change_password = true; }
        if (u) await db.update("users", u.id, rec); else await db.insert("users", { id: uid(), ...rec, active: true, created_at: new Date().toISOString() });
        close(); toast("User saved"); router();
      });
    });
  };
  const drawUsers = (q = "") => {
    const n = norm(q);
    const f = users.filter((u) => !n || norm([u.full_name, u.employee_no, u.email, ROLE_LABEL[u.role], u.department].join(" ")).includes(n));
    document.getElementById("ucount").textContent = `${f.length} of ${users.length} users · ${users.filter((u) => u.role === "admin").length} admins · ${users.filter((u) => u.role === "driver").length} drivers`;
    document.getElementById("ubody").innerHTML = f.map((u) => `<tr><td>${esc(u.full_name)}${u.must_change_password ? '<div class="small muted">Has not signed in yet</div>' : ""}${u.role === "driver" && u.default_vehicle ? `<div class="small muted">${esc(vehicleLabel(u.default_vehicle))}</div>` : ""}</td><td>${esc(u.employee_no || "-")}</td><td>${esc(ROLE_LABEL[u.role])}</td><td class="small" style="word-break:break-all">${esc(u.email || "-")}</td><td>${u.active === false ? '<span class="badge b-cancelled">Disabled</span>' : '<span class="badge b-ok">Active</span>'}</td><td><button class="btn btn-outline btn-sm" type="button" data-edit="${u.id}">Edit</button></td></tr>`).join("") || '<tr><td colspan="6" class="muted">No users found</td></tr>';
    app.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => open(users.find((u) => u.id === b.dataset.edit))));
  };
  document.getElementById("addu").addEventListener("click", () => open(null));
  document.getElementById("uq").addEventListener("input", (e) => drawUsers(e.target.value));
  document.getElementById("imp").addEventListener("change", (e) => importUsersCSV(e.target.files[0], () => router()));
  drawUsers();
});

/* ---------------- email log (admin) ---------------- */
route("/admin/emails", ["admin"], async () => {
  const jobs = (await db.list("email_outbox")).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 100);
  const label = { request_created: "New request", request_approved: "Approved / assigned", request_rejected: "Rejected", request_cancelled: "Cancelled" };
  await shell("Email log", `
    <a class="btn btn-outline btn-sm" href="#/admin/users">← Back</a>
    ${MODE === "local" ? `<div class="alert warn small" style="margin-top:12px"><div>Demo mode – emails are <b>not sent</b>. This log shows exactly what will be sent once Supabase and the Microsoft 365 mailbox are connected (see README).</div></div>` : ""}
    <div style="margin-top:12px">${jobs.length ? jobs.map((j) => `<div class="card"><div class="row between"><b>${esc(label[j.event] || j.event)}</b><span class="badge ${j.status === "sent" ? "b-ok" : j.status === "failed" ? "b-defect" : "b-pending"}">${esc(j.status)}</span></div>
      <div class="small muted">${esc(fmtDateTime(new Date(j.created_at)))}${j.error ? " · " + esc(j.error) : ""}</div>
      ${(j.preview || []).map((m, i) => `<details style="margin-top:8px"><summary class="small" style="cursor:pointer"><b>To:</b> ${esc(m.to)} – ${esc(m.subject)}</summary><div style="margin-top:8px;border:1px solid var(--border);border-radius:8px;overflow:hidden" data-mail="${esc(j.id)}:${i}"></div></details>`).join("") || '<p class="small muted">No recipients with an email address.</p>'}</div>`).join("") : '<div class="card empty">No emails yet.</div>'}</div>`);
  app.querySelectorAll("[data-mail]").forEach((el) => {
    const [jid, i] = el.dataset.mail.split(":");
    const m = jobs.find((j) => j.id === jid).preview[+i];
    const f = document.createElement("iframe");
    f.setAttribute("sandbox", ""); f.title = m.subject; f.style.cssText = "width:100%;height:560px;border:0;background:#F5F7FA"; f.srcdoc = m.html;
    el.appendChild(f);
  });
});

/* ---------------- profile ---------------- */
route("/profile", null, async () => {
  await shell("Profile", `
    <div class="card"><dl class="kv"><dt>Name</dt><dd>${esc(currentUser.full_name)}</dd><dt>Role</dt><dd>${esc(ROLE_LABEL[currentUser.role])}</dd><dt>Employee number</dt><dd>${esc(currentUser.employee_no || "-")}</dd><dt>Email</dt><dd>${esc(currentUser.email || "-")}</dd><dt>Department</dt><dd>${esc(currentUser.department || "-")}</dd>${currentUser.default_vehicle ? `<dt>Vehicle</dt><dd>${esc(vehicleLabel(currentUser.default_vehicle))}</dd>` : ""}</dl></div>
    <form id="pw" class="card stack" novalidate><h2>Change password</h2>
      ${field("current", "Current password", { type: "password", required: true, attrs: 'autocomplete="current-password"' })}
      ${field("password", "New password", { type: "password", required: true, attrs: 'autocomplete="new-password"' })}
      ${field("password2", "Confirm new password", { type: "password", required: true, attrs: 'autocomplete="new-password"' })}
      <button class="btn btn-blue" type="submit">Update password</button></form>
    <div class="card row between" style="margin-top:14px"><div><b>Language</b><div class="small muted">English / کوردی</div></div>${langButton("btn btn-outline")}</div>
    <button class="btn btn-danger btn-block" type="button" id="logout" style="margin-top:14px">${icon("logout")} Sign out</button>`);
  document.getElementById("logout").addEventListener("click", () => { session.clear(); go("/"); router(); });
  document.getElementById("pw").addEventListener("submit", async (e) => {
    e.preventDefault(); const f = e.target;
    if (!validate(f, passwordRules)) return;
    if ((await hash(f.current.value, currentUser.salt)) !== currentUser.password_hash) { f.current.classList.add("invalid"); f.querySelector('[data-err="current"]').textContent = "Current password is incorrect"; return; }
    const salt = uid(); await db.update("users", currentUser.id, { salt, password_hash: await hash(f.password.value, salt) });
    f.reset(); toast("Password updated");
  });
});

router();
