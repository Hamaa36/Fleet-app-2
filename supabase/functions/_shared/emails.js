// Email templates – shared by the website (email log) and the Supabase send-email function. Pure functions only.
const esc = (v) => String(v ?? "").replace(/[&<>"'\u2066-\u2069]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? "");
const plain = (v) => String(v ?? "").replace(/[\u2066-\u2069]/g, "");
function fmtDate(iso) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, d)));
}
const fmtDateTime = (iso) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Baghdad", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const row = (k, v) => (v ? `<tr><td style="padding:6px 12px 6px 0;color:#6B7785;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:6px 0;color:#2D3748;font-weight:600">${v}</td></tr>` : "");

function shell(title, intro, rows, appUrl, footer = "", accent = "#0B5664") {
  return `<div style="font-family:Segoe UI,Arial,sans-serif;background:#F5F7FA;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden">
    <div style="background:${accent};color:#fff;padding:16px 20px"><div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;opacity:.8">HRID FleetFlow</div><div style="font-size:18px;font-weight:600">${esc(title)}</div></div>
    <div style="padding:20px"><p style="margin:0 0 14px;color:#2D3748">${intro}</p><table style="border-collapse:collapse;font-size:14px">${rows}</table>${footer}
      ${appUrl ? `<p style="margin:20px 0 0"><a href="${esc(appUrl)}" style="background:#00A651;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;display:inline-block">Open HRID FleetFlow</a></p>` : ""}</div>
    <div style="padding:12px 20px;background:#F5F7FA;color:#6B7785;font-size:12px">Hiwa Rauf for Investment & Development · Automatic message, please do not reply.</div>
  </div></div>`;
}
function tripRows(r) {
  const items = r.trip_type === "items";
  const stops = r.stops?.length ? r.stops : [r.destination];
  return [
    row("Reference", esc(r.reference)),
    row("Type", items ? "Documents & items" : "Passengers"),
    row("Requested by", esc(r.requester_name) + (r.for_guest ? ` (Guest – ${esc(r.guest_organization)})` : r.department ? ` (${esc(r.department)})` : "")),
    row("From", esc(r.origin)),
    row(stops.length > 1 ? "Destinations" : "To", stops.length > 1 ? stops.map((s, i) => `${i + 1}. ${esc(s)}`).join("<br>") : esc(stops[0])),
    row("Date", esc(fmtDate(r.trip_date))),
    row("Time", esc(r.departure_time) + (r.return_time ? ` – return ${esc(r.return_time)}` : "")),
    items ? row("Items", (r.items || []).map((i) => `${esc(i.description)} × ${esc(i.quantity)}`).join("<br>")) : row("Passengers", r.passengers?.length ? `${r.passengers.length}<br><span style="font-weight:400">${r.passengers.map((p) => esc(p.name)).join("<br>")}</span>` : ""),
    items ? row("Receiver", esc(r.recipient_name) + (r.recipient_phone ? " · " + esc(r.recipient_phone) : "")) : "",
    row("Purpose", esc(r.purpose)),
    row("Driver", esc(r.assigned_driver_name)),
    row("Vehicle", esc(r.assigned_vehicle_number)),
    row("Comment", esc(r.admin_comment || r.cancel_reason)),
  ].join("");
}

/**
 * Build the emails for an event. Returns [{ to, subject, html }].
 * Trip events: ctx = { request, admins, driver, previousDriver, requesterEmail, appUrl }
 * vehicle_issue: ctx = { issues, admins, appUrl }
 */
export function buildEmails(event, ctx) {
  const out = [], url = ctx.appUrl || "";
  const add = (to, subject, html) => { if (to && !out.some((m) => m.to === String(to).toLowerCase() && m.subject === subject)) out.push({ to: String(to).trim().toLowerCase(), subject, html }); };

  if (event === "vehicle_issue") {
    const issues = ctx.issues || [];
    if (!issues.length) return out;
    const f = issues[0];
    const worst = issues.some((i) => i.severity === "unsafe") ? "unsafe" : issues.some((i) => i.severity === "major") ? "major" : "minor";
    const sev = { unsafe: "UNSAFE – do not drive", major: "Major – needs repair soon", minor: "Minor" }[worst];
    const rows = [row("Vehicle", esc(f.vehicle_label || f.vehicle_number)), row("Severity", sev), row("Reported by", esc(f.reported_by_name)),
      row("When", esc(fmtDateTime(f.reported_at))), row("Odometer", f.odometer_km != null ? `${esc(f.odometer_km)} km` : ""),
      row("Location", f.gps ? `<a href="https://maps.google.com/?q=${f.gps.lat},${f.gps.lng}">Map</a>` : ""),
      row(issues.length > 1 ? `Problems (${issues.length})` : "Problem", issues.map((i) => `• ${esc(i.title)}${i.description ? ` – <span style="font-weight:400">${esc(i.description)}</span>` : ""}`).join("<br>"))].join("");
    for (const a of ctx.admins || []) add(a.email, `${worst === "unsafe" ? "URGENT – " : ""}Vehicle problem: ${plain(f.vehicle_label || f.vehicle_number)}`,
      shell(worst === "unsafe" ? "Urgent vehicle problem" : "Vehicle problem reported", `Dear ${esc(a.full_name)},<br>A problem was reported on a company vehicle. Please arrange a repair.`, rows, url, "", worst === "unsafe" ? "#C53030" : "#B7791F"));
    return out;
  }

  const r = ctx.request;
  if (!r) return out;
  const L = (title, intro, footer = "") => shell(title, intro, tripRows(r), url, footer);
  const who = esc(r.requester_name);
  const guestBox = r.for_guest ? `<p style="margin:14px 0 0;font-size:13px;color:#744210;background:#FDF3E1;padding:10px;border-radius:8px">Guest phone: <b>${esc(r.guest_phone)}</b> · HRID host: ${esc(r.guest_host)}</p>` : "";

  if (event === "request_created") {
    if (!r.created_by_admin) add(ctx.requesterEmail, `Request received – ${r.reference}`, L("Your request was received", `Dear ${who},<br>Your request is waiting for approval. You will get another email when it is reviewed.`));
    for (const a of ctx.admins || []) add(a.email, `Action required: new request ${r.reference}`, L("New request – please approve", `Dear ${esc(a.full_name)},<br>A new ${r.for_guest ? "<b>guest</b> " : ""}request needs approval and a driver.`, guestBox));
  }
  if (event === "request_approved") {
    add(ctx.requesterEmail, `Approved – ${r.reference}`, L("Your request was approved", `Dear ${who},<br>Your transport is approved. Driver and vehicle are below.`));
    if (ctx.driver) add(ctx.driver.email, `New trip – ${fmtDate(r.trip_date)} ${r.departure_time}`, L("You have a new trip", `Dear ${esc(ctx.driver.full_name)},<br>You have been assigned this trip. Open the app and tap <b>Start trip</b> when you leave.`, guestBox));
    if (ctx.previousDriver && ctx.previousDriver.email !== ctx.driver?.email) add(ctx.previousDriver.email, `Trip moved to another driver – ${r.reference}`, L("Trip reassigned", `Dear ${esc(ctx.previousDriver.full_name)},<br>This trip was given to another driver. You do not need to do it.`));
  }
  if (event === "request_rejected") {
    add(ctx.requesterEmail, `Not approved – ${r.reference}`, L("Your request was not approved", `Dear ${who},<br>Your request was not approved. The reason is below.`));
  }
  if (event === "request_cancelled") {
    const byRequester = r.cancelled_by === r.requester_name;
    if (byRequester) for (const a of ctx.admins || []) add(a.email, `Cancelled – ${r.reference}`, L("Request cancelled", `Dear ${esc(a.full_name)},<br>${who} cancelled this request. No action needed.`));
    else add(ctx.requesterEmail, `Cancelled – ${r.reference}`, L("Your trip was cancelled", `Dear ${who},<br>The transport team cancelled this trip. The reason is below.`));
    const drv = ctx.driver || ctx.previousDriver;
    if (drv) add(drv.email, `Trip cancelled – ${r.reference}`, L("Trip cancelled", `Dear ${esc(drv.full_name)},<br>This trip is cancelled. You do not need to do it.`));
  }
  if (event === "trip_started") {
    add(ctx.requesterEmail, `Your driver is on the way – ${r.reference}`, L("Your trip has started", `Dear ${who},<br>${esc(r.assigned_driver_name)} has started the trip.`));
  }
  if (event === "delivery_done") {
    add(ctx.requesterEmail, `Please sign: delivery done – ${r.reference}`, L("Delivered – please sign", `Dear ${who},<br>Your documents/items were delivered. Open HRID FleetFlow on your phone and tap <b>Sign</b> to confirm.`));
  }
  if (event === "delivery_signed") {
    for (const a of ctx.admins || []) add(a.email, `Delivery confirmed – ${r.reference}`, L("Delivery confirmed", `Dear ${esc(a.full_name)},<br>${who} signed to confirm the delivery.`));
  }
  return out;
}
