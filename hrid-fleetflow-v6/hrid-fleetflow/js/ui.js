// Shared UI helpers: escaping, toast, modal, form fields, validation, location capture,
// destinations / passengers / items editors, signatures and CSV downloads.
import { icon } from "./icons.js";
import { SignaturePad } from "./signature.js";

export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
export const norm = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();

/* ---------------- toast & modal ---------------- */
let toastTimer;
export function toast(msg) {
  const el = document.getElementById("toast");
  el.innerHTML = `<div class="t">${esc(msg)}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.innerHTML = ""), 3500);
}
export function modal(html, onMount) {
  const bg = document.createElement("div");
  bg.className = "modal-bg";
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.addEventListener("click", (e) => { if (e.target === bg) close(); });
  bg.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
  onMount?.(bg, close);
  bg.querySelector("input,select,textarea,button")?.focus();
  return close;
}

/* ---------------- form helpers ---------------- */
export function field(name, label, { type = "text", required = false, value = "", options = null, attrs = "", placeholder = "" } = {}) {
  const id = "f_" + name;
  const req = required ? " required" : "";
  let input;
  if (options) input = `<select class="input" id="${id}" name="${name}"${req} ${attrs}><option value="">Select…</option>${options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(value) ? "selected" : ""}>${esc(l)}</option>`; }).join("")}</select>`;
  else if (type === "textarea") input = `<textarea class="input" id="${id}" name="${name}"${req} placeholder="${esc(placeholder)}" ${attrs}>${esc(value)}</textarea>`;
  else input = `<input class="input" id="${id}" name="${name}" type="${type}" value="${esc(value)}"${req} placeholder="${esc(placeholder)}" ${attrs} />`;
  return `<div class="field"><label for="${id}">${esc(label)}${required ? ' <span class="req">*</span>' : ""}</label>${input}<span class="err-text" data-err="${name}"></span></div>`;
}
export function readForm(form) {
  const out = {};
  new FormData(form).forEach((v, k) => (out[k] = typeof v === "string" ? v.trim() : v));
  return out;
}
/** Checks visible [required] fields plus extra(data) → {name: message}. Shows messages and scrolls to the first problem. */
export function validate(form, extra = () => ({})) {
  form.querySelectorAll(".err-text").forEach((e) => (e.textContent = ""));
  form.querySelectorAll(".invalid").forEach((e) => e.classList.remove("invalid"));
  const errs = {};
  form.querySelectorAll("[required]").forEach((el) => { if (el.name && el.type !== "checkbox" && !el.closest("[hidden]") && !String(el.value).trim()) errs[el.name] = "This field is required"; });
  Object.assign(errs, extra(readForm(form)));
  for (const [k, msg] of Object.entries(errs)) {
    form.querySelector(`[name="${k}"]`)?.classList.add("invalid");
    const e = form.querySelector(`[data-err="${k}"]`);
    if (e) e.textContent = msg;
  }
  const first = form.querySelector(".invalid") || [...form.querySelectorAll(".err-text")].find((e) => e.textContent);
  first?.scrollIntoView({ behavior: "smooth", block: "center" });
  return Object.keys(errs).length === 0;
}

/* ---------------- statuses ---------------- */
const STATUS_LABEL = {
  pending: "Pending approval", approved: "Approved", started: "In progress", delivered: "Awaiting signature",
  completed: "Completed", rejected: "Rejected", cancelled: "Cancelled",
  open: "Open", resolved: "Resolved", minor: "Minor", major: "Major", unsafe: "Unsafe",
};
export const statusLabel = (s) => STATUS_LABEL[s] || String(s || "");
export const badge = (status) => `<span class="badge b-${esc(status)}">${esc(statusLabel(status))}</span>`;

/* ---------------- location ---------------- */
export function getGPS() {
  return new Promise((res) => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), acc: Math.round(p.coords.accuracy || 0) }),
      () => res(null), { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  });
}
export const mapUrl = (g) => (g ? `https://maps.google.com/?q=${g.lat},${g.lng}` : "");
export const gpsText = (g) => (g ? `<a href="${mapUrl(g)}" target="_blank" rel="noopener">${icon("pin")} Map</a>` : `<span class="badge b-late">No location</span>`);

/**
 * Captures time + GPS location. If location fails, explains how to turn it on and offers
 * "Try again" or (after a failed try) "Record without location". Resolves {at, gps} or null if cancelled.
 */
export function captureLocation() {
  return new Promise(async (resolve) => {
    toast("Getting your location…");
    let gps = await getGPS();
    if (gps) return resolve({ at: new Date().toISOString(), gps });
    modal(`<h2 style="margin-bottom:8px">Location not available</h2>
      <p class="small" style="margin-bottom:14px">Turn on Location (GPS) on your phone and allow this website to use it, then try again.</p>
      <div class="stack"><button class="btn btn-blue btn-block" type="button" data-retry>${icon("pin")} Try again</button>
      <button class="btn btn-outline btn-block" type="button" data-without>Record without location</button>
      <button class="btn btn-outline btn-block" type="button" data-cancel>Cancel</button></div>`, (bg, close) => {
      bg.querySelector("[data-retry]").addEventListener("click", async (e) => {
        e.target.disabled = true; e.target.textContent = "Getting your location…";
        gps = await getGPS();
        if (gps) { close(); resolve({ at: new Date().toISOString(), gps }); }
        else { e.target.disabled = false; e.target.textContent = "Try again"; toast("Location still not available"); }
      });
      bg.querySelector("[data-without]").addEventListener("click", () => { close(); resolve({ at: new Date().toISOString(), gps: null }); });
      bg.querySelector("[data-cancel]").addEventListener("click", () => { close(); resolve(null); });
    });
  });
}

/* ---------------- destinations ---------------- */
export const MAX_STOPS = 10;
export const cleanStops = (stops) => stops.map((s) => String(s || "").trim()).filter(Boolean);
export function stopsEditor(box, stops) {
  if (!stops.length) stops.push("");
  const draw = () => {
    box.innerHTML = stops.map((s, i) => `<div class="stop-row">
        <span class="stop-n" aria-hidden="true">${i + 1}</span>
        <input class="input" data-i="${i}" value="${esc(s)}" placeholder="${stops.length > 1 ? `Destination ${i + 1}` : "Where to?"}" aria-label="Destination ${i + 1}" autocomplete="off" />
        ${stops.length > 1 ? `<button type="button" class="btn btn-danger btn-icon" data-rm="${i}" aria-label="Remove destination ${i + 1}">${icon("x")}</button>` : ""}
      </div>`).join("")
      + (stops.length < MAX_STOPS ? `<button type="button" class="btn btn-outline btn-sm add-link" data-add>${icon("plus")} Add another stop</button>` : "");
    box.querySelectorAll("input[data-i]").forEach((inp) => inp.addEventListener("input", () => (stops[+inp.dataset.i] = inp.value)));
    box.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => { stops.splice(+b.dataset.rm, 1); draw(); }));
    box.querySelector("[data-add]")?.addEventListener("click", () => { stops.push(""); draw(); box.querySelectorAll("input[data-i]")[stops.length - 1].focus(); });
  };
  draw();
}

/* ---------------- passengers ---------------- */
export const newPax = (type = "hrid") => ({ id: uid(), type, user_id: null, name: "", employee_no: "", department: "", organization: "", signature: null, signed_at: null, signed_gps: null });
export const paxRecord = (p) => ({ id: p.id || uid(), type: p.type === "hrid" ? "hrid" : "external", user_id: p.user_id || null, name: String(p.name || "").trim(), employee_no: p.employee_no || "", department: p.department || "", organization: String(p.organization || "").trim(), signature: p.signature || null, signed_at: p.signed_at || null, signed_gps: p.signed_gps || null });
export function paxErrors(others, all = others) {
  for (const [i, p] of others.entries()) {
    if (p.type === "hrid" && !p.user_id) return `Passenger ${i + 1}: select the HRID employee (or remove the empty passenger)`;
    if (p.type !== "hrid" && !String(p.name || "").trim()) return `Passenger ${i + 1}: enter the full name (or remove the empty passenger)`;
  }
  if (!all.length) return "Add at least one passenger";
  if (all.length > 60) return "Maximum 60 passengers";
  const ids = all.filter((p) => p.user_id).map((p) => p.user_id);
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) return `${all.find((p) => p.user_id === dup).name} is listed more than once`;
  return null;
}
export const paxBadge = (p) => (p.type === "hrid" ? `<span class="badge b-hrid">HRID${p.employee_no ? " #" + esc(p.employee_no) : ""}</span>` : `<span class="badge b-na">Non-HRID${p.organization ? ` · <span data-no-tr>${esc(p.organization)}</span>` : ""}</span>`);
export const paxListHTML = (list = []) => (list.length ? `<ul class="pax-list">${list.map((p) => `<li><span data-no-tr>${esc(p.name)}</span> ${paxBadge(p)}</li>`).join("")}</ul>` : "-");

/** Dynamic passenger list: HRID employee (drop-down) or non-HRID (name + organisation). Mutates `list`. */
export function passengerEditor(box, list, { employees = [], onChange = () => {} } = {}) {
  const empSelect = (p) => `<select class="input" data-emp aria-label="HRID employee"><option value="">Select employee…</option>${employees.map((e) => `<option value="${esc(e.id)}" ${e.id === p.user_id ? "selected" : ""}>${esc(e.full_name)}${e.employee_no ? ` (#${esc(e.employee_no)})` : ""}</option>`).join("")}</select>`;
  const draw = () => {
    box.innerHTML = list.map((p, i) => `<div class="pax" data-i="${i}">
        <div class="row between" style="margin-bottom:8px">
          <div class="seg" role="group" aria-label="Passenger ${i + 1} type"><button type="button" class="pick" data-type="hrid" aria-pressed="${p.type === "hrid"}">HRID employee</button><button type="button" class="pick" data-type="external" aria-pressed="${p.type !== "hrid"}">Non-HRID</button></div>
          <button type="button" class="btn btn-danger btn-icon btn-sm" data-rm aria-label="Remove passenger ${i + 1}">${icon("x")}</button>
        </div>
        ${p.type === "hrid" ? empSelect(p)
          : `<div class="grid two"><input class="input" data-f="name" value="${esc(p.name)}" placeholder="Full name" aria-label="Full name" autocomplete="off" /><input class="input" data-f="organization" value="${esc(p.organization)}" placeholder="Company (optional)" aria-label="Company (optional)" autocomplete="off" /></div>`}
      </div>`).join("")
      + `<button type="button" class="btn btn-outline btn-sm add-link" data-add>${icon("plus")} Add passenger</button>`;
    box.querySelectorAll(".pax").forEach((el) => {
      const p = list[+el.dataset.i];
      el.querySelector("[data-rm]").addEventListener("click", () => { list.splice(list.indexOf(p), 1); draw(); onChange(); });
      el.querySelectorAll("[data-type]").forEach((b) => b.addEventListener("click", () => {
        if ((p.type === "hrid") === (b.dataset.type === "hrid")) return;
        Object.assign(p, { type: b.dataset.type, user_id: null, name: "", employee_no: "", department: "", organization: "" });
        draw(); onChange();
      }));
      el.querySelector("[data-emp]")?.addEventListener("change", (e) => {
        const emp = employees.find((x) => x.id === e.target.value);
        Object.assign(p, { user_id: emp?.id || null, name: emp?.full_name || "", employee_no: emp?.employee_no || "", department: emp?.department || "" });
        onChange();
      });
      el.querySelectorAll("[data-f]").forEach((inp) => inp.addEventListener("input", () => { p[inp.dataset.f] = inp.value; onChange(); }));
    });
    box.querySelector("[data-add]").addEventListener("click", () => { list.push(newPax(employees.length ? "hrid" : "external")); draw(); onChange(); box.querySelectorAll(".pax")[list.length - 1]?.querySelector("select,input")?.focus(); });
  };
  draw();
}

/* ---------------- documents & items ---------------- */
export const newItem = () => ({ id: uid(), description: "", quantity: 1 });
export const cleanItems = (items) => items.map((i) => ({ id: i.id || uid(), description: String(i.description || "").trim(), quantity: Math.max(1, parseInt(i.quantity, 10) || 1) })).filter((i) => i.description);
export function itemsErrors(items) {
  for (const [n, it] of items.entries()) {
    if (!String(it.description || "").trim()) return `Item ${n + 1}: enter a description (or remove the empty item)`;
    const q = Number(it.quantity);
    if (!Number.isInteger(q) || q < 1 || q > 999) return `Item ${n + 1}: quantity must be 1–999`;
  }
  return items.length ? null : "Add at least one item";
}
export const itemsCount = (items = []) => items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
export const itemsListHTML = (items = []) => (items.length ? `<ul class="pax-list">${items.map((i) => `<li>${icon("box")} <span data-no-tr>${esc(i.description)}</span> <span class="badge b-na">× ${esc(i.quantity)}</span></li>`).join("")}</ul>` : "-");
export function itemsEditor(box, items) {
  if (!items.length) items.push(newItem());
  const draw = () => {
    box.innerHTML = items.map((it, i) => `<div class="item-row" data-i="${i}">
        <input class="input" data-f="description" value="${esc(it.description)}" placeholder="What? e.g. Signed contracts" aria-label="Item ${i + 1} description" autocomplete="off" />
        <input class="input qty" data-f="quantity" type="number" min="1" max="999" inputmode="numeric" value="${esc(it.quantity)}" aria-label="Item ${i + 1} quantity" />
        ${items.length > 1 ? `<button type="button" class="btn btn-danger btn-icon" data-rm aria-label="Remove item ${i + 1}">${icon("x")}</button>` : ""}
      </div>`).join("")
      + `<button type="button" class="btn btn-outline btn-sm add-link" data-add>${icon("plus")} Add item</button>`;
    box.querySelectorAll(".item-row").forEach((row) => {
      const it = items[+row.dataset.i];
      row.querySelectorAll("[data-f]").forEach((inp) => inp.addEventListener("input", () => (it[inp.dataset.f] = inp.value)));
      row.querySelector("[data-rm]")?.addEventListener("click", () => { items.splice(items.indexOf(it), 1); draw(); });
    });
    box.querySelector("[data-add]").addEventListener("click", () => { items.push(newItem()); draw(); box.querySelectorAll('[data-f="description"]')[items.length - 1].focus(); });
  };
  draw();
}

/* ---------------- signatures ---------------- */
/** Signature pad in a modal. onSave(dataUrl) may be async. */
export function signatureModal(title, subtitle, onSave) {
  modal(`<h2 style="margin-bottom:4px">${esc(title)}</h2><p class="muted small" style="margin-bottom:12px">${esc(subtitle)}</p>
    <canvas class="sig-canvas"></canvas><div class="grid two" style="margin-top:12px"><button class="btn btn-outline" type="button" data-clear>Clear</button><button class="btn btn-primary" type="button" data-save disabled>Save signature</button></div>
    <button class="btn btn-outline btn-block" type="button" data-close style="margin-top:8px">Cancel</button>`, (bg, close) => {
    const save = bg.querySelector("[data-save]");
    const pad = new SignaturePad(bg.querySelector("canvas"), () => (save.disabled = pad.isEmpty()));
    bg.querySelector("[data-clear]").addEventListener("click", () => { pad.clear(); save.disabled = true; });
    save.addEventListener("click", async () => { save.disabled = true; const img = pad.toDataURL(); close(); await onSave(img); });
  });
}

/* ---------------- CSV ---------------- */
export function csvText(header, rows) {
  const cell = (v) => { const s = v == null ? "" : String(v).replace(/[\u2066-\u2069]/g, ""); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return "\uFEFF" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}
export function downloadCSV(filename, header, rows) {
  const url = URL.createObjectURL(new Blob([csvText(header, rows)], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Clear a field's error message as soon as it is edited.
const clearErr = (e) => {
  const t = e.target;
  if (!(t instanceof Element)) return;
  const form = t.closest("form");
  if (t.name) { t.classList.remove("invalid"); const m = form?.querySelector(`[data-err="${t.name}"]`); if (m) m.textContent = ""; }
  const scoped = t.closest("#stops") ? "stops" : t.closest("#pax") ? "passengers" : t.closest("#items") ? "items" : null;
  if (scoped) { const m = form?.querySelector(`[data-err="${scoped}"]`); if (m) m.textContent = ""; }
};
document.addEventListener("input", clearErr);
document.addEventListener("change", clearErr);
