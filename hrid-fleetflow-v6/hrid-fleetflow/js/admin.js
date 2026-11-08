// Admin: vehicles & problems, users, email log. Everyone: profile.
import { db } from "./store.js";
import { icon } from "./icons.js";
import { fmtDateTime, getInspectionWindow, weekKey } from "./schedule.js";
import { FLEET, fleetOptions, vehicleLabel, vehicleModel } from "./fleet.js";
import { state, route, go, shell, ROLE_LABEL, issueCard, issueOrder, session } from "./core.js";
import { esc, uid, norm, toast, modal, field, readForm, validate, badge } from "./ui.js";
import { hash, passwordRules, importUsersCSV } from "./auth.js";
import { issueView, inspectionView } from "./run.js";
import { langButton } from "./i18n.js";

/* ================= vehicles ================= */
let issueTab = "open";
route("/admin/vehicles", ["admin"], async () => {
  const [insp, users, issues, reqs] = await Promise.all([db.list("vehicle_inspections"), db.list("users"), db.list("vehicle_issues"), db.list("trip_requests")]);
  insp.sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
  const drivers = users.filter((u) => u.role === "driver" && u.active !== false);
  const thisWeek = insp.filter((i) => i.week_key === weekKey());
  const shown = issues.filter((i) => issueTab === "all" || i.status === issueTab).sort(issueOrder);
  const odo = (plate) => Math.max(0, ...reqs.filter((r) => r.assigned_vehicle_number === plate).map((r) => Number(r.odometer_end || r.odometer_start) || 0), ...insp.filter((i) => i.vehicle_number === plate).map((i) => Number(i.odometer_km) || 0));
  const inUse = (plate) => reqs.find((r) => r.status === "started" && r.assigned_vehicle_number === plate);
  await shell("Vehicles", `
    <div class="row between no-print"><span></span><a class="btn btn-danger btn-sm" href="#/report-issue">${icon("alert")} Report a vehicle problem</a></div>
    <div class="card" style="margin-top:12px"><h2>Fleet</h2><div class="table-wrap"><table><thead><tr><th>No.</th><th>Vehicle</th><th>Plate</th><th>Now</th><th class="num">Odometer</th><th>Checklist</th><th>Problems</th></tr></thead><tbody>
    ${FLEET.map((v) => {
      const ci = thisWeek.find((x) => x.vehicle_number === v.plate), op = issues.filter((x) => x.vehicle_number === v.plate && x.status === "open").sort(issueOrder), u = inUse(v.plate);
      return `<tr><td>${v.no}</td><td>${esc(v.model)}</td><td dir="ltr" style="text-align:inherit;white-space:nowrap">${esc(v.plate)}</td>
        <td>${op.some((x) => x.severity === "unsafe") ? badge("unsafe") : u ? `<a href="#/admin/trips/${u.id}">${badge("started")}</a>` : '<span class="badge b-ok">Available</span>'}</td>
        <td class="num">${odo(v.plate) ? odo(v.plate) + " km" : "-"}</td>
        <td>${ci ? `<a href="#/admin/vehicles/inspections/${ci.id}">${ci.has_defects ? '<span class="badge b-defect">Problems</span>' : '<span class="badge b-ok">Checked</span>'}</a>` : '<span class="badge b-na">Not checked</span>'}</td>
        <td>${op.length ? `${badge(op[0].severity)} ${op.length}` : "-"}</td></tr>`;
    }).join("")}</tbody></table></div></div>
    <div class="section-title"><h2>Vehicle problems</h2></div>
    <div class="tabs" role="tablist">${[["open", "Open"], ["resolved", "Resolved"], ["all", "All"]].map(([k, l]) => `<button role="tab" type="button" data-itab="${k}" aria-selected="${issueTab === k}">${l} (${k === "all" ? issues.length : issues.filter((i) => i.status === k).length})</button>`).join("")}</div>
    ${shown.length ? shown.map((i) => issueCard(i, `#/admin/vehicles/issues/${i.id}`)).join("") : `<div class="card empty">No vehicle problems.</div>`}
    <div class="card" style="margin-top:14px"><h2>Weekly checklists (from ${esc(fmtDateTime(getInspectionWindow().start))})</h2><div class="table-wrap"><table><thead><tr><th>Driver</th><th>Status</th><th>Vehicle</th><th>Sent</th></tr></thead><tbody>
    ${drivers.map((u) => { const i = thisWeek.find((x) => x.driver_id === u.id); return `<tr><td>${esc(u.full_name)}</td><td>${i ? (i.has_defects ? '<span class="badge b-defect">Problems</span>' : '<span class="badge b-ok">Done</span>') : '<span class="badge b-overdue">Not done</span>'}</td><td>${i ? esc(vehicleLabel(i.vehicle_number)) : "-"}</td><td>${i ? `<a href="#/admin/vehicles/inspections/${i.id}">${esc(fmtDateTime(i.submitted_at))}</a>` : "-"}</td></tr>`; }).join("") || '<tr><td colspan="4" class="muted">No drivers</td></tr>'}
    </tbody></table></div></div>`);
  document.querySelectorAll("[data-itab]").forEach((b) => b.addEventListener("click", () => { issueTab = b.dataset.itab; go("/admin/vehicles"); }));
});
route("/admin/vehicles/inspections/:id", ["admin"], async ({ id }) => {
  const i = await db.get("vehicle_inspections", id);
  if (!i) return go("/admin/vehicles");
  await shell("Checklist", `<div class="row no-print"><a class="btn btn-outline btn-sm" href="#/admin/vehicles">← Back</a><button class="btn btn-outline btn-sm" type="button" onclick="window.print()">${icon("printer")} Print / PDF</button></div>${inspectionView(i)}`);
});
route("/admin/vehicles/issues/:id", ["admin"], async ({ id }) => {
  const i = await db.get("vehicle_issues", id);
  if (!i) return go("/admin/vehicles");
  await shell("Vehicle problem", `<a class="btn btn-outline btn-sm" href="#/admin/vehicles">← Back</a><div style="margin-top:12px">${issueView(i)}</div>
    ${i.status === "open" ? `<form id="res" class="card stack" novalidate><h2 style="margin:0">Mark as fixed</h2>
      ${field("resolution_note", "What was done?", { type: "textarea", required: true })}
      <button class="btn btn-primary btn-block" type="submit">${icon("check")} Mark as fixed</button></form>`
    : `<button class="btn btn-outline btn-block" id="reopen" type="button" style="margin-top:14px">Reopen problem</button>`}`);
  document.getElementById("res")?.addEventListener("submit", async (e) => {
    e.preventDefault(); const f = e.target; if (!validate(f)) return;
    await db.update("vehicle_issues", id, { status: "resolved", resolution_note: readForm(f).resolution_note, resolved_by: state.user.full_name, resolved_at: new Date().toISOString() });
    toast("Problem marked as fixed"); go("/admin/vehicles");
  });
  document.getElementById("reopen")?.addEventListener("click", async () => { await db.update("vehicle_issues", id, { status: "open", resolved_at: null, resolved_by: null }); toast("Problem reopened"); go(`/admin/vehicles/issues/${id}`); });
});

/* ================= users ================= */
route("/admin/users", ["admin"], async () => {
  const users = (await db.list("users")).sort((a, b) => a.role.localeCompare(b.role) || a.full_name.localeCompare(b.full_name));
  await shell("Users", `
    <div class="grid three no-print">
      <button class="btn btn-primary" type="button" id="addu">${icon("plus")} Add user</button>
      <label class="btn btn-blue" for="imp">${icon("users")} Import CSV</label><input id="imp" type="file" accept=".csv,text/csv" hidden />
      <a class="btn btn-outline" href="#/admin/emails">${icon("send")} Email log</a>
    </div>
    <div class="field" style="margin-top:14px"><label for="uq">Search</label><input class="input" id="uq" type="search" placeholder="Name, number, email, role…" /></div>
    <p class="small muted" style="margin-top:8px" id="ucount"></p>
    <div class="card" style="margin-top:8px;padding:8px 12px"><div class="table-wrap"><table><thead><tr><th>Name</th><th>No.</th><th>Role</th><th>Email</th><th></th></tr></thead><tbody id="ubody"></tbody></table></div></div>`);
  const open = (u) => modal(`<form class="stack" novalidate><h2>${u ? "Edit user" : "Add user"}</h2>
      ${field("full_name", "Full name", { required: true, value: u?.full_name || "" })}
      ${field("role", "Role", { required: true, value: u?.role || "requester", options: [["requester", "Employee"], ["driver", "Driver"], ["admin", "Administrator"]] })}
      <div class="grid two">${field("employee_no", "Employee number", { required: true, value: u?.employee_no || "" })}${field("email", "Email", { type: "email", value: u?.email || "" })}</div>
      <div class="grid two">${field("department", "Department", { value: u?.department || "" })}${field("default_vehicle", "Usual vehicle (drivers)", { value: u?.default_vehicle || "", options: fleetOptions() })}</div>
      ${field("password", u ? "New temporary password (optional)" : "Temporary password (e.g. birthday DDMMYYYY)", { type: "password", required: !u, attrs: 'autocomplete="new-password"' })}
      ${u && u.id !== state.user.id ? `<label class="check"><input type="checkbox" name="active" ${u.active !== false ? "checked" : ""} /><span>Account active</span></label>` : ""}
      <div class="grid two"><button class="btn btn-outline" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">Save</button></div></form>`, (bg, close) => {
    const f = bg.querySelector("form");
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const all = await db.list("users");
      if (!validate(f, (d) => {
        const er = {};
        if (all.some((x) => String(x.employee_no) === d.employee_no && x.id !== u?.id)) er.employee_no = "This employee number already exists";
        if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) er.email = "Enter a valid email";
        else if (d.email && all.some((x) => norm(x.email) === norm(d.email) && x.id !== u?.id)) er.email = "This email is already used";
        if (d.password && d.password.length < 6) er.password = "At least 6 characters";
        if (u?.id === state.user.id && d.role !== "admin") er.role = "You cannot remove your own administrator role";
        return er;
      })) return;
      const d = readForm(f);
      const rec = { full_name: d.full_name.replace(/\s+/g, " "), username: norm(d.full_name), role: d.role, employee_no: d.employee_no, email: d.email.toLowerCase(), department: d.department, default_vehicle: d.default_vehicle, vehicle_type: vehicleModel(d.default_vehicle) };
      if (u && u.id !== state.user.id) rec.active = f.active.checked;
      if (d.password) { rec.salt = uid(); rec.password_hash = await hash(d.password, rec.salt); rec.must_change_password = true; }
      if (u) await db.update("users", u.id, rec); else await db.insert("users", { id: uid(), ...rec, active: true, created_at: new Date().toISOString() });
      close(); toast("User saved"); go("/admin/users");
    });
  });
  const draw = (q = "") => {
    const n = norm(q);
    const f = users.filter((u) => !n || norm([u.full_name, u.employee_no, u.email, ROLE_LABEL[u.role], u.department].join(" ")).includes(n));
    document.getElementById("ucount").textContent = `${f.length} of ${users.length} users · ${users.filter((u) => u.role === "admin").length} admins · ${users.filter((u) => u.role === "driver").length} drivers`;
    document.getElementById("ubody").innerHTML = f.map((u) => `<tr><td>${esc(u.full_name)}${u.active === false ? ' <span class="badge b-cancelled">Disabled</span>' : ""}${u.must_change_password ? '<div class="small muted">Has not signed in yet</div>' : ""}</td><td>${esc(u.employee_no || "-")}</td><td>${esc(ROLE_LABEL[u.role])}</td><td class="small" style="word-break:break-all">${esc(u.email || "-")}</td><td><button class="btn btn-outline btn-sm" type="button" data-edit="${u.id}">Edit</button></td></tr>`).join("") || '<tr><td colspan="5" class="muted">No users found</td></tr>';
    document.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => open(users.find((u) => u.id === b.dataset.edit))));
  };
  document.getElementById("addu").addEventListener("click", () => open(null));
  document.getElementById("uq").addEventListener("input", (e) => draw(e.target.value));
  document.getElementById("imp").addEventListener("change", (e) => importUsersCSV(e.target.files[0], () => go("/admin/users")));
  draw();
});

/* ================= email log ================= */
route("/admin/emails", ["admin"], async () => {
  const jobs = (await db.list("email_outbox")).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 100);
  const label = { request_created: "New request", request_approved: "Approved / assigned", request_rejected: "Rejected", request_cancelled: "Cancelled", trip_started: "Trip started", vehicle_issue: "Vehicle problem", delivery_done: "Delivery – please sign", delivery_signed: "Delivery confirmed" };
  await shell("Email log", `<a class="btn btn-outline btn-sm" href="#/admin/users">← Back</a>
    <div style="margin-top:12px">${jobs.length ? jobs.map((j) => `<div class="card"><div class="row between"><b>${esc(label[j.event] || j.event)}</b><span class="badge ${j.status === "sent" ? "b-ok" : j.status === "failed" ? "b-defect" : "b-pending"}">${esc(j.status)}</span></div>
      <div class="small muted">${esc(fmtDateTime(j.created_at))}${j.error ? " · " + esc(j.error) : ""}</div>
      ${(j.preview || []).map((m, i) => `<details style="margin-top:8px"><summary class="small" style="cursor:pointer"><b>To:</b> ${esc(m.to)} – ${esc(m.subject)}</summary><div style="margin-top:8px;border:1px solid var(--border);border-radius:8px;overflow:hidden" data-mail="${esc(j.id)}:${i}"></div></details>`).join("") || '<p class="small muted">No recipients with an email address.</p>'}</div>`).join("") : '<div class="card empty">No emails yet.</div>'}</div>`);
  document.querySelectorAll("[data-mail]").forEach((el) => {
    const [jid, i] = el.dataset.mail.split(":");
    const m = jobs.find((j) => j.id === jid).preview[+i];
    const f = document.createElement("iframe");
    f.setAttribute("sandbox", ""); f.title = m.subject; f.style.cssText = "width:100%;height:560px;border:0;background:#F5F7FA"; f.srcdoc = m.html;
    el.appendChild(f);
  });
});

/* ================= profile ================= */
route("/profile", null, async () => {
  const u = state.user;
  await shell("Profile", `
    <div class="card"><dl class="kv"><dt>Name</dt><dd>${esc(u.full_name)}</dd><dt>Role</dt><dd>${esc(ROLE_LABEL[u.role])}</dd><dt>Employee number</dt><dd>${esc(u.employee_no || "-")}</dd><dt>Email</dt><dd>${esc(u.email || "-")}</dd><dt>Department</dt><dd>${esc(u.department || "-")}</dd>${u.default_vehicle ? `<dt>Vehicle</dt><dd>${esc(vehicleLabel(u.default_vehicle))}</dd>` : ""}</dl></div>
    <div class="card row between"><div><b>Language</b><div class="small muted">English / کوردی</div></div>${langButton("btn btn-outline")}</div>
    <form id="pw" class="card stack" novalidate><h2 style="margin:0">Change password</h2>
      ${field("current", "Current password", { type: "password", required: true, attrs: 'autocomplete="current-password"' })}
      ${field("password", "New password", { type: "password", required: true, attrs: 'autocomplete="new-password"' })}
      ${field("password2", "Confirm new password", { type: "password", required: true, attrs: 'autocomplete="new-password"' })}
      <button class="btn btn-blue" type="submit">Update password</button></form>
    <button class="btn btn-danger btn-block" type="button" id="logout" style="margin-top:14px">${icon("logout")} Sign out</button>`);
  document.getElementById("logout").addEventListener("click", () => { session.clear(); go("/"); });
  document.getElementById("pw").addEventListener("submit", async (e) => {
    e.preventDefault(); const f = e.target;
    if (!validate(f, passwordRules)) return;
    if ((await hash(f.current.value, u.salt)) !== u.password_hash) { f.current.classList.add("invalid"); f.querySelector('[data-err="current"]').textContent = "Current password is incorrect"; return; }
    const salt = uid(); await db.update("users", u.id, { salt, password_hash: await hash(f.password.value, salt) });
    f.reset(); toast("Password updated");
  });
});
