// Driver: home, step-by-step trip (start → arrivals → signatures → finish), weekly checklist, problem reports.
import { db } from "./store.js";
import { icon } from "./icons.js";
import { fmtDate, fmtDateTime, getInspectionWindow, isInspectionDue, weekKey } from "./schedule.js";
import { CHECKLIST, checklistLabel, ISSUE_CATEGORIES, SEVERITIES } from "./checklist.js";
import { fleetOptions, vehicleLabel } from "./fleet.js";
import {
  state, route, go, shell, notify, isItems, tripCard, listOrEmpty, tripDetails, timelineHTML, signaturesHTML, printHeader,
  routePoints, issueCard, issueOrder,
} from "./core.js";
import {
  esc, uid, toast, field, readForm, validate, badge, gpsText, captureLocation, getGPS, signatureModal, modal, paxBadge,
  itemsListHTML, newPax, paxRecord,
} from "./ui.js";

const SEVERITY_LABEL = Object.fromEntries(SEVERITIES);
const byTime = (a, b) => (a.trip_date + a.departure_time).localeCompare(b.trip_date + b.departure_time);
const mine = (r) => r.assigned_driver_id === state.user.id;
const canRun = (r) => r && (state.user.role === "admin" || mine(r));

/* ================= driver home ================= */
async function lastInspection(driverId) {
  return (await db.list("vehicle_inspections")).filter((i) => i.driver_id === driverId).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))[0] || null;
}
export async function driverHome() {
  const [reqs, issues] = await Promise.all([db.list("trip_requests"), db.list("vehicle_issues")]);
  const my = reqs.filter(mine);
  const running = my.filter((r) => r.status === "started").sort(byTime);
  const upcoming = my.filter((r) => r.status === "approved").sort(byTime);
  const last = await lastInspection(state.user.id);
  const w = getInspectionWindow();
  const myOpen = issues.filter((i) => i.reported_by_id === state.user.id && i.status === "open").sort(issueOrder);
  await shell("Home", `
    ${isInspectionDue(last?.submitted_at)
      ? `<div class="alert warn"><div><b>Weekly vehicle checklist is due</b><div class="small">Every Sunday at 08:00</div></div><a class="btn btn-blue" href="#/inspection">${icon("clipboard")} Do checklist</a></div>`
      : `<div class="alert ok"><div><b>Checklist done this week</b><div class="small">Next: ${esc(fmtDateTime(w.end))}</div></div></div>`}
    ${running.length ? `<div class="section-title"><h2>Trip in progress</h2></div>${running.map((r) => tripCard(r, `#/run/${r.id}`, `<div style="margin-top:8px"><span class="btn btn-blue btn-sm">${icon("play")} Continue trip</span></div>`)).join("")}` : ""}
    <div class="section-title"><h2>My next trips</h2><span class="small muted">${upcoming.length}</span></div>
    ${listOrEmpty(upcoming, (r) => tripCard(r, `#/run/${r.id}`, `<div style="margin-top:8px"><span class="btn btn-primary btn-sm">${icon("play")} Open</span></div>`), "No trips assigned to you right now.")}
    <a class="btn btn-danger btn-block" href="#/report-issue" style="margin-top:16px">${icon("alert")} Report a vehicle problem</a>
    ${myOpen.length ? `<div class="section-title"><h2>My open problem reports</h2></div>${myOpen.map((i) => issueCard(i, `#/issues/${i.id}`)).join("")}` : ""}`);
}

route("/trips", ["driver"], async () => {
  const list = (await db.list("trip_requests")).filter((r) => mine(r) && r.status !== "pending").sort((a, b) => byTime(b, a));
  await shell("My trips", listOrEmpty(list, (r) => tripCard(r, ["approved", "started"].includes(r.status) ? `#/run/${r.id}` : `#/trip/${r.id}`), "No trips yet."));
});

/* ================= read-only trip view (driver) ================= */
route("/trip/:id", ["driver"], async ({ id }) => {
  const r = await db.get("trip_requests", id);
  if (!canRun(r)) return go("/");
  await shell("Trip", `<div class="row between no-print"><a class="btn btn-outline btn-sm" href="#/trips">← Back</a><button class="btn btn-outline btn-sm" type="button" onclick="window.print()">${icon("printer")} Print / PDF</button></div>
    ${printHeader("Trip report")}<div style="margin-top:12px">${tripDetails(r)}</div>${timelineHTML(r)}${signaturesHTML(r)}`);
});

/* ================= step-by-step trip ================= */
route("/run/:id", ["driver", "admin"], async ({ id }) => {
  let r = await db.get("trip_requests", id);
  if (!canRun(r)) return go("/");
  if (!["approved", "started"].includes(r.status)) return go(state.user.role === "admin" ? `/admin/trips/${id}` : `/trip/${id}`);
  const save = async (patch) => { r = await db.update("trip_requests", id, patch); return r; };
  const pts = routePoints(r);
  const items = isItems(r);
  const head = `<div class="card">
    <div class="row between" style="margin-bottom:8px"><b>${esc(r.reference)}</b>${badge(r.status)}</div>
    <dl class="kv"><dt>When</dt><dd>${esc(fmtDate(r.trip_date))} · ${esc(r.departure_time)}${r.return_time ? ` – return ${esc(r.return_time)}` : ""}</dd>
      <dt>Vehicle</dt><dd>${esc(vehicleLabel(r.assigned_vehicle_number))}</dd>
      <dt>Requested by</dt><dd>${esc(r.requester_name)}${r.for_guest ? ` · <a href="tel:${esc(r.guest_phone)}">${esc(r.guest_phone)}</a>` : ""}</dd>
      <dt>Purpose</dt><dd>${esc(r.purpose)}</dd>${r.notes ? `<dt>Notes</dt><dd>${esc(r.notes)}</dd>` : ""}
      ${items ? `<dt>Items</dt><dd>${itemsListHTML(r.items)}</dd><dt>Receiver</dt><dd><span data-no-tr>${esc(r.recipient_name)}</span>${r.recipient_phone ? ` · <a href="tel:${esc(r.recipient_phone)}">${esc(r.recipient_phone)}</a>` : ""}</dd>` : ""}
    </dl></div>`;

  if (r.status === "approved") {
    await shell("Start trip", `${head}
      <div class="card"><h2>Route</h2>${pts.map((p, i) => `<div class="step"><span class="dotn">${i + 1}</span><div class="body"><div class="lbl">${esc(p.label)}</div><div class="name" data-no-tr>${esc(p.name)}</div></div></div>`).join("")}</div>
      ${!items ? `<div class="card"><h2>Passengers (${r.passengers.length})</h2>${r.passengers.map((p) => `<div class="small" style="padding:3px 0"><span data-no-tr>${esc(p.name)}</span> ${paxBadge(p)}</div>`).join("")}</div>` : ""}
      <form id="start" class="card stack" novalidate>
        ${field("odometer_start", "Odometer now (km)", { type: "number", required: true, attrs: 'min="0" inputmode="numeric"' })}
        <button class="btn btn-primary btn-block btn-lg" type="submit">${icon("play")} Start trip – record departure</button>
        <p class="small muted">Your time and location are recorded when you start.</p>
      </form>`);
    document.getElementById("start").addEventListener("submit", async (e) => {
      e.preventDefault(); const f = e.target;
      if (!validate(f, (d) => (Number(d.odometer_start) < 0 ? { odometer_start: "Cannot be negative" } : {}))) return;
      const loc = await captureLocation(); if (!loc) return;
      const cps = []; cps[0] = loc;
      await save({ status: "started", started_at: loc.at, odometer_start: Number(readForm(f).odometer_start), checkpoints: cps });
      await notify("trip_started", { request: r });
      toast("Trip started – departure recorded"); go(`/run/${id}`);
    });
    return;
  }

  // ---- in progress ----
  const done = (i) => !!r.checkpoints?.[i]?.at;
  const nextIdx = pts.findIndex((_, i) => !done(i));
  await shell("Trip in progress", `${head}
    <div class="card"><h2>Route</h2>
      ${pts.map((p, i) => `<div class="step ${done(i) ? "done" : ""}"><span class="dotn">${done(i) ? icon("check") : i + 1}</span>
        <div class="body"><div class="lbl">${esc(p.label)}</div><div class="name" data-no-tr>${esc(p.name)}</div>
          ${done(i) ? `<div class="when">${p.kind === "departure" ? "Departed" : "Arrived"} ${esc(fmtDateTime(r.checkpoints[i].at))} · ${gpsText(r.checkpoints[i].gps)}</div>` : ""}</div>
        ${!done(i) ? `<button type="button" class="btn ${i === nextIdx ? "btn-blue" : "btn-outline"} btn-sm" data-cp="${i}">${icon("pin")} ${p.kind === "return" ? "Back" : "Arrived"}</button>` : ""}</div>`).join("")}
    </div>
    ${items ? "" : `<div class="card"><h2>Passenger signatures</h2>
      ${r.passengers.map((p, i) => `<div class="step ${p.signature ? "done" : ""}"><span class="dotn">${p.signature ? icon("check") : i + 1}</span>
        <div class="body"><div class="name"><span data-no-tr>${esc(p.name)}</span> ${paxBadge(p)}</div>${p.signature ? `<div class="when">Signed ${esc(fmtDateTime(p.signed_at))}</div>` : ""}</div>
        ${p.signature ? "" : `<button type="button" class="btn btn-blue btn-sm" data-sign="${i}">${icon("pen")} Sign</button>`}</div>`).join("") || `<p class="muted small">No passengers.</p>`}
      <button type="button" class="btn btn-outline btn-sm" id="addpax" style="margin-top:10px">${icon("plus")} Add passenger</button></div>`}
    <form id="finish" class="card stack" novalidate><h2 style="margin:0">Finish</h2>
      ${items ? field("received_by", "Handed over to (name)", { required: true, value: r.received_by || r.recipient_name || "" }) : ""}
      ${field("odometer_end", "Odometer at the end (km)", { type: "number", required: true, attrs: `min="${esc(r.odometer_start ?? 0)}" inputmode="numeric"` })}
      <label class="check"><input type="checkbox" name="declaration" /><span>${items ? "I confirm the details are correct and the items were handed over." : "I confirm the details are correct and every passenger signed personally."}</span></label>
      <span class="err-text" data-err="declaration"></span><span class="err-text" data-err="steps"></span>
      <button class="btn btn-primary btn-block btn-lg" type="submit">${icon("flag")} Finish trip</button>
    </form>
    <a class="btn btn-danger btn-sm" href="#/report-issue">${icon("alert")} Report a vehicle problem</a>`);

  document.querySelectorAll("[data-cp]").forEach((b) => b.addEventListener("click", async () => {
    b.disabled = true;
    const loc = await captureLocation();
    if (!loc) { b.disabled = false; return; }
    const cps = [...(r.checkpoints || [])]; cps[+b.dataset.cp] = loc;
    await save({ checkpoints: cps });
    toast(loc.gps ? "Arrival recorded" : "Arrival recorded without location"); go(`/run/${id}`);
  }));
  document.querySelectorAll("[data-sign]").forEach((b) => b.addEventListener("click", () => {
    const p = r.passengers[+b.dataset.sign];
    signatureModal("Passenger signature", `${p.name} – sign with your finger.`, async (img) => {
      const gps = await getGPS();
      const pax = r.passengers.map((x, i) => (i === +b.dataset.sign ? { ...x, signature: img, signed_at: new Date().toISOString(), signed_gps: gps } : x));
      await save({ passengers: pax, passenger_count: pax.length });
      toast("Signature saved"); go(`/run/${id}`);
    });
  }));
  document.getElementById("addpax")?.addEventListener("click", async () => {
    const users = (await db.list("users")).filter((u) => u.active !== false && !r.passengers.some((p) => p.user_id === u.id)).sort((a, b) => a.full_name.localeCompare(b.full_name));
    let type = "hrid";
    modal(`<form class="stack" novalidate><h2>Add passenger</h2>
      <div class="seg" role="group"><button type="button" class="pick" data-t="hrid" aria-pressed="true">HRID employee</button><button type="button" class="pick" data-t="external" aria-pressed="false">Non-HRID</button></div>
      <div id="m-hrid">${field("user_id", "Employee", { required: true, options: users.map((u) => [u.id, u.full_name]) })}</div>
      <div id="m-ext" hidden>${field("name", "Full name", { required: true })}${field("organization", "Company (optional)")}</div>
      <div class="grid two"><button class="btn btn-outline" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">Add</button></div></form>`, (bg, close) => {
      const f = bg.querySelector("form");
      f.querySelectorAll("[data-t]").forEach((x) => x.addEventListener("click", () => {
        type = x.dataset.t; f.querySelectorAll("[data-t]").forEach((y) => y.setAttribute("aria-pressed", String(y === x)));
        f.querySelector("#m-hrid").hidden = type !== "hrid"; f.querySelector("#m-ext").hidden = type === "hrid";
      }));
      f.addEventListener("submit", async (e) => {
        e.preventDefault(); if (!validate(f)) return;
        const d = readForm(f), u = users.find((x) => x.id === d.user_id);
        const p = type === "hrid" ? paxRecord({ ...newPax("hrid"), user_id: u.id, name: u.full_name, employee_no: u.employee_no, department: u.department }) : paxRecord({ ...newPax("external"), name: d.name, organization: d.organization });
        const pax = [...r.passengers, { ...p, added_by_driver: true }];
        await save({ passengers: pax, passenger_count: pax.length }); close(); toast("Passenger added"); go(`/run/${id}`);
      });
    });
  });
  document.getElementById("finish").addEventListener("submit", async (e) => {
    e.preventDefault(); const f = e.target;
    if (!validate(f, (d) => {
      const er = {};
      if (pts.some((_, i) => !done(i))) er.steps = "Record every location on the route first";
      else if (!items && r.passengers.some((p) => !p.signature)) er.steps = "Every passenger must sign first";
      if (d.odometer_end !== "" && Number(d.odometer_end) < Number(r.odometer_start)) er.odometer_end = "Must be greater than the start reading";
      if (!f.declaration.checked) er.declaration = "Please confirm";
      return er;
    })) return;
    f.querySelector("[type=submit]").disabled = true;
    const d = readForm(f), now = new Date().toISOString(), gps = await getGPS();
    const patch = { status: items ? "delivered" : "completed", finished_at: now, finished_gps: gps, odometer_end: Number(d.odometer_end), distance_km: Number(d.odometer_end) - Number(r.odometer_start), driver_declaration: true };
    if (items) { patch.received_by = d.received_by; patch.delivered_at = now; }
    const upd = await save(patch);
    if (items) await notify("delivery_done", { request: upd });
    toast(items ? `Delivery finished – ${r.requester_name} has been asked to sign` : "Trip finished"); go("/");
  });
});

/* ================= vehicle problems ================= */
export async function saveIssues(list) {
  for (const i of list) await db.insert("vehicle_issues", i);
  if (list.length) await notify("vehicle_issue", { issues: list });
}
route("/report-issue", ["driver", "admin"], async () => {
  await shell("Report a vehicle problem", `<form id="iss" class="card stack" novalidate>
    <p class="small muted">The administrators are notified immediately.</p>
    ${field("vehicle_number", "Vehicle", { required: true, value: state.user.default_vehicle || "", options: fleetOptions() })}
    ${field("category", "Problem", { required: true, options: ISSUE_CATEGORIES.filter((c) => c !== "Weekly checklist") })}
    ${field("severity", "How serious?", { required: true, options: SEVERITIES })}
    ${field("description", "Describe it", { type: "textarea", required: true })}
    ${field("odometer_km", "Odometer (km, optional)", { type: "number", attrs: 'min="0" inputmode="numeric"' })}
    <button class="btn btn-danger btn-block btn-lg" type="submit">${icon("alert")} Send report</button>
  </form>`);
  const form = document.getElementById("iss");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate(form, (d) => (d.odometer_km !== "" && Number(d.odometer_km) < 0 ? { odometer_km: "Cannot be negative" } : {}))) return;
    const loc = await captureLocation(); if (!loc) return;
    form.querySelector("[type=submit]").disabled = true;
    const d = readForm(form);
    await saveIssues([{ id: uid(), source: "driver", vehicle_number: d.vehicle_number, vehicle_label: vehicleLabel(d.vehicle_number), title: d.category, category: d.category,
      description: d.description, severity: d.severity, odometer_km: d.odometer_km === "" ? null : Number(d.odometer_km), gps: loc.gps,
      reported_by_id: state.user.id, reported_by_name: state.user.full_name, reported_at: loc.at, status: "open" }]);
    toast("Problem reported – the administrators have been notified"); go("/");
  });
});
export function issueView(i) {
  return `<div class="card"><div class="row between" style="margin-bottom:12px"><h2 style="margin:0">${esc(i.title)}</h2><span class="row" style="gap:6px">${badge(i.severity)}${badge(i.status)}</span></div>
    <dl class="kv"><dt>Vehicle</dt><dd>${esc(vehicleLabel(i.vehicle_number))}</dd><dt>How serious?</dt><dd>${esc(SEVERITY_LABEL[i.severity] || i.severity)}</dd>
    ${i.description ? `<dt>Details</dt><dd>${esc(i.description)}</dd>` : ""}
    <dt>Reported by</dt><dd>${esc(i.reported_by_name)} · ${i.source === "checklist" ? "Weekly checklist" : "Driver report"}</dd><dt>Reported</dt><dd>${esc(fmtDateTime(i.reported_at))}</dd>
    ${i.odometer_km != null ? `<dt>Odometer</dt><dd>${esc(i.odometer_km)} km</dd>` : ""}<dt>Location</dt><dd>${gpsText(i.gps)}</dd>
    ${i.status === "resolved" ? `<dt>Resolved</dt><dd>${esc(fmtDateTime(i.resolved_at))} · ${esc(i.resolved_by)}</dd>${i.resolution_note ? `<dt>Repair / action</dt><dd>${esc(i.resolution_note)}</dd>` : ""}` : ""}</dl></div>`;
}
route("/issues/:id", ["driver"], async ({ id }) => {
  const i = await db.get("vehicle_issues", id);
  if (!i) return go("/");
  await shell("Vehicle problem", `<a class="btn btn-outline btn-sm" href="#/">← Back</a><div style="margin-top:12px">${issueView(i)}</div>`);
});

/* ================= weekly checklist ================= */
export function inspectionView(i) {
  const lbl = { ok: "OK", attention: "Needs attention", na: "N/A" }, cls = { ok: "b-ok", attention: "b-defect", na: "b-na" };
  return `<div class="card" style="margin-top:14px"><h2>Checklist – ${esc(vehicleLabel(i.vehicle_number))}</h2>
    <dl class="kv"><dt>Driver</dt><dd>${esc(i.driver_name)}</dd><dt>Week of</dt><dd>${esc(fmtDate(i.week_key))}</dd><dt>Submitted</dt><dd>${esc(fmtDateTime(i.submitted_at))}</dd><dt>Odometer</dt><dd>${esc(i.odometer_km)} km</dd><dt>Location</dt><dd>${gpsText(i.gps)}</dd>${i.notes ? `<dt>Notes</dt><dd>${esc(i.notes)}</dd>` : ""}</dl></div>
    ${CHECKLIST.map((s) => `<div class="card"><h3 style="margin-bottom:8px">${esc(s.title)}</h3>${s.items.map(([k, l]) => { const it = i.items[k] || {}; return `<div class="ci"><div class="ci-top"><span>${esc(l)}</span><span class="badge ${cls[it.status] || "b-na"}">${lbl[it.status] || "-"}</span></div>${it.comment ? `<div class="small" style="color:var(--danger)">${esc(it.comment)}</div>` : ""}</div>`; }).join("")}</div>`).join("")}`;
}
route("/inspection", ["driver"], async () => {
  const last = await lastInspection(state.user.id);
  const w = getInspectionWindow();
  if (!isInspectionDue(last?.submitted_at)) return shell("Weekly checklist", `<div class="alert ok"><div><b>This week's checklist is done</b><div class="small">Next: ${esc(fmtDateTime(w.end))}</div></div></div>${inspectionView(last)}`);
  await shell("Weekly checklist", `<form id="insp" class="stack" novalidate>
    <div class="card"><div class="grid two">
      ${field("vehicle_number", "Vehicle", { required: true, value: state.user.default_vehicle || "", options: fleetOptions() })}
      ${field("odometer_km", "Odometer (km)", { type: "number", required: true, attrs: 'min="0" inputmode="numeric"' })}
    </div>
    <button type="button" class="btn btn-outline btn-sm" id="allok" style="margin-top:12px">${icon("check")} Mark everything OK, then change what is not</button></div>
    ${CHECKLIST.map((sec) => `<div class="card"><h2>${esc(sec.title)}</h2>${sec.items.map(([key, label]) => `
      <div class="ci" data-key="${key}"><div class="ci-top"><span>${esc(label)}</span>
        <span class="seg" role="group" aria-label="${esc(label)}"><button type="button" class="ok" data-v="ok" aria-pressed="false">OK</button><button type="button" class="bad" data-v="attention" aria-pressed="false">Problem</button><button type="button" class="na" data-v="na" aria-pressed="false">N/A</button></span></div>
        <textarea class="input" data-comment hidden placeholder="What is wrong? (required)"></textarea><span class="err-text" data-ci-err></span></div>`).join("")}</div>`).join("")}
    <div class="card stack">
      <div id="sev-box" hidden>${field("severity", "Problems found – how serious?", { required: true, options: SEVERITIES })}<p class="small muted" style="margin-top:6px">The administrators are notified about every problem.</p></div>
      ${field("notes", "Notes (optional)", { type: "textarea" })}
      <label class="check"><input type="checkbox" name="declaration" /><span>I checked this vehicle myself and the answers are correct.</span></label>
      <span class="err-text" data-err="declaration"></span>
      <button class="btn btn-primary btn-block btn-lg" type="submit">${icon("check")} Submit checklist</button>
    </div></form>`);
  const form = document.getElementById("insp"), sevBox = document.getElementById("sev-box");
  const setVal = (ci, v) => {
    ci.querySelectorAll(".seg button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.v === v)));
    ci.dataset.value = v; ci.querySelector("[data-comment]").hidden = v !== "attention"; ci.querySelector("[data-ci-err]").textContent = "";
    sevBox.hidden = !form.querySelector('.ci[data-value="attention"]');
  };
  form.querySelectorAll(".ci").forEach((ci) => ci.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => setVal(ci, b.dataset.v))));
  document.getElementById("allok").addEventListener("click", () => form.querySelectorAll(".ci").forEach((ci) => setVal(ci, "ok")));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    let ok = validate(form, (d) => ({ ...(form.declaration.checked ? {} : { declaration: "Please confirm" }), ...(Number(d.odometer_km) < 0 ? { odometer_km: "Cannot be negative" } : {}) }));
    const items = {};
    form.querySelectorAll(".ci").forEach((ci) => {
      const v = ci.dataset.value, c = ci.querySelector("[data-comment]").value.trim(), err = ci.querySelector("[data-ci-err]");
      if (!v) { err.textContent = "Choose OK, Problem or N/A"; ok = false; } else if (v === "attention" && !c) { err.textContent = "Write what is wrong"; ok = false; }
      items[ci.dataset.key] = { status: v, comment: v === "attention" ? c : "" };
    });
    if (!ok) { [...form.querySelectorAll(".err-text")].find((x) => x.textContent)?.scrollIntoView({ behavior: "smooth", block: "center" }); return toast("Please complete all checklist items"); }
    const loc = await captureLocation(); if (!loc) return;
    form.querySelector("[type=submit]").disabled = true;
    const d = readForm(form);
    const insp = { id: uid(), driver_id: state.user.id, driver_name: state.user.full_name, vehicle_number: d.vehicle_number, week_key: weekKey(), odometer_km: Number(d.odometer_km),
      items, notes: d.notes, severity: d.severity || null, has_defects: Object.values(items).some((i) => i.status === "attention"), driver_declaration: true, gps: loc.gps, submitted_at: loc.at };
    await db.insert("vehicle_inspections", insp);
    const issues = Object.entries(items).filter(([, v]) => v.status === "attention").map(([k, v]) => ({
      id: uid(), source: "checklist", inspection_id: insp.id, item_key: k, vehicle_number: d.vehicle_number, vehicle_label: vehicleLabel(d.vehicle_number),
      title: checklistLabel(k), category: "Weekly checklist", description: v.comment, severity: d.severity || "major", odometer_km: insp.odometer_km, gps: loc.gps,
      reported_by_id: state.user.id, reported_by_name: state.user.full_name, reported_at: loc.at, status: "open" }));
    await saveIssues(issues);
    toast(issues.length ? "Checklist sent – the administrators have been told about the problems" : "Checklist sent"); go("/");
  });
});
