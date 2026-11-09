// Monthly reports: key figures compared with the previous month, charts and tables per topic, raw data export.
import { db } from "./store.js";
import { icon } from "./icons.js";
import { FLEET, vehicleModel } from "./fleet.js";
import { CHECKLIST } from "./checklist.js";
import { fmtDate, fmtMonth, todayISO, localISODate, fmtTime, hoursBetween, daysInMonth, prevMonth, weeksDueIn } from "./schedule.js";
import { route, go, query, shell, isItems, stopsOf, routePoints, printHeader, DONE } from "./core.js";
import { esc, toast, badge, statusLabel, downloadCSV, itemsCount, mapUrl } from "./ui.js";
import { columnChart, barChart, donutChart, PALETTE } from "./charts.js";

const r1 = (n) => Math.round(n * 10) / 10;
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const sum = (list, f) => list.reduce((s, x) => s + (Number(f(x)) || 0), 0);
const avg = (list) => (list.length ? list.reduce((s, x) => s + x, 0) / list.length : null);
const at = (iso) => (iso ? `${localISODate(iso)} ${fmtTime(iso)}` : "");
const plateLabel = (v) => `\u2066${v.plate}\u2069 · ${v.model}`;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SEV = { minor: "Minor", major: "Major", unsafe: "Unsafe" };
const duration = (r) => { const h = hoursBetween(r.started_at, r.finished_at); return h != null && h >= 0 ? h : null; };

/** All figures for one month. */
function compute(month, all) {
  const { reqs: allReqs, insp: allInsp, issues: allIssues, users } = all;
  const reqs = allReqs.filter((r) => String(r.trip_date || "").startsWith(month));
  const done = reqs.filter((r) => DONE.includes(r.status));
  const pax = done.filter((r) => !isItems(r)), itm = done.filter(isItems);
  const reviewed = reqs.filter((r) => r.reviewed_at && !r.direct_approval);
  const cps = done.flatMap((r) => (r.checkpoints || []).filter((c) => c?.at));
  const weeks = weeksDueIn(month);
  const drivers = users.filter((u) => u.role === "driver" && u.active !== false);
  const insp = allInsp.filter((i) => weeks.includes(i.week_key));
  const chkDone = new Set(insp.map((i) => `${i.driver_id}|${i.week_key}`)).size;
  const issues = allIssues.filter((i) => localISODate(i.reported_at).startsWith(month));
  const resolved = issues.filter((i) => i.resolved_at);
  return {
    month, reqs, done, pax, itm, weeks, drivers, insp, issues,
    trips: done.length, passengers: sum(pax, (r) => r.passengers?.length), deliveries: itm.length, items: sum(itm, (r) => itemsCount(r.items)),
    km: sum(done, (r) => r.distance_km), hours: r1(sum(done, (r) => duration(r))), avgTrip: avg(done.map(duration).filter((h) => h != null)),
    requests: reqs.length, rejected: reqs.filter((r) => r.status === "rejected").length, cancelled: reqs.filter((r) => r.status === "cancelled").length,
    guests: reqs.filter((r) => r.for_guest).length,
    approvalH: avg(reviewed.map((r) => hoursBetween(r.created_at, r.reviewed_at)).filter((h) => h != null && h >= 0)),
    gpsPct: cps.length ? pct(cps.filter((c) => c.gps).length, cps.length) : null,
    chkDone, chkDue: weeks.length * drivers.length, chkPct: weeks.length * drivers.length ? pct(chkDone, weeks.length * drivers.length) : null,
    problems: issues.length, unsafe: issues.filter((i) => i.severity === "unsafe").length, resolved: resolved.length,
    resolveH: avg(resolved.map((i) => hoursBetween(i.reported_at, i.resolved_at)).filter((h) => h != null && h >= 0)),
  };
}

function kpi(label, cur, prev, { unit = "", better = "up", dec = 0 } = {}) {
  const show = (v) => (v == null ? "-" : `${dec ? r1(v) : Math.round(v)}${unit}`);
  let d = "";
  if (cur != null && prev != null) {
    const diff = cur - prev;
    const cls = Math.abs(diff) < 0.05 ? "same" : (diff > 0) === (better === "up") ? "up" : "down";
    d = `<div class="d ${cls}">${diff > 0 ? "▲" : diff < 0 ? "▼" : "="} ${dec ? r1(Math.abs(diff)) : Math.round(Math.abs(diff))}${unit} vs last month</div>`;
  } else if (prev == null && cur != null) d = `<div class="d same">No data last month</div>`;
  return `<div class="kpi"><div class="v">${show(cur)}</div><div class="l">${esc(label)}</div>${d}</div>`;
}
const table = (head, rows, foot = null) => `<div class="table-wrap"><table class="report-table"><thead><tr>${head.map((h) => `<th class="${/^(Trips|Km|Hours|Passengers|Deliveries|Items|Requests|Done|Rejected|Cancelled|Problems|Open|Days used|Use %|Checklists|Odometer|Duration|Approval)/.test(h) ? "num" : ""}">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody>${foot ? `<tfoot><tr>${foot.map((c, i) => `<td class="${i ? "num" : ""}">${c}</td>`).join("")}</tr></tfoot>` : ""}</table></div>`;
const td = (v, num = false) => `<td class="${num ? "num" : ""}">${v}</td>`;

let tab = "overview";
route("/admin/reports", ["admin"], async () => {
  const month = /^\d{4}-\d{2}$/.test(query().get("m") || "") ? query().get("m") : todayISO().slice(0, 7);
  const [reqs, insp, issues, users] = await Promise.all([db.list("trip_requests"), db.list("vehicle_inspections"), db.list("vehicle_issues"), db.list("users")]);
  const all = { reqs, insp, issues, users };
  const c = compute(month, all), p = compute(prevMonth(month), all);
  const { done } = c;

  // ---------- per vehicle ----------
  const today = todayISO();
  const elapsed = month < today.slice(0, 7) ? daysInMonth(month) : month === today.slice(0, 7) ? Number(today.slice(8)) : 0;
  const vrows = FLEET.map((v) => {
    const t = done.filter((r) => r.assigned_vehicle_number === v.plate);
    const days = new Set(t.map((r) => r.trip_date)).size;
    const vi = c.issues.filter((i) => i.vehicle_number === v.plate);
    const open = issues.filter((i) => i.vehicle_number === v.plate && i.status === "open");
    const odo = Math.max(0, ...reqs.filter((r) => r.assigned_vehicle_number === v.plate && r.trip_date <= `${month}-31`).map((r) => Number(r.odometer_end) || 0), ...insp.filter((i) => i.vehicle_number === v.plate && i.week_key <= `${month}-31`).map((i) => Number(i.odometer_km) || 0));
    return { v, trips: t.length, km: sum(t, (r) => r.distance_km), hours: r1(sum(t, duration)), days, use: pct(days, elapsed), checks: c.insp.filter((i) => i.vehicle_number === v.plate).length, problems: vi.length, open: open.length, unsafe: open.some((i) => i.severity === "unsafe"), odo };
  });
  // ---------- per driver ----------
  const dnames = [...new Map([...c.drivers.map((d) => [d.id, d.full_name]), ...done.map((r) => [r.assigned_driver_id, r.assigned_driver_name])]).entries()];
  const drows = dnames.map(([id, name]) => {
    const t = done.filter((r) => r.assigned_driver_id === id);
    return { name, trips: t.length, pax: sum(t.filter((r) => !isItems(r)), (r) => r.passengers?.length), deliveries: t.filter(isItems).length, km: sum(t, (r) => r.distance_km), hours: r1(sum(t, duration)),
      checks: new Set(c.insp.filter((i) => i.driver_id === id).map((i) => i.week_key)).size, problems: c.issues.filter((i) => i.reported_by_id === id).length };
  }).sort((a, b) => b.trips - a.trips);
  // ---------- per department ----------
  const depts = [...new Set(c.reqs.map((r) => r.department || "-"))];
  const deprows = depts.map((d) => {
    const rq = c.reqs.filter((r) => (r.department || "-") === d), dn = rq.filter((r) => DONE.includes(r.status));
    return { d, requests: rq.length, done: dn.length, rejected: rq.filter((r) => r.status === "rejected").length, cancelled: rq.filter((r) => r.status === "cancelled").length, pax: sum(dn.filter((r) => !isItems(r)), (r) => r.passengers?.length), deliveries: dn.filter(isItems).length, km: sum(dn, (r) => r.distance_km) };
  }).sort((a, b) => b.requests - a.requests);
  // ---------- destinations ----------
  const destCount = {};
  done.forEach((r) => stopsOf(r).forEach((s) => { const k = s.trim(); destCount[k] = (destCount[k] || 0) + 1; }));
  const topDest = Object.entries(destCount).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, value]) => ({ label, value }));

  const days = daysInMonth(month);
  const perDay = [...Array(days).keys()].map((i) => { const d = `${month}-${String(i + 1).padStart(2, "0")}`; return { label: String(i + 1), value: done.filter((r) => r.trip_date === d).length }; });
  const perWeekday = WEEKDAYS.map((w, i) => ({ label: w, value: done.filter((r) => new Date(r.trip_date + "T00:00:00Z").getUTCDay() === i).length }));
  const perHour = [...Array(24).keys()].filter((h) => h >= 5 && h <= 22).map((h) => ({ label: String(h).padStart(2, "0"), value: done.filter((r) => Number((r.departure_time || "").slice(0, 2)) === h).length }));
  const statusColors = { completed: PALETTE[1], delivered: "#805AD5", started: PALETTE[4], approved: PALETTE[0], pending: "#D69E2E", rejected: PALETTE[3], cancelled: PALETTE[8] };
  const byStatus = Object.keys(statusColors).map((s) => ({ label: statusLabel(s), value: c.reqs.filter((r) => r.status === s).length, color: statusColors[s] }));
  const cats = [...new Set(c.issues.map((i) => i.category || i.title))];

  const TABS = [["overview", "Overview"], ["trips", "Trips"], ["vehicles", "Vehicles"], ["drivers", "Drivers"], ["departments", "Departments"], ["problems", "Problems"], ["export", "Export"]];
  const panel = (k, html) => `<section data-panel="${k}" ${tab === k ? "" : "hidden"}>${html}</section>`;

  await shell("Reports", `
    <div class="card no-print"><div class="row between" style="align-items:flex-end">
      <div class="field" style="min-width:200px"><label for="month">Month</label><input class="input" type="month" id="month" value="${month}" max="${today.slice(0, 7)}" /></div>
      <button class="btn btn-outline" type="button" onclick="window.print()">${icon("printer")} Print / Save as PDF</button></div></div>
    ${printHeader("Fleet monthly report")}
    <h2 style="margin:16px 0 10px;font-size:21px">${esc(fmtMonth(month))}</h2>
    <div class="report-tabs no-print"><div class="tabs" role="tablist" style="margin:0">${TABS.map(([k, l]) => `<button role="tab" type="button" data-rtab="${k}" aria-selected="${tab === k}">${l}</button>`).join("")}</div></div>

    ${panel("overview", `
      <div class="kpis">
        ${kpi("Trips done", c.trips, p.trips)}${kpi("Passengers carried", c.passengers, p.passengers)}${kpi("Deliveries", c.deliveries, p.deliveries)}${kpi("Km driven", c.km, p.km, { unit: " km" })}
        ${kpi("Driving hours", c.hours, p.hours, { dec: 1 })}${kpi("Average trip (hours)", c.avgTrip, p.avgTrip, { dec: 1, better: "down" })}${kpi("Requests", c.requests, p.requests)}${kpi("Guest requests", c.guests, p.guests)}
        ${kpi("Average approval time (hours)", c.approvalH, p.approvalH, { dec: 1, better: "down" })}${kpi("Locations with GPS", c.gpsPct, p.gpsPct, { unit: "%" })}${kpi("Weekly checklists done", c.chkPct, p.chkPct, { unit: "%" })}${kpi("Vehicle problems", c.problems, p.problems, { better: "down" })}
        ${kpi("Problems fixed", c.resolved, p.resolved)}${kpi("Rejected requests", c.rejected, p.rejected, { better: "down" })}${kpi("Cancelled", c.cancelled, p.cancelled, { better: "down" })}${kpi("Items delivered", c.items, p.items)}
      </div>
      <div class="card" style="margin-top:14px"><h2>Trips per day</h2>${columnChart(perDay, { title: "Trips per day" })}</div>
      <div class="grid two" style="margin-top:14px">
        <div class="card"><h2>Requests by status</h2>${donutChart(byStatus, { title: "Requests by status" })}</div>
        <div class="card"><h2>People or items</h2>${donutChart([{ label: "Passengers", value: c.pax.length, color: PALETTE[0] }, { label: "Documents & items", value: c.itm.length, color: PALETTE[2] }], { title: "People or items" })}</div>
        <div class="card"><h2>Trips by weekday</h2>${columnChart(perWeekday, { title: "Trips by weekday", color: PALETTE[4] })}</div>
        <div class="card"><h2>Trips by departure hour</h2>${columnChart(perHour, { title: "Trips by departure hour", color: PALETTE[5] })}</div>
      </div>`)}

    ${panel("trips", `
      <div class="grid two"><div class="card"><h2>Top destinations</h2>${barChart(topDest, { title: "Top destinations", color: PALETTE[4] })}</div>
      <div class="card"><h2>Requests by department</h2>${barChart(deprows.map((x) => ({ label: x.d, value: x.requests })), { title: "Requests by department", color: PALETTE[2] })}</div></div>
      <div class="card" style="margin-top:14px"><h2>All trips done (${done.length})</h2>${done.length ? table(["Date", "Ref.", "Requested by", "Driver / vehicle", "Route, times & locations", "Duration", "Km"],
        done.sort((a, b) => (a.trip_date + a.departure_time).localeCompare(b.trip_date + b.departure_time)).map((r) => `<tr>${td(`${esc(fmtDate(r.trip_date))}<div class="small muted">${esc(r.departure_time)}</div>`)}${td(`<a href="#/admin/trips/${r.id}">${esc(r.reference)}</a>${isItems(r) ? `<div class="small muted">${itemsCount(r.items)} item(s)</div>` : `<div class="small muted">${r.passengers?.length || 0} passenger(s)</div>`}`)}${td(`${esc(r.requester_name)}<div class="small muted">${esc(r.department || "")}</div>`)}${td(`${esc(r.assigned_driver_name || "-")}<div class="small muted" dir="ltr" style="text-align:inherit">${esc(r.assigned_vehicle_number || "")}</div>`)}
          ${td(routePoints(r).map((pt) => `<div class="small"><span data-no-tr>${esc(pt.name)}</span> – ${pt.cp?.at ? esc(fmtTime(pt.cp.at)) : "-"} ${pt.cp?.gps ? `<a href="${mapUrl(pt.cp.gps)}" target="_blank" rel="noopener">${icon("pin")}</a>` : pt.cp?.at ? '<span class="badge b-late">No location</span>' : ""}</div>`).join(""))}
          ${td(duration(r) != null ? `${r1(duration(r))} h` : "-", true)}${td(r.distance_km ?? "-", true)}</tr>`),
        ["Total", "", "", "", "", `${c.hours} h`, `${c.km}`]) : `<p class="muted">No trips done this month.</p>`}</div>`)}

    ${panel("vehicles", `
      <div class="grid two"><div class="card"><h2>Km per vehicle</h2>${barChart(vrows.map((x) => ({ label: plateLabel(x.v), value: x.km })), { title: "Km per vehicle", unit: " km" })}</div>
      <div class="card"><h2>How much each vehicle was used (% of days)</h2>${barChart(vrows.map((x) => ({ label: plateLabel(x.v), value: x.use, color: x.use > 80 ? PALETTE[3] : PALETTE[1] })), { title: "Vehicle use", unit: "%", max: 100 })}</div></div>
      <div class="card" style="margin-top:14px"><h2>Vehicle summary</h2>${table(["No.", "Vehicle", "Plate", "Trips", "Km", "Hours", "Days used", "Use %", "Checklists", "Problems", "Open now", "Odometer"],
        vrows.map((x) => `<tr>${td(x.v.no)}${td(esc(x.v.model))}<td dir="ltr" style="text-align:inherit;white-space:nowrap">${esc(x.v.plate)}</td>${td(x.trips, true)}${td(x.km, true)}${td(x.hours, true)}${td(x.days, true)}${td(x.use + "%", true)}${td(`${x.checks}/${c.weeks.length}`, true)}${td(x.problems, true)}${td(x.open ? `${x.unsafe ? badge("unsafe") : ""} ${x.open}` : "0", true)}${td(x.odo ? x.odo + " km" : "-", true)}</tr>`),
        ["Total", "", "", sum(vrows, (x) => x.trips), sum(vrows, (x) => x.km), r1(sum(vrows, (x) => x.hours)), "", "", sum(vrows, (x) => x.checks), sum(vrows, (x) => x.problems), sum(vrows, (x) => x.open), ""])}</div>`)}

    ${panel("drivers", `
      <div class="grid two"><div class="card"><h2>Trips per driver</h2>${barChart(drows.map((x) => ({ label: x.name, value: x.trips })), { title: "Trips per driver", color: PALETTE[1] })}</div>
      <div class="card"><h2>Driving hours per driver</h2>${barChart(drows.map((x) => ({ label: x.name, value: x.hours })), { title: "Driving hours per driver", unit: " h", color: PALETTE[4] })}</div></div>
      <div class="card" style="margin-top:14px"><h2>Driver summary</h2>${table(["Driver", "Trips", "Passengers", "Deliveries", "Km", "Hours", "Checklists", "Problems reported"],
        drows.map((x) => `<tr>${td(esc(x.name))}${td(x.trips, true)}${td(x.pax, true)}${td(x.deliveries, true)}${td(x.km, true)}${td(x.hours, true)}${td(`${x.checks}/${c.weeks.length}`, true)}${td(x.problems, true)}</tr>`))}</div>`)}

    ${panel("departments", `
      <div class="card"><h2>Requests by department</h2>${barChart(deprows.map((x) => ({ label: x.d, value: x.requests })), { title: "Requests by department", color: PALETTE[2] })}</div>
      <div class="card"><h2>Department summary</h2>${deprows.length ? table(["Department", "Requests", "Done", "Rejected", "Cancelled", "Passengers", "Deliveries", "Km"],
        deprows.map((x) => `<tr>${td(esc(x.d))}${td(x.requests, true)}${td(x.done, true)}${td(x.rejected, true)}${td(x.cancelled, true)}${td(x.pax, true)}${td(x.deliveries, true)}${td(x.km, true)}</tr>`),
        ["Total", sum(deprows, (x) => x.requests), sum(deprows, (x) => x.done), sum(deprows, (x) => x.rejected), sum(deprows, (x) => x.cancelled), sum(deprows, (x) => x.pax), sum(deprows, (x) => x.deliveries), sum(deprows, (x) => x.km)]) : `<p class="muted">No requests this month.</p>`}</div>`)}

    ${panel("problems", `
      <div class="kpis">${kpi("Reported", c.problems, p.problems, { better: "down" })}${kpi("Unsafe", c.unsafe, p.unsafe, { better: "down" })}${kpi("Fixed", c.resolved, p.resolved)}${kpi("Average time to fix (hours)", c.resolveH, p.resolveH, { dec: 1, better: "down" })}</div>
      <div class="grid two" style="margin-top:14px">
        <div class="card"><h2>Problems by type</h2>${barChart(cats.map((k) => ({ label: k, value: c.issues.filter((i) => (i.category || i.title) === k).length })), { title: "Problems by type", color: PALETTE[3], emptyText: "No vehicle problems this month." })}</div>
        <div class="card"><h2>How serious</h2>${donutChart([{ label: "Minor", value: c.issues.filter((i) => i.severity === "minor").length, color: PALETTE[1] }, { label: "Major", value: c.issues.filter((i) => i.severity === "major").length, color: PALETTE[2] }, { label: "Unsafe", value: c.unsafe, color: PALETTE[3] }], { title: "How serious", emptyText: "No vehicle problems this month." })}</div>
      </div>
      <div class="card" style="margin-top:14px"><h2>Problems per vehicle</h2>${barChart(vrows.map((x) => ({ label: plateLabel(x.v), value: x.problems, color: PALETTE[3] })), { title: "Problems per vehicle", emptyText: "No vehicle problems this month." })}</div>
      <div class="card"><h2>All problems</h2>${c.issues.length ? table(["Date", "Vehicle", "Problem", "How serious", "Reported by", "Status", "Time to fix"],
        c.issues.sort((a, b) => a.reported_at.localeCompare(b.reported_at)).map((i) => `<tr>${td(esc(fmtDate(localISODate(i.reported_at))))}<td dir="ltr" style="text-align:inherit;white-space:nowrap">${esc(i.vehicle_number)}</td>${td(`<a href="#/admin/vehicles/issues/${i.id}">${esc(i.title)}</a>${i.description ? `<div class="small muted">${esc(i.description)}</div>` : ""}`)}${td(badge(i.severity))}${td(esc(i.reported_by_name))}${td(badge(i.status))}${td(i.resolved_at ? `${r1(hoursBetween(i.reported_at, i.resolved_at))} h` : "-", true)}</tr>`)) : `<p class="muted">No vehicle problems this month.</p>`}</div>`)}

    ${panel("export", `<div class="card"><h2>Raw data (CSV for Excel)</h2>
      <p class="small muted" style="margin-bottom:12px">${esc(fmtMonth(month))} – opens in Excel, Kurdish text included.</p>
      <button class="btn btn-blue btn-block" type="button" data-x="all" style="margin-bottom:12px">${icon("download")} Download everything (10 files)</button>
      <div class="export-grid">${[["trips", "Trips"], ["locations", "Locations & times"], ["passengers", "Passengers & signatures"], ["items", "Documents & items"], ["requests", "All requests"], ["vehicles", "Vehicle summary"], ["drivers", "Driver summary"], ["departments", "Department summary"], ["problems", "Vehicle problems"], ["checklists", "Weekly checklists"]].map(([k, l]) => `<button class="btn btn-outline" type="button" data-x="${k}">${icon("download")} ${l}</button>`).join("")}</div></div>`)}
  `);

  document.getElementById("month").addEventListener("change", (e) => { if (/^\d{4}-\d{2}$/.test(e.target.value)) go(`/admin/reports?m=${e.target.value}`); });
  document.querySelectorAll("[data-rtab]").forEach((b) => b.addEventListener("click", () => {
    tab = b.dataset.rtab;
    document.querySelectorAll("[data-rtab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    document.querySelectorAll("[data-panel]").forEach((s) => (s.hidden = s.dataset.panel !== tab));
  }));

  const G = (g) => (g ? [g.lat, g.lng, g.acc ?? "", mapUrl(g)] : ["", "", "", ""]);
  const X = {
    trips: () => [["Reference", "Date", "Planned departure", "Actual departure", "Final arrival", "Finished", "Duration h", "Type", "Status", "Requested by", "Department", "Guest", "Driver", "Vehicle", "Plate", "From", "Destinations", "Passengers", "Items", "Odometer start", "Odometer end", "Km", "Purpose"],
      done.map((r) => { const pts = routePoints(r), lastArr = [...pts].reverse().find((x) => x.kind === "arrival");
        return [r.reference, r.trip_date, r.departure_time, at(r.checkpoints?.[0]?.at), at(lastArr?.cp?.at), at(r.finished_at), duration(r) != null ? r1(duration(r)) : "", isItems(r) ? "Documents & items" : "Passengers", statusLabel(r.status), r.requester_name, r.department, r.for_guest ? r.guest_organization : "", r.assigned_driver_name, vehicleModel(r.assigned_vehicle_number), r.assigned_vehicle_number, r.origin, stopsOf(r).join(" | "), isItems(r) ? 0 : r.passengers?.length || 0, isItems(r) ? itemsCount(r.items) : 0, r.odometer_start, r.odometer_end, r.distance_km, r.purpose]; })],
    locations: () => [["Reference", "Date", "Driver", "Plate", "Stop no.", "Type", "Location", "Time", "Latitude", "Longitude", "Accuracy m", "Map"],
      done.flatMap((r) => routePoints(r).map((pt, i) => [r.reference, r.trip_date, r.assigned_driver_name, r.assigned_vehicle_number, i, { departure: "Departure", arrival: "Arrival", return: "Return" }[pt.kind], pt.name, at(pt.cp?.at), ...G(pt.cp?.gps)]))],
    passengers: () => [["Reference", "Date", "Driver", "Plate", "Passenger", "Type", "Employee No.", "Organisation", "Signed at", "Latitude", "Longitude", "Accuracy m", "Map"],
      c.pax.flatMap((r) => (r.passengers || []).map((x) => [r.reference, r.trip_date, r.assigned_driver_name, r.assigned_vehicle_number, x.name, x.type === "hrid" ? "HRID" : "Non-HRID", x.employee_no, x.organization, at(x.signed_at), ...G(x.signed_gps)]))],
    items: () => [["Reference", "Date", "Requested by", "Driver", "Plate", "Item", "Quantity", "Receiver", "Handed over to", "Delivered at", "Requester signed at"],
      c.itm.flatMap((r) => (r.items || []).map((i) => [r.reference, r.trip_date, r.requester_name, r.assigned_driver_name, r.assigned_vehicle_number, i.description, i.quantity, r.recipient_name, r.received_by, at(r.delivered_at || r.finished_at), at(r.requester_signed_at)]))],
    requests: () => [["Reference", "Created", "Trip date", "Time", "Type", "Status", "Requested by", "Department", "Guest organisation", "Entered by", "Reviewed by", "Reviewed at", "Approval hours", "Comment", "Cancel reason"],
      c.reqs.map((r) => [r.reference, at(r.created_at), r.trip_date, r.departure_time, isItems(r) ? "Documents & items" : "Passengers", statusLabel(r.status), r.requester_name, r.department, r.guest_organization || "", r.created_by_name, r.reviewed_by || "", at(r.reviewed_at), r.reviewed_at && !r.direct_approval ? r1(hoursBetween(r.created_at, r.reviewed_at)) : "", r.admin_comment || "", r.cancel_reason || ""])],
    vehicles: () => [["No.", "Vehicle", "Plate", "Trips", "Km", "Hours", "Days used", "Use %", "Checklists", "Weeks due", "Problems", "Open now", "Odometer km"],
      vrows.map((x) => [x.v.no, x.v.model, x.v.plate, x.trips, x.km, x.hours, x.days, x.use, x.checks, c.weeks.length, x.problems, x.open, x.odo || ""])],
    drivers: () => [["Driver", "Trips", "Passengers", "Deliveries", "Km", "Hours", "Checklists", "Weeks due", "Problems reported"],
      drows.map((x) => [x.name, x.trips, x.pax, x.deliveries, x.km, x.hours, x.checks, c.weeks.length, x.problems])],
    departments: () => [["Department", "Requests", "Done", "Rejected", "Cancelled", "Passengers", "Deliveries", "Km"], deprows.map((x) => [x.d, x.requests, x.done, x.rejected, x.cancelled, x.pax, x.deliveries, x.km])],
    problems: () => [["Reported at", "Vehicle", "Plate", "Problem", "Details", "Severity", "Source", "Reported by", "Odometer km", "Status", "Fixed at", "Fixed by", "Action", "Hours to fix", "Latitude", "Longitude", "Accuracy m", "Map"],
      c.issues.map((i) => [at(i.reported_at), vehicleModel(i.vehicle_number), i.vehicle_number, i.title, i.description, SEV[i.severity] || i.severity, i.source === "checklist" ? "Weekly checklist" : "Driver report", i.reported_by_name, i.odometer_km ?? "", statusLabel(i.status), at(i.resolved_at), i.resolved_by || "", i.resolution_note || "", i.resolved_at ? r1(hoursBetween(i.reported_at, i.resolved_at)) : "", ...G(i.gps)])],
    checklists: () => [["Week of", "Sent at", "Driver", "Vehicle", "Plate", "Odometer km", "Section", "Item", "Result", "Comment", "Latitude", "Longitude"],
      c.insp.flatMap((i) => CHECKLIST.flatMap((s) => s.items.map(([k, l]) => [i.week_key, at(i.submitted_at), i.driver_name, vehicleModel(i.vehicle_number), i.vehicle_number, i.odometer_km, s.title, l, { ok: "OK", attention: "Problem", na: "N/A" }[i.items[k]?.status] || "", i.items[k]?.comment || "", i.gps?.lat ?? "", i.gps?.lng ?? ""])))],
  };
  const exportOne = (k) => { const [h, rows] = X[k](); downloadCSV(`hrid-${k}-${month}.csv`, h, rows); return rows.length; };
  document.querySelectorAll("[data-x]").forEach((b) => b.addEventListener("click", async () => {
    if (b.dataset.x === "all") { for (const k of Object.keys(X)) { exportOne(k); await new Promise((r) => setTimeout(r, 350)); } toast("10 files downloaded"); }
    else toast(`${exportOne(b.dataset.x)} row(s) exported`);
  }));
});
