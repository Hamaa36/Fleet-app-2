// Requests: simple request form (employees; admins also for guests), employee pages,
// admin dashboard (status board), admin trip list and approval / assignment.
import { db } from "./store.js";
import { icon } from "./icons.js";
import { fmtDate, todayISO, weekKey, localISODate } from "./schedule.js";
import { fleetOptions, vehicleLabel } from "./fleet.js";
import {
  state, route, go, query, shell, notify, isItems, newReference, tripCard, listOrEmpty, tripDetails, timelineHTML,
  signaturesHTML, printHeader, issueOrder, issueCard, ACTIVE,
} from "./core.js";
import {
  esc, uid, toast, field, readForm, validate, badge, cleanStops, stopsEditor, newPax, paxRecord, paxErrors, passengerEditor,
  newItem, cleanItems, itemsErrors, itemsEditor, signatureModal, captureLocation, modal, norm,
} from "./ui.js";

const byTime = (a, b) => (a.trip_date + a.departure_time).localeCompare(b.trip_date + b.departure_time);
const activeUsers = async () => (await db.list("users")).filter((u) => u.active !== false).sort((a, b) => a.full_name.localeCompare(b.full_name));

/* ================= request form ================= */
route("/requests/new", ["requester", "admin"], async () => {
  const me = state.user, isAdmin = me.role === "admin";
  const users = await activeUsers();
  const drivers = users.filter((u) => u.role === "driver");
  const stops = [""], others = [], items = [newItem()];
  let type = "passengers", forWho = "employee";
  const dateDefault = todayISO();

  await shell(isAdmin ? "New request" : "Request transport", `<form id="rq" class="card" novalidate>
    ${isAdmin ? `<div class="form-section"><h3>Who is it for?</h3>
      <div class="choice" role="group" aria-label="Who is it for?">
        <button type="button" data-for="employee" aria-pressed="true">${icon("user")}<span>HRID employee</span></button>
        <button type="button" data-for="guest" aria-pressed="false">${icon("users")}<span>Guest</span><small>Visitors – only admins can request</small></button>
      </div>
      <div id="for-employee" style="margin-top:12px">${field("requester_id", "Employee", { required: true, value: me.id, options: users.map((u) => [u.id, `${u.full_name}${u.employee_no ? ` (#${u.employee_no})` : ""}`]) })}</div>
      <div id="for-guest" hidden style="margin-top:12px"><div class="grid two">
        ${field("guest_name", "Guest name", { required: true })}${field("guest_organization", "Company / organisation", { required: true })}
        ${field("guest_phone", "Guest phone", { type: "tel", required: true })}${field("guest_email", "Guest email (optional)", { type: "email" })}
      </div><div style="margin-top:12px">${field("guest_host", "HRID host", { required: true, value: me.full_name })}</div></div>
    </div>` : ""}

    <div class="form-section"><h3>What?</h3>
      <div class="choice" role="group" aria-label="What?">
        <button type="button" data-type="passengers" aria-pressed="true">${icon("users")}<span>People</span></button>
        <button type="button" data-type="items" aria-pressed="false">${icon("box")}<span>Documents & items</span></button>
      </div></div>

    <div class="form-section"><h3>Where?</h3>
      ${field("origin", "From", { required: true, placeholder: "e.g. HRID Head Office" })}
      <div class="field" style="margin-top:12px"><span class="label">To <span class="req">*</span></span><div id="stops"></div><span class="err-text" data-err="stops"></span></div>
    </div>

    <div class="form-section"><h3>When?</h3><div class="grid three">
      ${field("trip_date", "Date", { type: "date", required: true, value: dateDefault, attrs: `min="${todayISO()}"` })}
      ${field("departure_time", "Time", { type: "time", required: true })}
      ${field("return_time", "Return time (optional)", { type: "time" })}
    </div></div>

    <div class="form-section" id="sec-pax"><h3>Who is travelling?</h3>
      <label class="check highlight"><input type="checkbox" name="self_passenger" checked /><span id="self-label">${isAdmin ? "The person above is travelling" : "I am travelling"}</span></label>
      <div id="pax" style="margin-top:10px"></div><span class="err-text" data-err="passengers"></span>
      <p class="small" id="paxcount" style="margin-top:8px;font-weight:600"></p>
    </div>

    <div class="form-section" id="sec-items" hidden><h3>What is being sent?</h3>
      <div id="items"></div><span class="err-text" data-err="items"></span>
      <div class="grid two" style="margin-top:12px">${field("recipient_name", "Receiver name", { required: true })}${field("recipient_phone", "Receiver phone", { type: "tel" })}</div>
      <p class="small muted" style="margin-top:8px">${isAdmin ? "The requester confirms the delivery by signing on their own phone." : "After delivery you confirm by signing on your own phone."}</p>
    </div>

    <div class="form-section">
      ${field("purpose", "Purpose", { required: true, placeholder: "e.g. Meeting at the bank" })}
      <div style="margin-top:12px">${field("notes", "Notes (optional)", { type: "textarea" })}</div>
    </div>

    ${isAdmin ? `<div class="form-section"><h3>Assign now (optional)</h3>
      <p class="small muted" style="margin-bottom:10px">Choose a driver and vehicle to approve the request straight away.</p>
      <div class="grid two">${field("driver_id", "Driver", { options: drivers.map((d) => [d.id, d.full_name]) })}${field("vehicle", "Vehicle", { options: fleetOptions() })}</div>
    </div>` : ""}

    <div class="form-section"><button class="btn btn-primary btn-block btn-lg" type="submit">${icon("send")} Send request</button></div>
  </form>`);

  const form = document.getElementById("rq");
  const requester = () => (forWho === "guest" ? null : users.find((u) => u.id === (isAdmin ? form.requester_id.value : me.id)));
  const selfPax = () => {
    if (!form.self_passenger.checked) return [];
    if (forWho === "guest") return form.guest_name.value.trim() ? [paxRecord({ type: "external", name: form.guest_name.value, organization: form.guest_organization.value })] : [];
    const u = requester();
    return u ? [paxRecord({ type: "hrid", user_id: u.id, name: u.full_name, employee_no: u.employee_no, department: u.department })] : [];
  };
  const all = () => [...selfPax(), ...others.map(paxRecord)];
  const count = () => (document.getElementById("paxcount").textContent = `Total passengers: ${all().length}`);
  stopsEditor(document.getElementById("stops"), stops);
  passengerEditor(document.getElementById("pax"), others, { employees: users, onChange: count });
  itemsEditor(document.getElementById("items"), items);
  form.self_passenger.addEventListener("change", count);
  ["guest_name", "requester_id"].forEach((n) => form[n]?.addEventListener("input", count));
  form.requester_id?.addEventListener("change", count);
  count();

  form.querySelectorAll("[data-type]").forEach((b) => b.addEventListener("click", () => {
    type = b.dataset.type;
    form.querySelectorAll("[data-type]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    document.getElementById("sec-pax").hidden = type !== "passengers";
    document.getElementById("sec-items").hidden = type !== "items";
  }));
  form.querySelectorAll("[data-for]").forEach((b) => b.addEventListener("click", () => {
    forWho = b.dataset.for;
    form.querySelectorAll("[data-for]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    document.getElementById("for-employee").hidden = forWho !== "employee";
    document.getElementById("for-guest").hidden = forWho !== "guest";
    document.getElementById("self-label").textContent = forWho === "guest" ? "The guest is travelling" : "The person above is travelling";
    count();
  }));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate(form, (d) => {
      const er = {};
      if (!cleanStops(stops).length) er.stops = "Enter where to go";
      if (d.trip_date && d.trip_date < todayISO()) er.trip_date = "Date cannot be in the past";
      if (d.return_time && d.departure_time && d.return_time <= d.departure_time) er.return_time = "Must be after the departure time";
      if (type === "passengers") { const pe = paxErrors(others, all()); if (pe) er.passengers = pe; }
      else { const ie = itemsErrors(items); if (ie) er.items = ie; }
      if (forWho === "guest") {
        if (d.guest_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.guest_email)) er.guest_email = "Enter a valid email";
        if (d.guest_phone && d.guest_phone.replace(/\D/g, "").length < 7) er.guest_phone = "Enter a valid phone number";
      }
      if (isAdmin && (!!d.driver_id !== !!d.vehicle)) er[d.driver_id ? "vehicle" : "driver_id"] = "Choose both driver and vehicle, or neither";
      return er;
    })) return;
    const d = readForm(form);
    const s = cleanStops(stops), u = requester(), now = new Date().toISOString();
    const pax = type === "passengers" ? all() : [];
    const r = {
      id: uid(), reference: newReference(), trip_type: type, status: "pending", created_at: now,
      created_by_id: me.id, created_by_name: me.full_name, created_by_admin: isAdmin,
      for_guest: forWho === "guest",
      requester_id: u?.id || null, requester_name: forWho === "guest" ? d.guest_name : u.full_name, department: forWho === "guest" ? "Guest" : u.department || "",
      ...(forWho === "guest" ? { guest_organization: d.guest_organization, guest_phone: d.guest_phone, guest_email: (d.guest_email || "").toLowerCase(), guest_host: d.guest_host } : {}),
      origin: d.origin, stops: s, destination: s.join(" → "), trip_date: d.trip_date, departure_time: d.departure_time, return_time: d.return_time || "",
      passengers: pax, passenger_count: pax.length,
      items: type === "items" ? cleanItems(items) : [], recipient_name: type === "items" ? d.recipient_name : "", recipient_phone: type === "items" ? d.recipient_phone : "",
      purpose: d.purpose, notes: d.notes, checkpoints: [],
    };
    form.querySelector("[type=submit]").disabled = true;
    if (isAdmin && d.driver_id) {
      const drv = drivers.find((x) => x.id === d.driver_id);
      Object.assign(r, { status: "approved", assigned_driver_id: drv.id, assigned_driver_name: drv.full_name, assigned_vehicle_number: d.vehicle, reviewed_by: me.full_name, reviewed_at: now, direct_approval: true });
      await db.insert("trip_requests", r);
      await notify("request_approved", { request: r });
      toast(`Request approved and assigned to ${drv.full_name}`);
    } else {
      await db.insert("trip_requests", r);
      await notify("request_created", { request: r });
      toast("Request sent – the administrators have been notified");
    }
    go(isAdmin ? "/admin/trips" : "/requests");
  });
});

/* ================= employee ================= */
async function requesterHome() {
  const mine = (await db.list("trip_requests")).filter((r) => r.requester_id === state.user.id);
  const toSign = mine.filter((r) => r.status === "delivered");
  const active = mine.filter((r) => ["pending", "approved", "started"].includes(r.status)).sort(byTime);
  await shell("Home", `
    ${toSign.map((r) => `<div class="alert warn" style="margin-bottom:12px"><div><b>Your delivery arrived – please sign</b><div class="small">${esc(r.reference)}</div></div><a class="btn btn-blue" href="#/requests/${r.id}">${icon("pen")} Sign</a></div>`).join("")}
    <a class="btn btn-primary btn-block btn-lg" href="#/requests/new">${icon("plus")} Request transport</a>
    <div class="section-title"><h2>Current requests</h2></div>
    ${listOrEmpty(active, (r) => tripCard(r, `#/requests/${r.id}`), "You have no current requests.")}
    <a class="btn btn-outline btn-block" href="#/requests" style="margin-top:14px">${icon("list")} All my requests</a>`);
}
route("/requests", ["requester"], async () => {
  const list = (await db.list("trip_requests")).filter((r) => r.requester_id === state.user.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  await shell("My requests", listOrEmpty(list, (r) => tripCard(r, `#/requests/${r.id}`), "You have not requested any transport yet."));
});
route("/requests/:id", ["requester"], async ({ id }) => {
  const r = await db.get("trip_requests", id);
  if (!r || r.requester_id !== state.user.id) return go("/requests");
  await shell("Request", `<a class="btn btn-outline btn-sm no-print" href="#/requests">← Back</a>
    ${r.status === "delivered" ? `<div class="alert warn" style="margin-top:12px"><div><b>Your delivery arrived</b><div class="small">Check the items and sign to confirm.</div></div><button class="btn btn-blue" type="button" id="sign">${icon("pen")} Sign</button></div>` : ""}
    <div style="margin-top:12px">${tripDetails(r)}</div>${timelineHTML(r)}${signaturesHTML(r)}
    ${r.status === "pending" ? `<button class="btn btn-danger btn-block" id="cancel" type="button" style="margin-top:14px">Cancel request</button>` : ""}`);
  document.getElementById("cancel")?.addEventListener("click", async () => {
    if (!confirm("Cancel this request?")) return;
    const upd = await db.update("trip_requests", id, { status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: state.user.full_name });
    await notify("request_cancelled", { request: upd }); toast("Request cancelled"); go("/requests");
  });
  document.getElementById("sign")?.addEventListener("click", () => {
    signatureModal("Confirm delivery", "Sign to confirm the documents/items were delivered.", async (img) => {
      const loc = await captureLocation();
      if (!loc) return;
      const upd = await db.update("trip_requests", id, { status: "completed", requester_signature: img, requester_signed_at: loc.at, requester_signed_gps: loc.gps });
      await notify("delivery_signed", { request: upd });
      toast("Thank you – delivery confirmed"); go(`/requests/${id}`);
    });
  });
});

/* ================= admin dashboard: status board ================= */
let boardFilter = "pending";
const BOARD = [
  ["pending", "Pending approval"], ["approved", "Approved – not started"], ["started", "In progress"],
  ["delivered", "Awaiting signature"], ["completed", "Completed today"], ["problems", "Vehicle problems"],
];
async function adminHome() {
  const [reqs, issues, users, insp] = await Promise.all([db.list("trip_requests"), db.list("vehicle_issues"), db.list("users"), db.list("vehicle_inspections")]);
  const today = todayISO();
  const groups = {
    pending: reqs.filter((r) => r.status === "pending").sort(byTime),
    approved: reqs.filter((r) => r.status === "approved").sort(byTime),
    started: reqs.filter((r) => r.status === "started").sort(byTime),
    delivered: reqs.filter((r) => r.status === "delivered").sort(byTime),
    completed: reqs.filter((r) => r.status === "completed" && (r.trip_date === today || (r.finished_at && localISODate(r.finished_at) === today))).sort(byTime),
    problems: issues.filter((i) => i.status === "open").sort(issueOrder),
  };
  const unsafe = groups.problems.filter((i) => i.severity === "unsafe");
  const drivers = users.filter((u) => u.role === "driver" && u.active !== false);
  const doneChk = new Set(insp.filter((i) => i.week_key === weekKey()).map((i) => i.driver_id));
  const todays = reqs.filter((r) => r.trip_date === today && ACTIVE.concat("completed").includes(r.status)).sort(byTime);
  await shell("Dashboard", `
    ${unsafe.length ? `<div class="alert err" style="margin-bottom:12px"><div><b>${unsafe.length} vehicle(s) reported unsafe</b><div class="small">${[...new Set(unsafe.map((i) => vehicleLabel(i.vehicle_number)))].join(", ")}</div></div><a class="btn btn-danger btn-sm" href="#/admin/vehicles">View</a></div>` : ""}
    <div class="row between" style="margin-bottom:12px"><a class="btn btn-primary" href="#/requests/new">${icon("plus")} New request</a><a class="btn btn-outline" href="#/admin/reports">${icon("chart")} Reports</a></div>
    <div class="board" role="group" aria-label="Status">
      ${BOARD.map(([k, l]) => `<button type="button" class="tile s-${k}" data-board="${k}" aria-pressed="${boardFilter === k}"><span class="n">${groups[k].length}</span><span class="t">${l}</span></button>`).join("")}
    </div>
    <div class="section-title"><h2 id="board-title">${esc(BOARD.find((b) => b[0] === boardFilter)[1])}</h2></div>
    <div id="board-list">${boardFilter === "problems"
      ? listOrEmpty(groups.problems, (i) => issueCard(i, `#/admin/vehicles/issues/${i.id}`), "Nothing here.")
      : listOrEmpty(groups[boardFilter], (r) => tripCard(r, `#/admin/trips/${r.id}`, r.status === "pending" ? `<div style="margin-top:8px"><span class="btn btn-blue btn-sm">${icon("check")} Review</span></div>` : ""), "Nothing here.")}</div>
    <div class="section-title"><h2>Today</h2><span class="small muted">${esc(fmtDate(today))}</span></div>
    <div class="card" style="padding:8px 12px">${todays.length ? `<div class="table-wrap"><table><thead><tr><th>Time</th><th>Route</th><th>Driver</th><th>Status</th></tr></thead><tbody>
      ${todays.map((r) => `<tr><td>${esc(r.departure_time)}</td><td><a href="#/admin/trips/${r.id}"><span data-no-tr>${esc(r.origin)} → ${esc(r.destination)}</span></a></td><td>${esc(r.assigned_driver_name || "-")}</td><td>${badge(r.status)}</td></tr>`).join("")}
    </tbody></table></div>` : `<p class="empty">No trips today.</p>`}</div>
    <p class="small muted" style="margin-top:12px">${icon("clipboard")} Weekly checklists: <b>${doneChk.size}/${drivers.length}</b> drivers done this week · <a href="#/admin/vehicles">Vehicles</a></p>`);
  document.querySelectorAll("[data-board]").forEach((b) => b.addEventListener("click", () => { boardFilter = b.dataset.board; adminHome(); }));
}

/* ================= admin: all trips ================= */
let tripsTab = "active";
route("/admin/trips", ["admin"], async () => {
  const all = (await db.list("trip_requests")).sort((a, b) => b.trip_date.localeCompare(a.trip_date) || b.departure_time.localeCompare(a.departure_time));
  const tabs = [["active", "Active"], ["pending", "Pending approval"], ["approved", "Approved"], ["started", "In progress"], ["delivered", "Awaiting signature"], ["completed", "Completed"], ["rejected", "Rejected"], ["cancelled", "Cancelled"], ["all", "All"]];
  const pick = (k) => (k === "all" ? all : k === "active" ? all.filter((r) => ACTIVE.includes(r.status)) : all.filter((r) => r.status === k));
  await shell("Trips", `
    <div class="row between no-print" style="margin-bottom:10px"><a class="btn btn-primary" href="#/requests/new">${icon("plus")} New request</a></div>
    <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${tripsTab === k}">${l} (${pick(k).length})</button>`).join("")}</div>
    <div class="field" style="margin-bottom:12px"><label for="q">Search</label><input class="input" id="q" type="search" placeholder="Reference, name, place, driver…" /></div>
    <div id="tlist"></div>`);
  const draw = (q = "") => {
    const n = norm(q);
    const f = pick(tripsTab).filter((r) => !n || norm([r.reference, r.requester_name, r.department, r.origin, r.destination, r.assigned_driver_name, r.assigned_vehicle_number, r.purpose, ...(r.passengers || []).map((p) => p.name)].join(" ")).includes(n));
    document.getElementById("tlist").innerHTML = listOrEmpty(f, (r) => tripCard(r, `#/admin/trips/${r.id}`), "No trips found.");
  };
  document.getElementById("q").addEventListener("input", (e) => draw(e.target.value));
  document.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { tripsTab = b.dataset.tab; go("/admin/trips"); }));
  draw();
});

/* ================= admin: one trip ================= */
const toMin = (t) => { if (!t) return null; const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const overlaps = (a, b) => { const as = toMin(a.departure_time), ae = toMin(a.return_time) ?? as + 120, bs = toMin(b.departure_time), be = toMin(b.return_time) ?? bs + 120; return as < be && bs < ae; };
route("/admin/trips/:id", ["admin"], async ({ id }) => {
  const r = await db.get("trip_requests", id);
  if (!r) return go("/admin/trips");
  const [users, issues, reqs] = await Promise.all([db.list("users"), db.list("vehicle_issues"), db.list("trip_requests")]);
  const drivers = users.filter((u) => u.role === "driver" && u.active !== false).sort((a, b) => a.full_name.localeCompare(b.full_name));
  const canAssign = ["pending", "approved"].includes(r.status);
  await shell("Trip", `
    <div class="row between no-print"><a class="btn btn-outline btn-sm" href="#/admin/trips">← Back</a><button class="btn btn-outline btn-sm" type="button" onclick="window.print()">${icon("printer")} Print / PDF</button></div>
    ${printHeader("Trip report")}
    ${canAssign ? `<form id="rv" class="card stack no-print" novalidate style="margin-top:12px;border-color:var(--primary)">
      <h2 style="margin:0">${r.status === "pending" ? "Approve & assign" : "Change driver / vehicle"}</h2>
      <div class="grid two">${field("driver_id", "Driver", { required: true, value: r.assigned_driver_id || "", options: drivers.map((d) => [d.id, d.full_name]) })}${field("vehicle", "Vehicle", { required: true, value: r.assigned_vehicle_number || "", options: fleetOptions() })}</div>
      <div id="conflict"></div>
      ${field("comment", "Comment (needed to reject or cancel)", { value: r.admin_comment || "" })}
      <div class="grid two"><button class="btn btn-primary" type="submit">${icon("check")} ${r.status === "pending" ? "Approve" : "Save"}</button>
      <button class="btn btn-danger" type="button" id="reject">${r.status === "pending" ? "Reject" : "Cancel trip"}</button></div>
    </form>` : ""}
    <div style="margin-top:12px">${tripDetails(r)}</div>${timelineHTML(r)}${signaturesHTML(r)}`);
  const form = document.getElementById("rv");
  if (!form) return;
  const check = (fromDriver) => {
    const did = form.driver_id.value, d = drivers.find((x) => x.id === did);
    if (fromDriver && d?.default_vehicle && !form.vehicle.value) form.vehicle.value = d.default_vehicle;
    const plate = form.vehicle.value;
    const same = reqs.filter((x) => x.id !== r.id && ["approved", "started"].includes(x.status) && x.trip_date === r.trip_date && overlaps(x, r));
    const dc = did ? same.filter((x) => x.assigned_driver_id === did) : [], vc = plate ? same.filter((x) => x.assigned_vehicle_number === plate) : [];
    const vi = plate ? issues.filter((x) => x.vehicle_number === plate && x.status === "open").sort(issueOrder) : [];
    document.getElementById("conflict").innerHTML = [
      dc.length ? `<div class="alert warn small"><div>${esc(d.full_name)} already has a trip at this time: ${dc.map((c) => `${esc(c.departure_time)} ${esc(c.destination)}`).join("; ")}</div></div>` : "",
      vc.length ? `<div class="alert warn small"><div>${esc(vehicleLabel(plate))} is already booked at this time.</div></div>` : "",
      vi.length ? `<div class="alert ${vi[0].severity === "unsafe" ? "err" : "warn"} small"><div>${esc(vehicleLabel(plate))} has open problems: ${vi.map((x) => esc(x.title)).join("; ")}</div></div>` : "",
    ].join("");
  };
  form.driver_id.addEventListener("change", () => check(true));
  form.vehicle.addEventListener("change", () => check(false));
  check(false);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate(form)) return;
    const d = readForm(form), drv = drivers.find((x) => x.id === d.driver_id);
    form.querySelector("[type=submit]").disabled = true;
    const prev = r.assigned_driver_id && r.assigned_driver_id !== drv.id ? r.assigned_driver_id : null;
    const upd = await db.update("trip_requests", id, { status: "approved", assigned_driver_id: drv.id, assigned_driver_name: drv.full_name, assigned_vehicle_number: d.vehicle, admin_comment: d.comment, reviewed_by: r.reviewed_by && r.status === "approved" ? r.reviewed_by : state.user.full_name, reviewed_at: r.reviewed_at && r.status === "approved" ? r.reviewed_at : new Date().toISOString() });
    await notify("request_approved", { request: upd, previous_driver_id: prev });
    toast(`Approved – ${drv.full_name} has been notified`); go("/");
  });
  document.getElementById("reject").addEventListener("click", async () => {
    const c = form.comment.value.trim();
    if (!c) { form.comment.classList.add("invalid"); form.querySelector('[data-err="comment"]').textContent = "Please write the reason"; form.comment.focus(); return; }
    if (!confirm(r.status === "pending" ? "Reject this request?" : "Cancel this trip?")) return;
    const now = new Date().toISOString(), prev = r.assigned_driver_id || null;
    const patch = r.status === "pending"
      ? { status: "rejected", admin_comment: c, reviewed_by: state.user.full_name, reviewed_at: now }
      : { status: "cancelled", cancel_reason: c, cancelled_by: state.user.full_name, cancelled_at: now };
    const upd = await db.update("trip_requests", id, patch);
    await notify(r.status === "pending" ? "request_rejected" : "request_cancelled", { request: upd, previous_driver_id: prev });
    toast(r.status === "pending" ? "Request rejected" : "Trip cancelled"); go("/");
  });
});

/* ================= home dispatcher ================= */
export const homes = { admin: adminHome, requester: requesterHome };
