// Email templates – shared by the website (email log / demo mode) and the Supabase send-email function.
// Pure functions only: no DOM, no network.
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function fmtDate(iso) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, d)));
}

function stopsHTML(r) {
  const stops = r.stops?.length ? r.stops : [r.destination];
  if (stops.length === 1) return esc(stops[0]);
  return stops.map((s, i) => `${i + 1}. ${esc(s)}`).join("<br>");
}
function passengersHTML(r) {
  const list = r.passengers?.length ? r.passengers : String(r.passenger_names || "").split("\n").filter(Boolean).map((name) => ({ name }));
  if (!list.length) return esc(r.passenger_count);
  return `${list.length}<br><span style="font-weight:400">${list.map((p) => esc(p.name) + (p.type === "hrid" ? " (HRID)" : p.organization ? ` (${esc(p.organization)})` : " (Non-HRID)")).join("<br>")}</span>`;
}

function layout(title, intro, r, appUrl, footer = "") {
  const row = (k, v) => (v ? `<tr><td style="padding:6px 12px 6px 0;color:#6B7785;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:6px 0;color:#2D3748;font-weight:600">${v}</td></tr>` : "");
  return `<div style="font-family:Segoe UI,Arial,sans-serif;background:#F5F7FA;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden">
    <div style="background:#0B5664;color:#fff;padding:16px 20px"><div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;opacity:.8">HRID FleetFlow</div><div style="font-size:18px;font-weight:600">${esc(title)}</div></div>
    <div style="padding:20px">
      <p style="margin:0 0 14px;color:#2D3748">${intro}</p>
      <table style="border-collapse:collapse;font-size:14px">
        ${row("Reference", esc(r.reference))}
        ${row("Requested by", esc(r.requester_name) + (r.is_guest ? " (Guest – " + esc(r.guest_organization) + ")" : r.department ? " (" + esc(r.department) + ")" : ""))}
        ${row("Pick-up", esc(r.origin))}
        ${row(r.stops?.length > 1 ? "Destinations" : "Destination", stopsHTML(r))}
        ${row("Date", esc(fmtDate(r.trip_date)))}
        ${row("Time", esc(r.departure_time) + (r.return_time ? " – return " + esc(r.return_time) : ""))}
        ${row("Passengers", passengersHTML(r))}
        ${row("Purpose", esc(r.purpose))}
        ${row("Driver", esc(r.assigned_driver_name))}
        ${row("Vehicle", esc(r.assigned_vehicle_label || r.assigned_vehicle_number))}
        ${row("Comment", esc(r.admin_comment))}
      </table>
      ${footer}
      ${appUrl ? `<p style="margin:20px 0 0"><a href="${esc(appUrl)}" style="background:#00A651;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;display:inline-block">Open HRID FleetFlow</a></p>` : ""}
    </div>
    <div style="padding:12px 20px;background:#F5F7FA;color:#6B7785;font-size:12px">Hiwa Rauf for Investment & Development · This is an automatic message, please do not reply.</div>
  </div></div>`;
}

/**
 * Build the emails for an event.
 * ctx = { request, admins:[{full_name,email}], driver, previousDriver, requesterEmail, appUrl }
 * Returns [{ to, subject, html }]
 */
export function buildEmails(event, ctx) {
  const r = ctx.request, url = ctx.appUrl || "";
  const out = [];
  const add = (to, subject, html) => { if (to) out.push({ to: String(to).trim().toLowerCase(), subject, html }); };
  const route = `${r.origin} → ${r.destination}`;
  const who = esc(r.requester_name);

  if (event === "request_created") {
    add(ctx.requesterEmail, `Trip request received – ${r.reference}`,
      layout("Your trip request was received", `Dear ${who},<br>Your trip request has been submitted and is waiting for approval by the HRID transport administrators. You will receive another email once it is reviewed.`, r, r.is_guest ? "" : url));
    for (const a of ctx.admins) add(a.email, `Action required: new trip request ${r.reference} – ${route}`,
      layout("New trip request – action required", `Dear ${esc(a.full_name)},<br>A new ${r.is_guest ? "<b>guest</b> " : ""}trip request needs your approval and a driver assignment.`, r, url,
        r.is_guest ? `<p style="margin:14px 0 0;font-size:13px;color:#744210;background:#FDF3E1;padding:10px;border-radius:8px">Guest details – Phone: ${esc(r.guest_phone)}${r.guest_email ? " · Email: " + esc(r.guest_email) : ""} · HRID contact: ${esc(r.guest_host)}</p>` : ""));
  }
  if (event === "request_approved") {
    add(ctx.requesterEmail, `Trip approved – ${r.reference}`,
      layout("Your trip has been approved", `Dear ${who},<br>Your trip request has been approved. Your driver and vehicle are shown below.`, r, r.is_guest ? "" : url));
    if (ctx.driver) add(ctx.driver.email, `New trip assigned – ${fmtDate(r.trip_date)} ${r.departure_time} – ${route}`,
      layout("You have been assigned a trip", `Dear ${esc(ctx.driver.full_name)},<br>You have been assigned the following trip. Open the app and tap <b>Start trip</b> when you begin.`, r, url,
        r.is_guest ? `<p style="margin:14px 0 0;font-size:13px">Guest phone: <b>${esc(r.guest_phone)}</b></p>` : ""));
    if (ctx.previousDriver && ctx.previousDriver.email !== ctx.driver?.email) add(ctx.previousDriver.email, `Trip unassigned – ${r.reference}`,
      layout("A trip was reassigned", `Dear ${esc(ctx.previousDriver.full_name)},<br>The following trip has been reassigned to another driver. You no longer need to do it.`, r, url));
  }
  if (event === "request_rejected") {
    add(ctx.requesterEmail, `Trip request not approved – ${r.reference}`,
      layout("Your trip request was not approved", `Dear ${who},<br>Unfortunately your trip request was not approved. The reason is shown below.`, r, r.is_guest ? "" : url));
    if (ctx.previousDriver) add(ctx.previousDriver.email, `Trip cancelled – ${r.reference}`,
      layout("An assigned trip was cancelled", `Dear ${esc(ctx.previousDriver.full_name)},<br>The following trip is no longer required.`, r, url));
  }
  if (event === "request_cancelled") {
    for (const a of ctx.admins) add(a.email, `Trip request cancelled – ${r.reference}`,
      layout("Trip request cancelled by requester", `Dear ${esc(a.full_name)},<br>${who} cancelled the following trip request. No action is needed.`, r, url));
    if (ctx.driver) add(ctx.driver.email, `Trip cancelled – ${r.reference}`,
      layout("An assigned trip was cancelled", `Dear ${esc(ctx.driver.full_name)},<br>The requester cancelled the following trip. You no longer need to do it.`, r, url));
  }
  return out;
}
