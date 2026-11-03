/* HRID FleetFlow – trip & delivery requests, driver assignment, signatures, arrival times,
   weekly vehicle checklists, vehicle problem reports and monthly reports.
   Plain HTML/CSS/JS – no build step. Works on GitHub Pages, Azure Static Web Apps or any static host. */
import { langButton } from "./js/i18n.js";
import { db, MODE } from "./js/store.js";
import { getInspectionWindow, isInspectionDue, weekKey, fmtDateTime, fmtDate, fmtTime, fmtMonth, todayISO, localISODate } from "./js/schedule.js";
import { CHECKLIST, checklistLabel, ISSUE_CATEGORIES, SEVERITIES } from "./js/checklist.js";
import { FLEET, fleetOptions, vehicleLabel, vehicleModel } from "./js/fleet.js";
import { icon } from "./js/icons.js";
import { columnChart, barChart, donutChart, PALETTE } from "./js/charts.js";
import {
  esc, uid, norm, toast, modal, field, readForm, validate, badge, statusLabel, getGPS, gpsText,
  cleanStops, stopsEditor, routeHTML, newPax, paxRecord, paxOf, paxErrors, paxListHTML, paxBadge, passengerEditor,
  newItem, cleanItems, itemsErrors, itemsListHTML, itemsEditor, signatureModal, downloadCSV,
} from "./js/ui.js";
import { buildEmails } from "./supabase/functions/_shared/emails.js";

const app = document.getElementById("app");
const ROLE_LABEL = { admin: "Administrator", driver: "Driver", requester: "Employee" };
const APP_URL = (window.HRID_CONFIG || {}).APP_URL || location.origin + location.pathname;
const newReference = () => "TR-" + todayISO().slice(2).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
const isItems = (r) => r?.trip_type === "items";
const SEVERITY_LABEL = Object.fromEntries(SEVERITIES);

/* ---------------- email notifications ----------------
   Each event is written to email_outbox. In Supabase mode a database webhook calls the send-email
   function, which sends through Microsoft 365. Until that is set up, emails are only shown in the Email log. */
async function notify(event, { request = null, issues = null, previous_driver_id = null } = {}) {
  try {
    const users = await db.list("users");
    const byId = (id) => users.find((u) => u.id === id) || null;
    const admins = users.filter((u) => u.role === "admin" && u.active !== false && u.email);
    const ctx = issues
      ? { issues, admins, appUrl: APP_URL }
      : {
        request, admins, appUrl: APP_URL,
        requesterEmail: request.is_guest ? request.guest_email : byId(request.requester_id)?.email,
        driver: byId(request.assigned_driver_id),
        previousDriver: byId(previous_driver_id),
      };
    const preview = buildEmails(event, ctx).map(({ to, subject, html }) => ({ to, subject, html }));
    await db.insert("email_outbox", {
      id: uid(), event, request_id: request?.id || null, issue_ids: issues ? issues.map((i) => i.id) : null, previous_driver_id,
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
const query = () => new URLSearchParams(location.hash.split("?")[1] || "");

const NAV = {
  driver: [["/", "Dashboard", "home"], ["/trips", "My trips", "list"], ["/trips/new", "New trip", "plus"], ["/inspection", "Checklist", "clipboard"], ["/profile", "Profile", "user"]],
  requester: [["/", "Dashboard", "home"], ["/requests/new", "Request", "send"], ["/requests", "My requests", "list"], ["/profile", "Profile", "user"]],
  admin: [["/", "Dashboard", "home"], ["/admin/requests", "Requests", "inbox"], ["/trips", "Trips", "list"], ["/admin/vehicles", "Vehicles", "clipboard"], ["/admin/reports", "Reports", "chart"], ["/admin/users", "Users", "users"]],
};
function activeNav(path, items) {
  return items.filter(([to]) => (to === "/" ? path === "/" : path === to || path.startsWith(to + "/")))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[0];
}

async function shell(title, body) {
  const path = currentPath();
  const items = NAV[currentUser.role] || NAV.driver;
  const cur = activeNav(path, items);
  const dots = {};
  if (currentUser.role === "admin") {
    const [reqs, issues] = await Promise.all([db.list("trip_requests"), db.list("vehicle_issues")]);
    dots["/admin/requests"] = reqs.filter((r) => r.status === "pending").length;
    dots["/admin/vehicles"] = issues.filter((i) => i.status === "open").length;
  }
  if (currentUser.role === "requester") {
    dots["/requests"] = (await db.list("trip_requests")).filter((r) => r.requester_id === currentUser.id && r.status === "delivered").length;
  }
  const dot = (to) => (dots[to] ? `<span class="dot">${dots[to]}</span>` : "");
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
      <ul class="top-nav">${items.map(([to, label]) => `<li><a href="#${to}" class="${cur === to ? "active" : ""}" ${cur === to ? 'aria-current="page"' : ""}>${label}${dots[to] ? ` (${dots[to]})` : ""}</a></li>`).join("")}
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
const langCorner = () => `<div class="auth-lang">${langButton("on-dark")}</div>`;
function renderSetup() {
  app.innerHTML = `<div class="auth">${langCorner()}<form class="card stack" id="setup" novalidate>
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
  app.innerHTML = `<div class="auth">${langCorner()}<form class="card stack" id="login" novalidate>
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
  app.innerHTML = `<div class="auth">${langCorner()}<form class="card stack" id="fc" novalidate>
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
function timeRules(d) {
  const er = {};
  if (d.trip_date && d.trip_date < todayISO()) er.trip_date = "Date cannot be in the past";
  if (d.return_time && d.departure_time && d.return_time <= d.departure_time) er.return_time = "Must be after departure";
  return er;
}

/* ---------------- guest request (no login, passengers only) ---------------- */
function renderGuest() {
  const stops = [""], others = [];
  app.innerHTML = `<div class="auth" style="place-items:start center">${langCorner()}<form class="stack" id="gq" novalidate style="width:100%;max-width:680px;margin:12px 0">
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
      const er = timeRules(d);
      if (!cleanStops(stops).length) er.stops = "Enter at least one destination";
      const pe = paxErrors(others, all()); if (pe) er.passengers = pe;
      if (!form.consent.checked) er.consent = "Please confirm";
      if (d.guest_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.guest_email)) er.guest_email = "Enter a valid email";
      if (d.guest_phone && d.guest_phone.replace(/\D/g, "").length < 7) er.guest_phone = "Enter a valid phone number";
      return er;
    })) return;
    const d = readForm(form); delete d.consent; delete d.self_passenger;
    const s = cleanStops(stops), pax = all();
    form.querySelector("[type=submit]").disabled = true;
    const r = {
      id: uid(), reference: newReference(), trip_type: "passengers", is_guest: true, requester_id: null, requester_name: d.guest_name, department: "Guest", ...d,
      guest_email: d.guest_email.toLowerCase(), stops: s, destination: s.join(" → "), self_passenger: form.self_passenger.checked,
      passengers: pax, passenger_count: pax.length, status: "pending", created_at: new Date().toISOString(),
    };
    await db.insert("trip_requests", r);
    await notify("request_created", { request: r });
    app.innerHTML = `<div class="auth">${langCorner()}<div class="card stack" style="text-align:center"><img src="assets/logo.png" alt="" style="height:52px;margin:0 auto" />
      <h2>Request submitted</h2><p>Your reference number is</p><p style="font-size:22px;font-weight:700;color:var(--primary)">${esc(r.reference)}</p>
      <p class="muted small">${r.guest_email ? `The HRID transport administrators will review your request and email you at ${esc(r.guest_email)}.` : "The HRID transport administrators will review your request. They will contact you by phone."}</p>
      <a class="btn btn-outline btn-block" href="#/">Done</a></div></div>`;
  });
}

/* ---------------- dashboards ---------------- */
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
  const done = trips.filter((x) => x.trip_date === todayISO() && x.status === "submitted");
  return `<div class="grid stats">
    <div class="card stat"><div class="v">${trips.filter((x) => x.status === "draft").length}</div><div class="l">Draft trips</div></div>
    <div class="card stat"><div class="v">${done.length}</div><div class="l">Completed today</div></div>
    <div class="card stat"><div class="v">${done.reduce((s, x) => s + (isItems(x) ? 0 : x.passengers?.length || 0), 0)}</div><div class="l">Passengers today</div></div>
    <div class="card stat"><div class="v">${done.reduce((s, x) => s + (Number(x.distance_km) || 0), 0)} km</div><div class="l">Distance today</div></div>
  </div>`;
}
const stopsShort = (r) => { const s = r.stops?.length ? r.stops : [r.destination]; return s.length > 1 ? `${esc(s[0])} <span class="muted">+${s.length - 1} more</span>` : esc(s[0]); };
const typeBadge = (r) => (isItems(r) ? `<span class="badge b-items">${icon("box")} Items</span>` : "");
function requestItem(r, href, extra = "") {
  const what = isItems(r) ? `${(r.items || []).reduce((s, i) => s + Number(i.quantity || 0), 0)} item(s)` : `${esc(r.passenger_count)} passenger(s)`;
  return `<a class="list-item" href="${href}"><div class="row between"><b>${esc(r.origin)} → ${stopsShort(r)}</b><span class="row" style="gap:6px">${typeBadge(r)}${r.is_guest ? '<span class="badge b-hrid">Guest</span>' : ""}${badge(r.status)}</span></div>
    ${r.reference ? `<div class="small muted">${esc(r.reference)}</div>` : ""}
    <div class="small muted">${esc(fmtDate(r.trip_date))} · ${esc(r.departure_time)}${r.return_time ? "–" + esc(r.return_time) : ""} · ${what}</div>
    <div class="small">${esc(r.purpose)}</div>${extra}</a>`;
}

async function driverDashboard() {
  const [allTrips, reqs, issues] = await Promise.all([db.list("trips"), db.list("trip_requests"), db.list("vehicle_issues")]);
  const trips = allTrips.filter((t) => t.driver_id === currentUser.id);
  const assigned = reqs.filter((r) => r.assigned_driver_id === currentUser.id && r.status === "approved").sort((a, b) => (a.trip_date + a.departure_time).localeCompare(b.trip_date + b.departure_time));
  const myOpen = issues.filter((i) => i.reported_by_id === currentUser.id && i.status === "open");
  await shell("Dashboard", `
    ${inspectionCard(await lastInspection(currentUser.id))}
    <div style="margin-top:14px">${tripStats(trips)}</div>
    <div class="section-title"><h2>Assigned trips</h2><span class="muted small">${assigned.length}</span></div>
    ${assigned.length ? assigned.map((r) => requestItem(r, `#/trips/new?request=${r.id}`, `<div class="row" style="margin-top:8px"><span class="btn btn-primary btn-sm">${icon("play")} Start trip</span><span class="small muted">${esc(vehicleLabel(r.assigned_vehicle_number))} · Requested by ${esc(r.requester_name)}</span></div>`)).join("") : `<div class="card empty">No trips assigned to you right now.</div>`}
    <div class="grid three" style="margin-top:14px">
      <a class="btn btn-primary" href="#/trips/new">${icon("plus")} New trip</a>
      <a class="btn btn-outline" href="#/trips">${icon("list")} My trips</a>
      <a class="btn btn-danger" href="#/report-issue">${icon("alert")} Report vehicle problem</a>
    </div>
    ${myOpen.length ? `<div class="section-title"><h2>My open problem reports</h2></div>${myOpen.map(issueItem).join("")}` : ""}`);
}

async function requesterDashboard() {
  const reqs = (await db.list("trip_requests")).filter((r) => r.requester_id === currentUser.id);
  const upcoming = reqs.filter((r) => r.status === "approved" && r.trip_date >= todayISO()).sort((a, b) => (a.trip_date + a.departure_time).localeCompare(b.trip_date + b.departure_time));
  const toSign = reqs.filter((r) => r.status === "delivered");
  await shell("Dashboard", `
    ${toSign.map((r) => `<div class="alert warn"><div><b>Delivery completed – your signature is needed</b><div class="small">${esc(r.reference)} · ${esc(r.origin)} → ${esc(r.destination)}</div></div><a class="btn btn-blue" href="#/requests/${r.id}">${icon("pen")} Confirm & sign</a></div>`).join("")}
    <a class="btn btn-primary btn-block" href="#/requests/new" style="margin-top:${toSign.length ? 14 : 0}px">${icon("send")} Request a trip</a>
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
  const [reqs, trips, users, insp, issues] = await Promise.all([db.list("trip_requests"), db.list("trips"), db.list("users"), db.list("vehicle_inspections"), db.list("vehicle_issues")]);
  const pending = reqs.filter((r) => r.status === "pending");
  const drivers = users.filter((u) => u.role === "driver" && u.active !== false);
  const wk = weekKey();
  const thisWeek = insp.filter((i) => i.week_key === wk);
  const doneIds = new Set(thisWeek.map((i) => i.driver_id));
  const open = issues.filter((i) => i.status === "open").sort(issueOrder);
  const unsafe = open.filter((i) => i.severity === "unsafe");
  await shell("Admin dashboard", `
    ${unsafe.length ? `<div class="alert err" style="margin-bottom:14px"><div><b>${unsafe.length} unsafe vehicle problem(s) reported</b><div class="small">${[...new Set(unsafe.map((i) => vehicleLabel(i.vehicle_number)))].join(", ")}</div></div><a class="btn btn-danger btn-sm" href="#/admin/vehicles">View</a></div>` : ""}
    ${tripStats(trips)}
    <div class="grid stats" style="margin-top:12px">
      <a class="card stat" href="#/admin/requests" style="text-decoration:none"><div class="v" style="color:${pending.length ? "var(--warning)" : "var(--primary)"}">${pending.length}</div><div class="l">Requests awaiting approval</div></a>
      <div class="card stat"><div class="v">${drivers.length}</div><div class="l">Active drivers</div></div>
      <a class="card stat" href="#/admin/vehicles" style="text-decoration:none"><div class="v">${doneIds.size}/${drivers.length}</div><div class="l">Checklists this week</div></a>
      <a class="card stat" href="#/admin/vehicles" style="text-decoration:none"><div class="v" style="color:${open.length ? "var(--danger)" : "var(--primary)"}">${open.length}</div><div class="l">Open vehicle problems</div></a>
    </div>
    <div class="section-title"><h2>Pending requests</h2><a href="#/admin/requests" class="small">View all</a></div>
    ${pending.length ? pending.slice(0, 5).map((r) => requestItem(r, `#/admin/requests/${r.id}`, `<div class="small muted">Requested by ${esc(r.requester_name)} · ${esc(r.department)}</div>`)).join("") : `<div class="card empty">No pending requests.</div>`}
    <div class="section-title"><h2>Open vehicle problems</h2><a href="#/admin/vehicles" class="small">View all</a></div>
    ${open.length ? open.slice(0, 5).map(issueItem).join("") : `<div class="card empty">No open vehicle problems.</div>`}
    <div class="section-title"><h2>Weekly checklist status</h2><span class="small muted">Week of ${esc(fmtDate(wk))}</span></div>
    <div class="card">${drivers.length ? drivers.map((d) => `<div class="row between" style="padding:6px 0"><span>${esc(d.full_name)}</span>${doneIds.has(d.id) ? (thisWeek.some((x) => x.driver_id === d.id && x.has_defects) ? '<span class="badge b-defect">Defects reported</span>' : '<span class="badge b-ok">Completed</span>') : '<span class="badge b-overdue">Not submitted</span>'}</div>`).join("") : '<p class="muted">No drivers yet. Add them under Users.</p>'}</div>
    <a class="btn btn-blue btn-block" href="#/admin/reports" style="margin-top:14px">${icon("chart")} Monthly reports</a>`);
}

/* ---------------- vehicle problems (issues) ---------------- */
const SEV_RANK = { unsafe: 0, major: 1, minor: 2 };
const issueOrder = (a, b) => (SEV_RANK[a.severity] - SEV_RANK[b.severity]) || b.reported_at.localeCompare(a.reported_at);
function issueItem(i) {
  const href = currentUser.role === "admin" ? `#/admin/vehicles/issues/${i.id}` : `#/issues/${i.id}`;
  return `<a class="list-item" href="${href}"><div class="row between"><b>${esc(vehicleLabel(i.vehicle_number))}</b><span class="row" style="gap:6px">${badge(i.severity)}${badge(i.status)}</span></div>
    <div>${esc(i.title)}</div>
    <div class="small muted">${esc(fmtDateTime(new Date(i.reported_at)))} · ${esc(i.reported_by_name)} · ${i.source === "checklist" ? "Weekly checklist" : "Driver report"}</div></a>`;
}
async function saveIssues(list) {
  for (const i of list) await db.insert("vehicle_issues", i);
  if (list.length) await notify("vehicle_issue", { issues: list });
}
route("/report-issue", ["driver", "admin"], async () => {
  await shell("Report vehicle problem", `<form id="iss" class="card stack" novalidate>
    <p class="small muted">Use this any time a vehicle has a problem. The administrators are notified immediately.</p>
    <div class="grid two">
      ${field("vehicle_number", "Vehicle", { required: true, value: currentUser.default_vehicle || "", options: fleetOptions() })}
      ${field("category", "Problem type", { required: true, options: ISSUE_CATEGORIES })}
    </div>
    ${field("severity", "How serious is it?", { required: true, options: SEVERITIES })}
    ${field("description", "Describe the problem", { type: "textarea", required: true })}
    ${field("odometer_km", "Odometer reading (km)", { type: "number", attrs: 'min="0" inputmode="numeric"' })}
    <button class="btn btn-danger btn-block" type="submit">${icon("alert")} Send problem report</button>
  </form>`);
  const form = document.getElementById("iss");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate(form, (d) => (d.odometer_km !== "" && Number(d.odometer_km) < 0 ? { odometer_km: "Cannot be negative" } : {}))) return;
    form.querySelector("[type=submit]").disabled = true;
    const d = readForm(form);
    await saveIssues([{
      id: uid(), source: "driver", vehicle_number: d.vehicle_number, vehicle_label: vehicleLabel(d.vehicle_number),
      title: d.category, category: d.category, description: d.description, severity: d.severity,
      odometer_km: d.odometer_km === "" ? null : Number(d.odometer_km), gps: await getGPS(),
      reported_by_id: currentUser.id, reported_by_name: currentUser.full_name, reported_at: new Date().toISOString(), status: "open",
    }]);
    toast("Problem reported – the administrators have been notified"); go("/");
  });
});
function issueView(i) {
  return `<div class="card"><div class="row between" style="margin-bottom:12px"><h2 style="margin:0">${esc(i.title)}</h2><span class="row" style="gap:6px">${badge(i.severity)}${badge(i.status)}</span></div>
    <dl class="kv"><dt>Vehicle</dt><dd>${esc(vehicleLabel(i.vehicle_number))}</dd><dt>Severity</dt><dd>${esc(SEVERITY_LABEL[i.severity] || i.severity)}</dd>
    ${i.description ? `<dt>Details</dt><dd>${esc(i.description)}</dd>` : ""}
    <dt>Source</dt><dd>${i.source === "checklist" ? "Weekly checklist" : "Driver report"}</dd><dt>Reported by</dt><dd>${esc(i.reported_by_name)}</dd><dt>Reported</dt><dd>${esc(fmtDateTime(new Date(i.reported_at)))}</dd>
    ${i.odometer_km != null ? `<dt>Odometer</dt><dd>${esc(i.odometer_km)} km</dd>` : ""}<dt>Location</dt><dd>${gpsText(i.gps)}</dd>
    ${i.status === "resolved" ? `<dt>Resolved</dt><dd>${esc(fmtDateTime(new Date(i.resolved_at)))} · ${esc(i.resolved_by)}</dd>${i.resolution_note ? `<dt>Repair / action</dt><dd>${esc(i.resolution_note)}</dd>` : ""}` : ""}</dl></div>`;
}
route("/issues/:id", ["driver"], async ({ id }) => {
  const i = await db.get("vehicle_issues", id);
  if (!i) return go("/");
  await shell("Vehicle problem", `<a class="btn btn-outline btn-sm" href="#/">← Back</a><div style="margin-top:12px">${issueView(i)}</div>`);
});
route("/admin/vehicles/issues/:id", ["admin"], async ({ id }) => {
  const i = await db.get("vehicle_issues", id);
  if (!i) return go("/admin/vehicles");
  await shell("Vehicle problem", `<a class="btn btn-outline btn-sm" href="#/admin/vehicles">← Back</a><div style="margin-top:12px">${issueView(i)}</div>
    ${i.status === "open" ? `<form id="res" class="card stack" novalidate><h2>Mark as resolved</h2>
      ${field("resolution_note", "Repair / action taken", { type: "textarea", required: true })}
      <button class="btn btn-primary btn-block" type="submit">${icon("check")} Mark as resolved</button></form>`
    : `<button class="btn btn-outline btn-block" id="reopen" type="button" style="margin-top:14px">Reopen problem</button>`}`);
  document.getElementById("res")?.addEventListener("submit", async (e) => {
    e.preventDefault(); const f = e.target;
    if (!validate(f)) return;
    await db.update("vehicle_issues", id, { status: "resolved", resolution_note: readForm(f).resolution_note, resolved_by: currentUser.full_name, resolved_at: new Date().toISOString() });
    toast("Problem marked as resolved"); go("/admin/vehicles");
  });
  document.getElementById("reopen")?.addEventListener("click", async () => {
    await db.update("vehicle_issues", id, { status: "open", resolved_at: null, resolved_by: null }); toast("Problem reopened"); router();
  });
});

/* ---------------- weekly inspection (driver) ---------------- */
route("/inspection", ["driver"], async () => {
  const last = await lastInspection(currentUser.id);
  const w = getInspectionWindow();
  if (!isInspectionDue(last?.submitted_at)) {
    return shell("Weekly checklist", `<div class="alert ok"><div><b>This week's checklist is complete</b><div class="small">Next checklist due ${esc(fmtDateTime(w.end))}</div></div><a class="btn btn-danger btn-sm" href="#/report-issue">${icon("alert")} Report vehicle problem</a></div>${inspectionView(last)}`);
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
        <div id="sev-box" hidden>${field("severity", "Problems found – how serious?", { required: true, options: SEVERITIES })}<p class="small muted" style="margin-top:6px">The administrators are notified automatically about every “Needs attention” item.</p></div>
        ${field("notes", "Additional notes", { type: "textarea" })}
        <label class="check"><input type="checkbox" name="declaration" /> <span>I confirm that I personally inspected this vehicle and the information above is correct.</span></label>
        <span class="err-text" data-err="declaration"></span>
        <button class="btn btn-primary btn-block" type="submit">${icon("check")} Submit checklist</button>
      </div>
    </form>`);
  const form = document.getElementById("insp");
  const sevBox = document.getElementById("sev-box");
  form.querySelectorAll(".ci").forEach((ci) => {
    ci.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => {
      ci.querySelectorAll(".seg button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      ci.dataset.value = b.dataset.v;
      ci.querySelector("[data-comment]").hidden = b.dataset.v !== "attention";
      ci.querySelector("[data-ci-err]").textContent = "";
      sevBox.hidden = !form.querySelector('.ci[data-value="attention"]');
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
    const d = readForm(form), now = new Date().toISOString(), gps = await getGPS();
    const inspection = {
      id: uid(), driver_id: currentUser.id, driver_name: currentUser.full_name, vehicle_number: d.vehicle_number, vehicle_model: vehicleModel(d.vehicle_number),
      week_key: weekKey(), odometer_km: Number(d.odometer_km), items, notes: d.notes, severity: d.severity || null,
      has_defects: Object.values(items).some((i) => i.status === "attention"), driver_declaration: true, gps, submitted_at: now,
    };
    await db.insert("vehicle_inspections", inspection);
    const issues = Object.entries(items).filter(([, v]) => v.status === "attention").map(([k, v]) => ({
      id: uid(), source: "checklist", inspection_id: inspection.id, item_key: k, vehicle_number: d.vehicle_number, vehicle_label: vehicleLabel(d.vehicle_number),
      title: checklistLabel(k), category: "Weekly checklist", description: v.comment, severity: d.severity || "major", odometer_km: inspection.odometer_km, gps,
      reported_by_id: currentUser.id, reported_by_name: currentUser.full_name, reported_at: now, status: "open",
    }));
    await saveIssues(issues);
    toast(issues.length ? "Checklist submitted – the administrators have been notified about the problems" : "Checklist submitted"); go("/");
  });
});
function inspectionView(i) {
  const lbl = { ok: "OK", attention: "Needs attention", na: "N/A" };
  const cls = { ok: "b-ok", attention: "b-defect", na: "b-na" };
  return `<div class="card" style="margin-top:14px"><h2>Checklist – ${esc(vehicleLabel(i.vehicle_number))}</h2>
    <dl class="kv"><dt>Driver</dt><dd>${esc(i.driver_name)}</dd><dt>Week of</dt><dd>${esc(fmtDate(i.week_key))}</dd><dt>Submitted</dt><dd>${esc(fmtDateTime(new Date(i.submitted_at)))}</dd><dt>Odometer</dt><dd>${esc(i.odometer_km)} km</dd><dt>Location</dt><dd>${gpsText(i.gps)}</dd>${i.severity ? `<dt>Severity</dt><dd>${esc(SEVERITY_LABEL[i.severity])}</dd>` : ""}${i.notes ? `<dt>Notes</dt><dd>${esc(i.notes)}</dd>` : ""}</dl></div>
    ${CHECKLIST.map((s) => `<div class="card"><h3 style="margin-bottom:8px">${esc(s.title)}</h3>${s.items.map(([k, l]) => { const it = i.items[k] || {}; return `<div class="ci"><div class="ci-top"><span>${esc(l)}</span><span class="badge ${cls[it.status] || "b-na"}">${lbl[it.status] || "-"}</span></div>${it.comment ? `<div class="small" style="color:var(--danger)">${esc(it.comment)}</div>` : ""}</div>`; }).join("")}</div>`).join("")}`;
}

/* ---------------- vehicles (admin): problems, fleet status, checklists ---------------- */
let issueTab = "open";
route("/admin/vehicles", ["admin"], async () => {
  const [list, users, issues, trips] = await Promise.all([db.list("vehicle_inspections"), db.list("users"), db.list("vehicle_issues"), db.list("trips")]);
  list.sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
  const drivers = users.filter((u) => u.role === "driver" && u.active !== false);
  const wk = weekKey();
  const thisWeek = list.filter((i) => i.week_key === wk);
  const shown = issues.filter((i) => issueTab === "all" || i.status === issueTab).sort(issueOrder);
  const lastOdo = (plate) => Math.max(0, ...trips.filter((t) => t.vehicle_number === plate).map((t) => Number(t.odometer_end) || 0), ...list.filter((i) => i.vehicle_number === plate).map((i) => Number(i.odometer_km) || 0));
  await shell("Vehicles", `
    <div class="row between no-print"><span></span><a class="btn btn-danger btn-sm" href="#/report-issue">${icon("alert")} Report vehicle problem</a></div>
    <div class="section-title"><h2>Vehicle problems</h2></div>
    <div class="tabs" role="tablist">${[["open", "Open"], ["resolved", "Resolved"], ["all", "All"]].map(([k, l]) => `<button role="tab" type="button" data-itab="${k}" aria-selected="${issueTab === k}">${l} (${k === "all" ? issues.length : issues.filter((i) => i.status === k).length})</button>`).join("")}</div>
    ${shown.length ? shown.map(issueItem).join("") : `<div class="card empty">No vehicle problems.</div>`}
    <div class="card" style="margin-top:14px"><h2>Fleet status</h2>
    <div class="table-wrap"><table><thead><tr><th>No.</th><th>Vehicle</th><th>Plate</th><th class="num">Odometer</th><th>Checklist this week</th><th>Open problems</th></tr></thead><tbody>
    ${FLEET.map((v) => {
      const i = thisWeek.filter((x) => x.vehicle_number === v.plate)[0];
      const op = issues.filter((x) => x.vehicle_number === v.plate && x.status === "open");
      const worst = op.sort(issueOrder)[0];
      return `<tr><td>${v.no}</td><td>${esc(v.model)}</td><td dir="ltr" style="text-align:inherit">${esc(v.plate)}</td><td class="num">${lastOdo(v.plate) ? lastOdo(v.plate) + " km" : "-"}</td><td>${i ? `<a href="#/admin/vehicles/inspections/${i.id}">${i.has_defects ? '<span class="badge b-defect">Defects</span>' : '<span class="badge b-ok">Checked</span>'}</a>` : '<span class="badge b-na">Not checked</span>'}</td><td>${op.length ? `${badge(worst.severity)} ${op.length}` : '<span class="badge b-ok">None</span>'}</td></tr>`;
    }).join("")}
    </tbody></table></div></div>
    <div class="card"><h2>Drivers – this week (from ${esc(fmtDateTime(getInspectionWindow().start))})</h2>
    <div class="table-wrap"><table><thead><tr><th>Driver</th><th>Status</th><th>Vehicle</th><th>Submitted</th></tr></thead><tbody>
    ${drivers.map((u) => { const i = thisWeek.find((x) => x.driver_id === u.id); return `<tr><td>${esc(u.full_name)}</td><td>${i ? (i.has_defects ? '<span class="badge b-defect">Defects</span>' : '<span class="badge b-ok">Completed</span>') : '<span class="badge b-overdue">Not submitted</span>'}</td><td>${i ? esc(vehicleLabel(i.vehicle_number)) : "-"}</td><td>${i ? `<a href="#/admin/vehicles/inspections/${i.id}">${esc(fmtDateTime(new Date(i.submitted_at)))}</a>` : "-"}</td></tr>`; }).join("") || '<tr><td colspan="4" class="muted">No drivers</td></tr>'}
    </tbody></table></div></div>
    <div class="section-title"><h2>Checklist history</h2></div>
    ${list.length ? list.slice(0, 50).map((i) => `<a class="list-item" href="#/admin/vehicles/inspections/${i.id}"><div class="row between"><b>${esc(vehicleLabel(i.vehicle_number))} · ${esc(i.driver_name)}</b>${i.has_defects ? '<span class="badge b-defect">Defects</span>' : '<span class="badge b-ok">OK</span>'}</div><div class="small muted">${esc(fmtDateTime(new Date(i.submitted_at)))} · ${esc(i.odometer_km)} km</div></a>`).join("") : '<div class="card empty">No checklists submitted yet.</div>'}`);
  app.querySelectorAll("[data-itab]").forEach((b) => b.addEventListener("click", () => { issueTab = b.dataset.itab; router(); }));
});
route("/admin/vehicles/inspections/:id", ["admin"], async ({ id }) => {
  const i = await db.get("vehicle_inspections", id);
  if (!i) return go("/admin/vehicles");
  await shell("Checklist details", `<div class="row no-print"><a class="btn btn-outline btn-sm" href="#/admin/vehicles">← Back</a><button class="btn btn-outline btn-sm" type="button" onclick="window.print()">${icon("printer")} Print / PDF</button></div>${inspectionView(i)}`);
});

/* ---------------- trip requests (employee) ---------------- */
route("/requests/new", ["requester", "admin"], async () => {
  const employees = (await employeeList()).filter((e) => e.id !== currentUser.id);
  const stops = [""], others = [], items = [newItem()];
  let type = "passengers";
  await shell("Request a trip", `<form id="rq" class="stack" novalidate>
    <div class="card"><h2>What needs to be transported?</h2>
      <div class="type-pick" role="group" aria-label="Request type">
        <button type="button" data-type="passengers" aria-pressed="true">${icon("users")}<span>Passengers</span><small>People travelling</small></button>
        <button type="button" data-type="items" aria-pressed="false">${icon("box")}<span>Documents & items</span><small>You sign on your own phone after delivery</small></button>
      </div></div>
    ${routeCard()}
    <div class="card"><h2>Date & time</h2><div class="grid two">
      ${timeFields()}
      ${field("department", "Your department", { required: true, value: currentUser.department || "" })}
    </div></div>
    <div class="card" id="pax-card"><h2>Passengers</h2>
      <label class="check highlight"><input type="checkbox" name="self_passenger" /><span>I, <b>${esc(currentUser.full_name)}</b>, am a passenger on this trip</span></label>
      <h3 style="margin:16px 0 8px">Other passengers</h3>
      <div id="pax"></div>
      <span class="err-text" data-err="passengers"></span>
      <p class="small" id="paxcount" style="margin-top:10px;font-weight:600"></p>
    </div>
    <div class="card" id="items-card" hidden><h2>Documents & items</h2>
      <div id="items"></div><span class="err-text" data-err="items"></span>
      <div class="grid two" style="margin-top:14px">
        ${field("recipient_name", "Receiver at destination", { required: true })}
        ${field("recipient_phone", "Receiver phone", { type: "tel" })}
      </div>
      <div class="alert info small" style="margin-top:12px"><div>After the driver delivers, you will be asked to confirm and sign on your own phone.</div></div>
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
  itemsEditor(document.getElementById("items"), items);
  form.self_passenger.addEventListener("change", count); count();
  form.querySelectorAll("[data-type]").forEach((b) => b.addEventListener("click", () => {
    type = b.dataset.type;
    form.querySelectorAll("[data-type]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    document.getElementById("pax-card").hidden = type !== "passengers";
    document.getElementById("items-card").hidden = type !== "items";
  }));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate(form, (d) => {
      const er = timeRules(d);
      if (!cleanStops(stops).length) er.stops = "Enter at least one destination";
      if (type === "passengers") { const pe = paxErrors(others, all()); if (pe) er.passengers = pe; }
      else { const ie = itemsErrors(items); if (ie) er.items = ie; }
      return er;
    })) return;
    const d = readForm(form); delete d.self_passenger;
    const s = cleanStops(stops);
    const base = { id: uid(), reference: newReference(), trip_type: type, is_guest: false, requester_id: currentUser.id, requester_name: currentUser.full_name, ...d, stops: s, destination: s.join(" → "), status: "pending", created_at: new Date().toISOString() };
    let r;
    if (type === "items") {
      r = { ...base, items: cleanItems(items), passengers: [], passenger_count: 0 };
    } else {
      const pax = all();
      r = { ...base, recipient_name: "", recipient_phone: "", self_passenger: form.self_passenger.checked, passengers: pax, passenger_count: pax.length };
    }
    form.querySelector("[type=submit]").disabled = true;
    await db.insert("trip_requests", r);
    if (d.department !== (currentUser.department || "")) await db.update("users", currentUser.id, { department: d.department });
    await notify("request_created", { request: r });
    toast("Request submitted – you and the administrators have been emailed");
    go(currentUser.role === "admin" ? "/admin/requests" : "/requests");
  });
});
route("/requests", ["requester"], async () => {
  const list = (await db.list("trip_requests")).filter((r) => r.requester_id === currentUser.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  await shell("My requests", list.length ? list.map((r) => requestItem(r, `#/requests/${r.id}`)).join("") : `<div class="card empty">You have not requested any trips yet.<div style="margin-top:12px"><a class="btn btn-primary" href="#/requests/new">Request a trip</a></div></div>`);
});
function requestDetails(r) {
  return `<div class="card"><div class="row between" style="margin-bottom:12px"><h2 style="margin:0">${isItems(r) ? "Delivery request" : "Trip request"}</h2><span class="row" style="gap:6px">${typeBadge(r)}${r.is_guest ? '<span class="badge b-hrid">Guest</span>' : ""}${badge(r.status)}</span></div>
    <dl class="kv">${r.reference ? `<dt>Reference</dt><dd>${esc(r.reference)}</dd>` : ""}<dt>Requested by</dt><dd>${esc(r.requester_name)} (${esc(r.is_guest ? "Guest" : r.department)})</dd>
    ${r.is_guest ? `<dt>Organisation</dt><dd>${esc(r.guest_organization)}</dd><dt>Phone</dt><dd><a href="tel:${esc(r.guest_phone)}">${esc(r.guest_phone)}</a></dd><dt>Email</dt><dd>${esc(r.guest_email || "-")}</dd><dt>HRID contact</dt><dd>${esc(r.guest_host)}</dd>` : ""}
    <dt>Route</dt><dd>${routeHTML(r)}</dd>
    <dt>Date</dt><dd>${esc(fmtDate(r.trip_date))}</dd><dt>Time</dt><dd>${esc(r.departure_time)}${r.return_time ? " – return " + esc(r.return_time) : ""}</dd>
    ${isItems(r)
      ? `<dt>Items</dt><dd>${itemsListHTML(r.items)}</dd><dt>Receiver</dt><dd>${esc(r.recipient_name)}${r.recipient_phone ? ` · <a href="tel:${esc(r.recipient_phone)}">${esc(r.recipient_phone)}</a>` : ""}</dd>`
      : `<dt>Passengers (${esc(r.passenger_count)})</dt><dd>${paxListHTML(paxOf(r))}</dd>`}
    <dt>Purpose</dt><dd>${esc(r.purpose)}</dd>${r.notes ? `<dt>Notes</dt><dd>${esc(r.notes)}</dd>` : ""}
    ${r.assigned_driver_name ? `<dt>Driver</dt><dd>${esc(r.assigned_driver_name)}</dd><dt>Vehicle</dt><dd>${esc(vehicleLabel(r.assigned_vehicle_number))}</dd>` : ""}
    ${r.reviewed_by ? `<dt>Reviewed by</dt><dd>${esc(r.reviewed_by)} · ${esc(fmtDateTime(new Date(r.reviewed_at)))}</dd>` : ""}${r.admin_comment ? `<dt>Comment</dt><dd>${esc(r.admin_comment)}</dd>` : ""}
    ${r.delivered_at ? `<dt>Delivered</dt><dd>${esc(fmtDateTime(new Date(r.delivered_at)))}${r.received_by ? ` · Handed to ${esc(r.received_by)}` : ""}</dd>` : ""}
    ${r.requester_signature ? `<dt>Requester signature</dt><dd><img class="sig-img" src="${r.requester_signature}" alt="Signature of ${esc(r.requester_name)}" /><div class="small muted">Signed ${esc(fmtDateTime(new Date(r.requester_signed_at)))}</div></dd>` : ""}
    <dt>Submitted</dt><dd>${esc(fmtDateTime(new Date(r.created_at)))}</dd></dl></div>`;
}
route("/requests/:id", ["requester"], async ({ id }) => {
  const r = await db.get("trip_requests", id);
  if (!r || r.requester_id !== currentUser.id) return go("/requests");
  await shell("Request details", `<a class="btn btn-outline btn-sm" href="#/requests">← Back</a>
    ${r.status === "delivered" ? `<div class="alert warn" style="margin-top:12px"><div><b>Your items were delivered</b><div class="small">Please check and sign to confirm the delivery.</div></div><button class="btn btn-blue" type="button" id="sign">${icon("pen")} Confirm & sign</button></div>` : ""}
    <div style="margin-top:12px">${requestDetails(r)}</div>
    ${r.status === "pending" ? `<button class="btn btn-danger btn-block" id="cancel" type="button" style="margin-top:14px">Cancel request</button>` : ""}`);
  document.getElementById("cancel")?.addEventListener("click", async () => {
    if (!confirm("Cancel this trip request?")) return;
    const upd = await db.update("trip_requests", id, { status: "cancelled", cancelled_at: new Date().toISOString() });
    await notify("request_cancelled", { request: upd }); toast("Request cancelled"); router();
  });
  document.getElementById("sign")?.addEventListener("click", () => {
    signatureModal("Confirm delivery", `${currentUser.full_name} – sign to confirm the documents/items were delivered.`, async (img) => {
      const now = new Date().toISOString();
      const upd = await db.update("trip_requests", id, { status: "completed", requester_signature: img, requester_signed_at: now });
      if (r.trip_id) await db.update("trips", r.trip_id, { requester_signature: img, requester_signed_at: now });
      await notify("delivery_signed", { request: upd });
      toast("Thank you – delivery confirmed"); router();
    });
  });
});

/* ---------------- admin: approve & assign ---------------- */
let adminTab = "pending";
route("/admin/requests", ["admin"], async () => {
  const all = (await db.list("trip_requests")).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const tabs = [["pending", "Pending"], ["approved", "Approved"], ["delivered", "Awaiting signature"], ["completed", "Completed"], ["rejected", "Rejected"], ["cancelled", "Cancelled"], ["all", "All"]];
  const list = adminTab === "all" ? all : all.filter((r) => r.status === adminTab);
  await shell("Trip requests", `
    <div class="row between no-print" style="margin-bottom:10px"><span></span><a class="btn btn-outline btn-sm" href="#/requests/new">${icon("plus")} New request</a></div>
    <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${adminTab === k}">${l} (${k === "all" ? all.length : all.filter((r) => r.status === k).length})</button>`).join("")}</div>
    ${list.length ? list.map((r) => requestItem(r, `#/admin/requests/${r.id}`, `<div class="small muted">By ${esc(r.requester_name)} · ${esc(r.department)}${r.assigned_driver_name ? ` · Driver: ${esc(r.assigned_driver_name)}` : ""}</div>`)).join("") : `<div class="card empty">No requests here.</div>`}`);
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
  const [users, issues] = await Promise.all([db.list("users"), db.list("vehicle_issues")]);
  const drivers = users.filter((u) => u.role === "driver" && u.active !== false).sort((a, b) => a.full_name.localeCompare(b.full_name));
  const canReview = r.status === "pending" || r.status === "approved";
  await shell("Review request", `<a class="btn btn-outline btn-sm" href="#/admin/requests">← Back</a><div style="margin-top:12px">${requestDetails(r)}</div>
    ${r.trip_id ? `<a class="btn btn-outline btn-block" href="#/trips/${r.trip_id}" style="margin-top:14px">View trip report</a>` : ""}
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
    const did = form.driver_id.value, box = document.getElementById("conflict");
    const d = drivers.find((x) => x.id === did);
    if (fromDriver && d?.default_vehicle && !form.vehicle.value) form.vehicle.value = d.default_vehicle;
    const same = (await db.list("trip_requests")).filter((x) => x.id !== r.id && x.status === "approved" && x.trip_date === r.trip_date && overlaps(x, r));
    const dc = did ? same.filter((x) => x.assigned_driver_id === did) : [];
    const vc = form.vehicle.value ? same.filter((x) => x.assigned_vehicle_number === form.vehicle.value) : [];
    const vi = form.vehicle.value ? issues.filter((x) => x.vehicle_number === form.vehicle.value && x.status === "open").sort(issueOrder) : [];
    const line = (c) => `${esc(c.departure_time)} ${esc(c.origin)} → ${esc(c.destination)}`;
    box.innerHTML = [
      dc.length ? `<div class="alert warn small"><div>${esc(d.full_name)} already has ${dc.length} approved trip(s) at an overlapping time on this date: ${dc.map(line).join("; ")}</div></div>` : "",
      vc.length ? `<div class="alert warn small"><div>${esc(vehicleLabel(form.vehicle.value))} is already booked at an overlapping time: ${vc.map(line).join("; ")}</div></div>` : "",
      vi.length ? `<div class="alert ${vi[0].severity === "unsafe" ? "err" : "warn"} small"><div>${esc(vehicleLabel(form.vehicle.value))} has ${vi.length} open problem(s): ${vi.map((x) => esc(x.title)).join("; ")}</div></div>` : "",
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
    await notify("request_approved", { request: upd, previous_driver_id: prev });
    toast(`Approved – ${drv.full_name} and the requester have been emailed`); go("/admin/requests");
  });
  document.getElementById("reject").addEventListener("click", async () => {
    const c = form.comment.value.trim();
    if (!c) { form.comment.classList.add("invalid"); form.querySelector('[data-err="comment"]').textContent = "Please give a reason for rejecting"; form.comment.focus(); return; }
    if (!confirm("Reject this request?")) return;
    const prev = r.assigned_driver_id || null;
    const upd = await db.update("trip_requests", id, { status: "rejected", admin_comment: c, assigned_driver_id: null, assigned_driver_name: null, assigned_vehicle_number: null, assigned_vehicle_label: null, reviewed_by: currentUser.full_name, reviewed_at: new Date().toISOString() });
    await notify("request_rejected", { request: upd, previous_driver_id: prev });
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
    const f = list.filter((t) => !n || norm([t.driver_name, t.vehicle_number, t.vehicle_type, t.origin, t.destination, t.purpose, t.reference, ...(t.passengers || []).map((p) => p.name), ...(t.items || []).map((i) => i.description)].join(" ")).includes(n));
    document.getElementById("tlist").innerHTML = f.length ? f.map((t) => `<a class="list-item" href="#/trips/${t.id}"><div class="row between"><b>${esc(t.origin)} → ${stopsShort(t)}</b><span class="row" style="gap:6px">${typeBadge(t)}${badge(t.status)}</span></div><div class="small muted">${esc(fmtDate(t.trip_date))} · ${esc(t.departure_time)} · ${esc(vehicleLabel(t.vehicle_number))} · ${isItems(t) ? `${(t.items || []).length} item(s)` : `${t.passengers?.length || 0} passenger(s)`}${currentUser.role === "admin" ? " · " + esc(t.driver_name) : ""}</div></a>`).join("") : `<div class="card empty">No trips found.</div>`;
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
  const req = !existing && query().get("request") ? await db.get("trip_requests", query().get("request")) : null;
  if (req && (req.status !== "approved" || (currentUser.role === "driver" && req.assigned_driver_id !== currentUser.id))) { toast("This trip is not assigned to you"); return go("/"); }
  const employees = await employeeList();
  const t = existing || {
    id: uid(), driver_id: currentUser.id, driver_name: currentUser.full_name, employee_no: currentUser.employee_no || "",
    trip_type: req?.trip_type || "passengers", reference: req?.reference || "",
    vehicle_number: req?.assigned_vehicle_number || currentUser.default_vehicle || "",
    trip_date: req?.trip_date || todayISO(), departure_time: req?.departure_time || "", return_time: req?.return_time || "",
    origin: req?.origin || "", stops: req ? (req.stops?.length ? [...req.stops] : [req.destination]) : [""],
    purpose: req?.purpose || "", notes: "", request_id: req?.id || null, requester_name: req?.requester_name || "", status: "draft",
    items: req?.items ? req.items.map((i) => ({ ...i })) : [], recipient_name: req?.recipient_name || "", recipient_phone: req?.recipient_phone || "",
    passengers: req && !isItems(req) ? paxOf(req).map((p) => ({ ...newPax(p.type), ...paxRecord(p), id: uid(), signature: null, signed_at: null })) : [],
    checkpoints: [],
  };
  if (!t.stops?.length) t.stops = t.destination ? [t.destination] : [""];
  t.checkpoints = t.checkpoints || [];
  t.passengers = (t.passengers || []).map((p) => ({ ...newPax(), ...p, type: p.type || (p.user_id ? "hrid" : "external") }));
  const items = isItems(t);
  if (!items && !t.passengers.length) t.passengers.push(newPax());

  await shell(existing ? "Edit trip" : items ? "Delivery" : "New trip", `
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
      </div>
      <div class="card"><h2>Arrival times</h2>
        <p class="small muted" style="margin-bottom:10px">Tap each button when you leave the pick-up location and when you arrive at each destination. Time and location are recorded.</p>
        <div id="cps"></div><span class="err-text" data-err="checkpoints"></span></div>
      ${items ? `<div class="card"><h2>Documents & items</h2>
          <dl class="kv"><dt>Items</dt><dd>${itemsListHTML(t.items)}</dd><dt>Receiver</dt><dd>${esc(t.recipient_name || "-")}${t.recipient_phone ? ` · <a href="tel:${esc(t.recipient_phone)}">${esc(t.recipient_phone)}</a>` : ""}</dd><dt>Requested by</dt><dd>${esc(t.requester_name)}</dd></dl>
          <div style="margin-top:12px">${field("received_by", "Handed over to (name)", { required: true, value: t.received_by || t.recipient_name || "" })}</div>
          <div class="alert info small" style="margin-top:12px"><div>No passenger signatures are needed. ${esc(t.requester_name)} will confirm and sign on their own phone after you submit.</div></div>
        </div>`
      : `<div class="card"><h2>Passengers & signatures</h2>
        <div id="pax"></div><span class="err-text" data-err="passengers"></span></div>`}
      <div class="card stack">
        <label class="check"><input type="checkbox" name="declaration" ${t.driver_declaration ? "checked" : ""} /><span>${items ? "I declare that the trip details above are correct and the items were handed over." : "I declare that the trip details above are correct and every passenger signed personally."}</span></label>
        <span class="err-text" data-err="declaration"></span>
        <div class="grid two"><button type="button" class="btn btn-outline" id="draft">Save draft</button><button type="submit" class="btn btn-primary">${icon("check")} Submit trip</button></div>
        <a class="btn btn-danger btn-sm" href="#/report-issue">${icon("alert")} Report vehicle problem</a>
      </div>
    </form>`);

  const form = document.getElementById("trip");
  const cpBox = document.getElementById("cps");
  const drawCps = () => {
    const names = [form.origin.value.trim() || "Pick-up location", ...t.stops.map((s, i) => s.trim() || `Destination ${i + 1}`)];
    cpBox.innerHTML = names.map((n, i) => {
      const c = t.checkpoints[i];
      return `<div class="cp ${c?.at ? "done" : ""}"><div><div class="cp-name">${i === 0 ? "Departure from" : "Arrival at"}: ${esc(n)}</div>
        <div class="cp-meta">${c?.at ? `${i === 0 ? "Departed" : "Arrived"} ${esc(fmtDateTime(new Date(c.at)))} · ${c.gps ? gpsText(c.gps) : "Location not captured"}` : "Not recorded yet"}</div></div>
        <button type="button" class="btn ${c?.at ? "btn-outline" : "btn-blue"} btn-sm" data-cp="${i}">${icon("pin")} ${c?.at ? "Record again" : i === 0 ? "Record departure" : "Record arrival"}</button></div>`;
    }).join("");
    cpBox.querySelectorAll("[data-cp]").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true; b.textContent = "Locating…";
      const at = new Date().toISOString(), gps = await getGPS();
      t.checkpoints[+b.dataset.cp] = { at, gps };
      form.querySelector('[data-err="checkpoints"]').textContent = "";
      drawCps(); toast(gps ? "Time and location recorded" : "Time recorded – location unavailable (allow location access)");
    }));
  };
  stopsEditor(document.getElementById("stops"), t.stops, { onRemove: (i) => t.checkpoints.splice(i + 1, 1), onChange: drawCps });
  form.origin.addEventListener("input", drawCps);
  drawCps();
  if (!items) passengerEditor(document.getElementById("pax"), t.passengers, { employees, signatures: true });

  const save = async (status) => {
    const d = readForm(form);
    const s = cleanStops(t.stops);
    const pax = items ? [] : t.passengers.filter((p) => p.user_id || String(p.name || "").trim() || p.signature).map((p) => ({ ...paxRecord(p), signature: p.signature, signed_at: p.signed_at }));
    const cps = t.checkpoints.slice(0, s.length + 1);
    const rec = {
      ...t, ...d, stops: s, destination: s.join(" → "), passengers: pax, checkpoints: cps,
      gps_start: cps[0]?.gps || null, gps_end: cps[s.length]?.gps || null,
      vehicle_type: vehicleModel(d.vehicle_number),
      odometer_start: d.odometer_start === "" ? null : Number(d.odometer_start), odometer_end: d.odometer_end === "" ? null : Number(d.odometer_end),
      driver_declaration: form.declaration.checked, status, updated_at: new Date().toISOString(),
    };
    delete rec.declaration;
    rec.distance_km = rec.odometer_start != null && rec.odometer_end != null ? rec.odometer_end - rec.odometer_start : null;
    if (status === "submitted") rec.submitted_at = new Date().toISOString();
    if (await db.get("trips", t.id)) await db.update("trips", t.id, rec); else await db.insert("trips", { ...rec, created_at: new Date().toISOString() });
    if (status === "submitted" && rec.request_id) {
      if (items) {
        const upd = await db.update("trip_requests", rec.request_id, { status: "delivered", trip_id: t.id, delivered_at: cps[s.length]?.at || rec.submitted_at, received_by: rec.received_by });
        await notify("delivery_done", { request: upd });
      } else await db.update("trip_requests", rec.request_id, { status: "completed", trip_id: t.id });
    }
    return rec;
  };
  document.getElementById("draft").addEventListener("click", async () => { await save("draft"); toast("Draft saved"); go("/trips"); });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ok = validate(form, (d) => {
      const er = {};
      if (!form.declaration.checked) er.declaration = "Please confirm the driver declaration";
      const s = cleanStops(t.stops);
      if (!s.length) er.stops = "Enter at least one destination";
      else if (cleanStops(t.stops).length !== t.stops.length) er.stops = "Fill in or remove the empty destination";
      else if ([...Array(s.length + 1).keys()].some((i) => !t.checkpoints[i]?.at)) er.checkpoints = "Record the departure and the arrival at every destination";
      if (d.odometer_end === "") er.odometer_end = "This field is required";
      else if (Number(d.odometer_end) < Number(d.odometer_start)) er.odometer_end = "Must be greater than the start reading";
      if (d.return_time && d.return_time <= d.departure_time) er.return_time = "Must be after departure";
      if (!items) {
        const pe = paxErrors(t.passengers);
        if (pe) er.passengers = pe;
        else if (t.passengers.some((p) => !p.signature)) er.passengers = "Every passenger must sign before the trip can be submitted";
      }
      return er;
    });
    if (!ok) return toast("Please fix the highlighted fields");
    form.querySelector("[type=submit]").disabled = true;
    await save("submitted");
    toast(items ? `Delivery submitted – ${t.requester_name} has been asked to sign` : "Trip submitted"); go(`/trips/${t.id}`);
  });
}

function checkpointRows(t) {
  const names = [t.origin, ...(t.stops?.length ? t.stops : [t.destination])];
  const cps = t.checkpoints || [];
  return names.map((n, i) => `<tr><td>${i === 0 ? "Departure" : `Arrival ${names.length > 2 ? i : ""}`}</td><td>${esc(n)}</td><td>${cps[i]?.at ? esc(fmtDateTime(new Date(cps[i].at))) : "-"}</td><td>${cps[i] ? gpsText(cps[i].gps) : "-"}</td></tr>`).join("");
}
route("/trips/:id", ["driver", "admin"], async ({ id }) => {
  const t = await db.get("trips", id);
  if (!t || (currentUser.role === "driver" && t.driver_id !== currentUser.id)) return go("/trips");
  const items = isItems(t);
  await shell("Trip summary", `
    <div class="row no-print" style="margin-bottom:12px"><a class="btn btn-outline btn-sm" href="#/trips">← Back</a>
      ${t.status === "draft" ? `<a class="btn btn-blue btn-sm" href="#/trips/${t.id}/edit">Edit trip</a>` : ""}
      <button class="btn btn-outline btn-sm" type="button" onclick="window.print()">${icon("printer")} Export PDF</button></div>
    <div class="print-only" style="margin-bottom:12px"><div class="row"><img src="assets/logo.png" style="height:44px" alt="" /><div><b>Hiwa Rauf for Investment & Development</b><div class="small">Employee Transportation Trip Report</div></div></div></div>
    <div class="card"><div class="row between" style="margin-bottom:12px"><h2 style="margin:0">Trip report</h2><span class="row" style="gap:6px">${typeBadge(t)}${badge(t.status)}</span></div>
      <div class="grid two">
        <dl class="kv">${t.reference ? `<dt>Reference</dt><dd>${esc(t.reference)}</dd>` : ""}<dt>Driver</dt><dd>${esc(t.driver_name)}${t.employee_no ? " (#" + esc(t.employee_no) + ")" : ""}</dd><dt>Vehicle</dt><dd>${esc(vehicleLabel(t.vehicle_number))}</dd><dt>Odometer</dt><dd>${esc(t.odometer_start ?? "-")} → ${esc(t.odometer_end ?? "-")} km</dd><dt>Distance</dt><dd>${t.distance_km != null ? esc(t.distance_km) + " km" : "-"}</dd><dt>Date</dt><dd>${esc(fmtDate(t.trip_date))}</dd><dt>Departure</dt><dd>${esc(t.departure_time)}</dd><dt>Return</dt><dd>${esc(t.return_time || "-")}</dd></dl>
        <dl class="kv"><dt>Route</dt><dd>${routeHTML(t)}</dd></dl>
      </div>
      <dl class="kv" style="margin-top:10px"><dt>Purpose</dt><dd>${esc(t.purpose)}</dd>${t.notes ? `<dt>Notes</dt><dd>${esc(t.notes)}</dd>` : ""}${t.submitted_at ? `<dt>Submitted</dt><dd>${esc(fmtDateTime(new Date(t.submitted_at)))}</dd>` : ""}<dt>Declaration</dt><dd>${t.driver_declaration ? "Confirmed by driver" : "Not confirmed"}</dd></dl></div>
    <div class="card"><h2>Arrival times</h2><div class="table-wrap"><table><thead><tr><th></th><th>Location</th><th>Time</th><th>GPS</th></tr></thead><tbody>${checkpointRows(t)}</tbody></table></div></div>
    ${items ? `<div class="card"><h2>Documents & items</h2><dl class="kv"><dt>Items</dt><dd>${itemsListHTML(t.items)}</dd><dt>Handed over to</dt><dd>${esc(t.received_by || "-")}</dd><dt>Requested by</dt><dd>${esc(t.requester_name)}</dd>
        <dt>Requester signature</dt><dd>${t.requester_signature ? `<img class="sig-img" src="${t.requester_signature}" alt="signature" /><div class="small muted">Signed ${esc(fmtDateTime(new Date(t.requester_signed_at)))}</div>` : '<span class="badge b-pending">Waiting for requester to sign</span>'}</dd></dl></div>`
    : `<div class="card"><h2>Passengers (${t.passengers.length})</h2><div class="table-wrap"><table><thead><tr><th>#</th><th>Passenger</th><th>Signature</th></tr></thead><tbody>
      ${t.passengers.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.name)}<div style="margin-top:4px">${paxBadge({ ...p, type: p.type || (p.user_id ? "hrid" : "external") })}</div></td><td>${p.signature ? `<img class="sig-img" src="${p.signature}" alt="signature" /><div class="small muted">${esc(fmtDateTime(new Date(p.signed_at)))}</div>` : '<span class="badge b-pending">Missing</span>'}</td></tr>`).join("")}
    </tbody></table></div></div>`}`);
});

/* ---------------- monthly reports (admin) ---------------- */
function sundaysDue(month) {
  const [y, m] = month.split("-").map(Number);
  const keys = [];
  for (let d = 1; d <= 31; d++) {
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCMonth() !== m - 1) break;
    const iso = dt.toISOString().slice(0, 10);
    if (dt.getUTCDay() === 0 && new Date(`${iso}T05:00:00Z`) <= new Date()) keys.push(iso);
  }
  return keys;
}
route("/admin/reports", ["admin"], async () => {
  const month = /^\d{4}-\d{2}$/.test(query().get("m") || "") ? query().get("m") : todayISO().slice(0, 7);
  const [allTrips, allReqs, allInsp, allIssues, users] = await Promise.all([db.list("trips"), db.list("trip_requests"), db.list("vehicle_inspections"), db.list("vehicle_issues"), db.list("users")]);
  const inMonth = (iso) => String(iso || "").startsWith(month);
  const trips = allTrips.filter((t) => t.status === "submitted" && inMonth(t.trip_date)).sort((a, b) => (a.trip_date + a.departure_time).localeCompare(b.trip_date + b.departure_time));
  const reqs = allReqs.filter((r) => inMonth(r.trip_date));
  const weeks = sundaysDue(month);
  const insp = allInsp.filter((i) => weeks.includes(i.week_key) || inMonth(i.week_key));
  const issues = allIssues.filter((i) => inMonth(localISODate(i.reported_at))).sort(issueOrder);
  const openNow = allIssues.filter((i) => i.status === "open");
  const drivers = users.filter((u) => u.role === "driver" && u.active !== false);
  const km = (list) => list.reduce((s, t) => s + (Number(t.distance_km) || 0), 0);
  const paxTrips = trips.filter((t) => !isItems(t)), itemTrips = trips.filter(isItems);
  const paxCount = paxTrips.reduce((s, t) => s + (t.passengers?.length || 0), 0);
  const expected = weeks.length * drivers.length;
  const doneChecks = insp.filter((i) => weeks.includes(i.week_key)).length;

  // chart data
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const perDay = [...Array(days).keys()].map((i) => { const d = `${month}-${String(i + 1).padStart(2, "0")}`; return { label: String(i + 1), value: trips.filter((t) => t.trip_date === d).length }; });
  const perVehicleKm = FLEET.map((v) => ({ label: `\u2066${v.plate}\u2069 · ${v.model}`, value: km(trips.filter((t) => t.vehicle_number === v.plate)) }));
  const driverNames = [...new Set([...drivers.map((d) => d.full_name), ...trips.map((t) => t.driver_name)])];
  const perDriver = driverNames.map((n) => ({ label: n, value: trips.filter((t) => t.driver_name === n).length })).sort((a, b) => b.value - a.value);
  const statusList = ["completed", "delivered", "approved", "pending", "rejected", "cancelled"];
  const statusColors = { completed: PALETTE[1], delivered: PALETTE[2], approved: PALETTE[0], pending: "#ECC94B", rejected: PALETTE[3], cancelled: PALETTE[8] };
  const byStatus = statusList.map((s) => ({ label: statusLabel(s), value: reqs.filter((r) => r.status === s).length, color: statusColors[s] }));
  const byType = [{ label: "Passengers", value: paxTrips.length, color: PALETTE[0] }, { label: "Documents & items", value: itemTrips.length, color: PALETTE[2] }];
  const issuesPerVehicle = FLEET.map((v) => ({ label: `\u2066${v.plate}\u2069 · ${v.model}`, value: issues.filter((i) => i.vehicle_number === v.plate).length, color: PALETTE[3] }));

  const vehicleRows = FLEET.map((v) => {
    const vt = trips.filter((t) => t.vehicle_number === v.plate);
    const vi = issues.filter((i) => i.vehicle_number === v.plate);
    const vo = openNow.filter((i) => i.vehicle_number === v.plate);
    const odo = Math.max(0, ...allTrips.filter((t) => t.vehicle_number === v.plate && t.trip_date <= `${month}-31`).map((t) => Number(t.odometer_end) || 0), ...allInsp.filter((i) => i.vehicle_number === v.plate && i.week_key <= `${month}-31`).map((i) => Number(i.odometer_km) || 0));
    const status = vo.some((i) => i.severity === "unsafe") ? "unsafe" : vo.length ? "open" : "ok";
    return { v, trips: vt.length, km: km(vt), pax: vt.reduce((s, t) => s + (isItems(t) ? 0 : t.passengers?.length || 0), 0), deliveries: vt.filter(isItems).length, checks: insp.filter((i) => i.vehicle_number === v.plate).length, issues: vi.length, open: vo.length, odo, status };
  });
  const STATUS_TXT = { unsafe: "Unsafe – do not drive", open: "Open problems", ok: "OK" };

  await shell("Monthly reports", `
    <div class="card no-print"><div class="report-head">
      <div class="field"><label for="month">Month</label><input class="input" type="month" id="month" value="${month}" max="${todayISO().slice(0, 7)}" /></div>
      <button class="btn btn-outline" type="button" onclick="window.print()">${icon("printer")} Print / Save as PDF</button>
    </div></div>
    <div class="print-only" style="margin-bottom:12px"><div class="row"><img src="assets/logo.png" style="height:44px" alt="" /><div><b>Hiwa Rauf for Investment & Development</b><div class="small">Fleet monthly report</div></div></div></div>
    <h2 style="margin:18px 0 10px;font-size:20px">${esc(fmtMonth(month))}</h2>
    <div class="grid stats">
      <div class="card stat"><div class="v">${trips.length}</div><div class="l">Trips completed</div></div>
      <div class="card stat"><div class="v">${paxCount}</div><div class="l">Passengers carried</div></div>
      <div class="card stat"><div class="v">${itemTrips.length}</div><div class="l">Deliveries (documents & items)</div></div>
      <div class="card stat"><div class="v">${km(trips)} km</div><div class="l">Distance driven</div></div>
      <div class="card stat"><div class="v">${reqs.length}</div><div class="l">Requests</div></div>
      <div class="card stat"><div class="v">${reqs.filter((r) => r.status === "rejected").length}</div><div class="l">Rejected requests</div></div>
      <div class="card stat"><div class="v">${expected ? Math.round((doneChecks / expected) * 100) : 0}%</div><div class="l">Weekly checklists done (${doneChecks}/${expected})</div></div>
      <div class="card stat"><div class="v" style="color:${issues.length ? "var(--danger)" : "var(--primary)"}">${issues.length}</div><div class="l">Vehicle problems reported</div></div>
    </div>

    <div class="card" style="margin-top:14px"><h2>Trips per day</h2>${columnChart(perDay, { title: "Trips per day" })}</div>
    <div class="grid two" style="margin-top:14px">
      <div class="card"><h2>Requests by status</h2>${donutChart(byStatus, { title: "Requests by status" })}</div>
      <div class="card"><h2>Trip type</h2>${donutChart(byType, { title: "Trip type" })}</div>
    </div>
    <div class="card" style="margin-top:14px"><h2>Distance per vehicle (km)</h2>${barChart(perVehicleKm, { title: "Distance per vehicle", unit: " km" })}</div>
    <div class="card"><h2>Trips per driver</h2>${barChart(perDriver, { title: "Trips per driver", color: PALETTE[1] })}</div>
    <div class="card"><h2>Vehicle problems per vehicle</h2>${barChart(issuesPerVehicle, { title: "Vehicle problems per vehicle", emptyText: "No vehicle problems reported this month." })}</div>

    <div class="card"><h2>Vehicle information</h2><div class="table-wrap"><table class="report-table"><thead><tr><th>No.</th><th>Vehicle</th><th>Plate</th><th class="num">Trips</th><th class="num">Distance</th><th class="num">Passengers</th><th class="num">Deliveries</th><th class="num">Checklists</th><th class="num">Problems</th><th class="num">Odometer</th><th>Current status</th></tr></thead><tbody>
      ${vehicleRows.map((r) => `<tr><td>${r.v.no}</td><td>${esc(r.v.model)}</td><td dir="ltr" style="text-align:inherit">${esc(r.v.plate)}</td><td class="num">${r.trips}</td><td class="num">${r.km} km</td><td class="num">${r.pax}</td><td class="num">${r.deliveries}</td><td class="num">${r.checks}/${weeks.length}</td><td class="num">${r.issues}</td><td class="num">${r.odo ? r.odo + " km" : "-"}</td><td><span class="badge ${r.status === "ok" ? "b-ok" : r.status === "unsafe" ? "b-unsafe" : "b-open"}">${STATUS_TXT[r.status]}</span></td></tr>`).join("")}
    </tbody></table></div></div>

    <div class="card"><h2>Vehicle problems & defects</h2>${issues.length ? `<div class="table-wrap"><table class="report-table"><thead><tr><th>Date</th><th>Vehicle</th><th>Problem</th><th>Severity</th><th>Source</th><th>Reported by</th><th>Status</th></tr></thead><tbody>
      ${issues.map((i) => `<tr><td>${esc(fmtDate(localISODate(i.reported_at)))}</td><td>${esc(vehicleLabel(i.vehicle_number))}</td><td><a href="#/admin/vehicles/issues/${i.id}">${esc(i.title)}</a>${i.description ? `<div class="small muted">${esc(i.description)}</div>` : ""}</td><td>${badge(i.severity)}</td><td>${i.source === "checklist" ? "Weekly checklist" : "Driver report"}</td><td>${esc(i.reported_by_name)}</td><td>${badge(i.status)}${i.resolved_at ? `<div class="small muted">${esc(fmtDate(localISODate(i.resolved_at)))}</div>` : ""}</td></tr>`).join("")}
    </tbody></table></div>` : `<p class="muted">No vehicle problems reported this month.</p>`}</div>

    <div class="card"><h2>Trips</h2>${trips.length ? `<div class="table-wrap"><table class="report-table"><thead><tr><th>Date</th><th>Reference</th><th>Driver</th><th>Vehicle</th><th>Type</th><th>Route & arrival times</th><th class="num">People / items</th><th class="num">Distance</th></tr></thead><tbody>
      ${trips.map((t) => `<tr><td>${esc(fmtDate(t.trip_date))}<div class="small muted">${esc(t.departure_time)}</div></td><td><a href="#/trips/${t.id}">${esc(t.reference || "-")}</a></td><td>${esc(t.driver_name)}</td><td>${esc(vehicleLabel(t.vehicle_number))}</td><td>${isItems(t) ? "Documents & items" : "Passengers"}</td><td>${routeHTML(t)}</td><td class="num">${isItems(t) ? (t.items || []).reduce((s, i) => s + Number(i.quantity || 0), 0) : t.passengers?.length || 0}</td><td class="num">${t.distance_km ?? "-"} km</td></tr>`).join("")}
    </tbody></table></div>` : `<p class="muted">No completed trips this month.</p>`}</div>

    <div class="card no-print"><h2>Raw data export (CSV for Excel)</h2>
      <div class="export-grid">
        <button class="btn btn-outline" type="button" data-x="trips">${icon("download")} Trips</button>
        <button class="btn btn-outline" type="button" data-x="stops">${icon("download")} Stops & arrival times</button>
        <button class="btn btn-outline" type="button" data-x="passengers">${icon("download")} Passengers</button>
        <button class="btn btn-outline" type="button" data-x="items">${icon("download")} Documents & items</button>
        <button class="btn btn-outline" type="button" data-x="requests">${icon("download")} Requests</button>
        <button class="btn btn-outline" type="button" data-x="vehicles">${icon("download")} Vehicle information</button>
        <button class="btn btn-outline" type="button" data-x="issues">${icon("download")} Vehicle problems</button>
        <button class="btn btn-outline" type="button" data-x="checklists">${icon("download")} Weekly checklists</button>
      </div></div>`);

  document.getElementById("month").addEventListener("change", (e) => { if (/^\d{4}-\d{2}$/.test(e.target.value)) go(`/admin/reports?m=${e.target.value}`); });
  const at = (iso) => (iso ? `${localISODate(iso)} ${fmtTime(iso)}` : "");
  const gps = (g) => (g ? `${g.lat},${g.lng}` : "");
  const exporters = {
    trips: () => [["Date", "Departure", "Return", "Reference", "Type", "Driver", "Driver No.", "Vehicle", "Plate", "Pick-up", "Destinations", "Departed at", "Arrived (final) at", "Odometer start", "Odometer end", "Distance km", "Passengers", "Items", "Handed over to", "Requester signed at", "Purpose", "Notes"],
      trips.map((t) => { const cps = t.checkpoints || []; const last = cps[(t.stops || [t.destination]).length]; return [t.trip_date, t.departure_time, t.return_time, t.reference, isItems(t) ? "Documents & items" : "Passengers", t.driver_name, t.employee_no, vehicleModel(t.vehicle_number), t.vehicle_number, t.origin, (t.stops || [t.destination]).join(" | "), at(cps[0]?.at), at(last?.at), t.odometer_start, t.odometer_end, t.distance_km, isItems(t) ? 0 : t.passengers?.length || 0, isItems(t) ? (t.items || []).map((i) => `${i.description} x${i.quantity}`).join(" | ") : "", t.received_by || "", at(t.requester_signed_at), t.purpose, t.notes]; })],
    stops: () => [["Date", "Reference", "Driver", "Plate", "Stop no.", "Type", "Location", "Recorded at", "GPS"],
      trips.flatMap((t) => [t.origin, ...(t.stops || [t.destination])].map((n, i) => [t.trip_date, t.reference, t.driver_name, t.vehicle_number, i, i === 0 ? "Departure" : "Arrival", n, at(t.checkpoints?.[i]?.at), gps(t.checkpoints?.[i]?.gps)]))],
    passengers: () => [["Date", "Reference", "Driver", "Plate", "Passenger", "Type", "Employee No.", "Organisation", "Signed at"],
      paxTrips.flatMap((t) => (t.passengers || []).map((p) => [t.trip_date, t.reference, t.driver_name, t.vehicle_number, p.name, p.type === "hrid" ? "HRID" : "Non-HRID", p.employee_no, p.organization, at(p.signed_at)]))],
    items: () => [["Date", "Reference", "Requested by", "Driver", "Plate", "Item", "Quantity", "Receiver", "Handed over to", "Requester signed at"],
      itemTrips.flatMap((t) => (t.items || []).map((i) => [t.trip_date, t.reference, t.requester_name, t.driver_name, t.vehicle_number, i.description, i.quantity, t.recipient_name, t.received_by, at(t.requester_signed_at)]))],
    requests: () => [["Reference", "Trip date", "Departure", "Type", "Status", "Requested by", "Department", "Guest", "Pick-up", "Destinations", "Passengers", "Items", "Driver", "Plate", "Reviewed by", "Reviewed at", "Admin comment", "Created at"],
      reqs.map((r) => [r.reference, r.trip_date, r.departure_time, isItems(r) ? "Documents & items" : "Passengers", statusLabel(r.status), r.requester_name, r.department, r.is_guest ? "Yes" : "No", r.origin, (r.stops || [r.destination]).join(" | "), r.passenger_count || 0, (r.items || []).map((i) => `${i.description} x${i.quantity}`).join(" | "), r.assigned_driver_name, r.assigned_vehicle_number, r.reviewed_by, at(r.reviewed_at), r.admin_comment, at(r.created_at)])],
    vehicles: () => [["No.", "Vehicle", "Plate", "Trips", "Distance km", "Passengers", "Deliveries", "Checklists", "Weeks due", "Problems reported", "Open problems now", "Last odometer km", "Status"],
      vehicleRows.map((r) => [r.v.no, r.v.model, r.v.plate, r.trips, r.km, r.pax, r.deliveries, r.checks, weeks.length, r.issues, r.open, r.odo || "", STATUS_TXT[r.status]])],
    issues: () => [["Reported at", "Vehicle", "Plate", "Problem", "Details", "Severity", "Source", "Reported by", "Odometer km", "Status", "Resolved at", "Resolved by", "Repair / action"],
      issues.map((i) => [at(i.reported_at), vehicleModel(i.vehicle_number), i.vehicle_number, i.title, i.description, SEVERITY_LABEL[i.severity] || i.severity, i.source === "checklist" ? "Weekly checklist" : "Driver report", i.reported_by_name, i.odometer_km ?? "", statusLabel(i.status), at(i.resolved_at), i.resolved_by || "", i.resolution_note || ""])],
    checklists: () => [["Week of", "Submitted at", "Driver", "Vehicle", "Plate", "Odometer km", "Section", "Item", "Result", "Comment"],
      insp.flatMap((i) => CHECKLIST.flatMap((s) => s.items.map(([k, l]) => [i.week_key, at(i.submitted_at), i.driver_name, vehicleModel(i.vehicle_number), i.vehicle_number, i.odometer_km, s.title, l, { ok: "OK", attention: "Needs attention", na: "N/A" }[i.items[k]?.status] || "", i.items[k]?.comment || ""])))],
  };
  app.querySelectorAll("[data-x]").forEach((b) => b.addEventListener("click", () => {
    const [header, rows] = exporters[b.dataset.x]();
    downloadCSV(`hrid-${b.dataset.x}-${month}.csv`, header, rows);
    toast(`${rows.length} row(s) exported`);
  }));
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
  const label = { request_created: "New request", request_approved: "Approved / assigned", request_rejected: "Rejected", request_cancelled: "Cancelled", vehicle_issue: "Vehicle problem", delivery_done: "Delivery – signature needed", delivery_signed: "Delivery confirmed" };
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
