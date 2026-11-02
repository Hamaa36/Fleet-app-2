// Shared UI helpers: escaping, toast, modal, form fields, validation,
// multiple-destination editor and HRID / non-HRID passenger editor.
import { icon } from "./icons.js";
import { SignaturePad } from "./signature.js";
import { fmtDateTime } from "./schedule.js";

export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
export const norm = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();

/* ---------------- toast & modal ---------------- */
let toastTimer;
export function toast(msg) {
  const el = document.getElementById("toast");
  el.innerHTML = `<div class="t">${esc(msg)}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.innerHTML = ""), 3200);
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
/** Checks [required] fields plus extra(data) → {name: message}. Shows messages and scrolls to the first problem. */
export function validate(form, extra = () => ({})) {
  form.querySelectorAll(".err-text").forEach((e) => (e.textContent = ""));
  form.querySelectorAll(".invalid").forEach((e) => e.classList.remove("invalid"));
  const errs = {};
  form.querySelectorAll("[required]").forEach((el) => { if (el.name && el.type !== "checkbox" && !String(el.value).trim()) errs[el.name] = "This field is required"; });
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
export const badge = (status) => `<span class="badge b-${esc(status)}">${esc(status.charAt(0).toUpperCase() + status.slice(1))}</span>`;

export function getGPS() {
  return new Promise((res) => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition((p) => res({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }), () => res(null), { enableHighAccuracy: true, timeout: 10000 });
  });
}
export const gpsText = (g) => (g ? `<a href="https://maps.google.com/?q=${g.lat},${g.lng}" target="_blank" rel="noopener">${g.lat}, ${g.lng}</a>` : "Not captured");

/* ---------------- multiple destinations ---------------- */
export const MAX_STOPS = 10;
export const cleanStops = (stops) => stops.map((s) => String(s || "").trim()).filter(Boolean);

/** Editable list of destinations. Mutates `stops` (array of strings). */
export function stopsEditor(box, stops) {
  if (!stops.length) stops.push("");
  const draw = () => {
    box.innerHTML = stops.map((s, i) => `
      <div class="stop-row">
        <span class="stop-n" aria-hidden="true">${i + 1}</span>
        <input class="input" data-i="${i}" value="${esc(s)}" placeholder="${stops.length > 1 ? `Destination ${i + 1}` : "Destination"}" aria-label="Destination ${i + 1}" autocomplete="off" />
        ${stops.length > 1 ? `<button type="button" class="btn btn-danger btn-icon" data-rm="${i}" aria-label="Remove destination ${i + 1}">${icon("x")}</button>` : ""}
      </div>`).join("")
      + (stops.length < MAX_STOPS ? `<button type="button" class="btn btn-outline btn-sm stop-add" data-add>${icon("plus")} Add another destination</button>` : `<p class="small muted stop-add">Maximum ${MAX_STOPS} destinations.</p>`);
    box.querySelectorAll("input[data-i]").forEach((inp) => inp.addEventListener("input", () => (stops[+inp.dataset.i] = inp.value)));
    box.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => { stops.splice(+b.dataset.rm, 1); draw(); }));
    box.querySelector("[data-add]")?.addEventListener("click", () => { stops.push(""); draw(); box.querySelectorAll("input[data-i]")[stops.length - 1].focus(); });
  };
  draw();
}

/** Read-only route: pick-up then numbered destinations. */
export function routeHTML(r) {
  const stops = r.stops?.length ? r.stops : [r.destination].filter(Boolean);
  return `<ol class="route"><li><span class="lbl">Pick-up</span>${esc(r.origin)}</li>${stops.map((s, i) => `<li><span class="lbl">${stops.length > 1 ? `Destination ${i + 1}` : "Destination"}</span>${esc(s)}</li>`).join("")}</ol>`;
}

/* ---------------- passengers ---------------- */
export const newPax = (type = "hrid") => ({ id: uid(), type, user_id: null, name: "", employee_no: "", department: "", organization: "", signature: null, signed_at: null });
export const paxRecord = (p) => ({ id: p.id || uid(), type: p.type === "hrid" ? "hrid" : "external", user_id: p.user_id || null, name: String(p.name || "").trim(), employee_no: p.employee_no || "", department: p.department || "", organization: String(p.organization || "").trim() });
/** Old records stored only `passenger_names` text – convert them. */
export const paxOf = (r) => (r.passengers?.length ? r.passengers : String(r.passenger_names || "").split("\n").map((s) => s.trim()).filter(Boolean).map((name) => ({ ...newPax("external"), name })));

/** Returns an error message or null. `others` = editor list (numbered as on screen), `all` = everyone incl. the requester. */
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

const paxBadge = (p) => (p.type === "hrid" ? `<span class="badge b-hrid">HRID${p.employee_no ? " #" + esc(p.employee_no) : ""}</span>` : `<span class="badge b-na">Non-HRID${p.organization ? " · " + esc(p.organization) : ""}</span>`);
export function paxListHTML(list) {
  return list.length ? `<ul class="pax-list">${list.map((p) => `<li>${esc(p.name)} ${paxBadge(p)}</li>`).join("")}</ul>` : "-";
}
export { paxBadge };

export function collectSignature(p, done) {
  if (!String(p.name || "").trim()) { toast("Select or enter the passenger first"); return; }
  modal(`<h2 style="margin-bottom:4px">Passenger signature</h2><p class="muted small" style="margin-bottom:12px">${esc(p.name)} – sign inside the box with a finger or stylus.</p>
    <canvas class="sig-canvas"></canvas><div class="grid two" style="margin-top:12px"><button class="btn btn-outline" type="button" data-clear>Clear</button><button class="btn btn-primary" type="button" data-save disabled>Save signature</button></div>
    <button class="btn btn-outline btn-block" type="button" data-close style="margin-top:8px">Cancel</button>`, (bg, close) => {
    const save = bg.querySelector("[data-save]");
    const pad = new SignaturePad(bg.querySelector("canvas"), () => (save.disabled = pad.isEmpty()));
    bg.querySelector("[data-clear]").addEventListener("click", () => { pad.clear(); save.disabled = true; });
    save.addEventListener("click", () => { p.signature = pad.toDataURL(); p.signed_at = new Date().toISOString(); close(); done(); toast("Signature saved"); });
  });
}

/**
 * Dynamic passenger list. Each passenger is either an HRID employee (picked from a drop-down)
 * or a non-HRID person (name + organisation typed in). Mutates `list`.
 */
export function passengerEditor(box, list, { employees = [], allowHRID = true, signatures = false, onChange = () => {}, emptyText = "No passengers added yet." } = {}) {
  const empSelect = (p) => `<select class="input" data-emp aria-label="HRID employee"><option value="">Select employee…</option>${employees.map((e) => `<option value="${esc(e.id)}" ${e.id === p.user_id ? "selected" : ""}>${esc(e.full_name)}${e.employee_no ? ` (#${esc(e.employee_no)})` : ""}</option>`).join("")}</select>`;
  const draw = () => {
    box.innerHTML = (list.length ? list.map((p, i) => `
      <div class="passenger" data-i="${i}">
        <div class="row between" style="margin-bottom:10px"><b>Passenger ${i + 1}</b><button type="button" class="btn btn-danger btn-sm" data-rm aria-label="Remove passenger ${i + 1}">${icon("x")} Remove</button></div>
        ${allowHRID ? `<div class="seg" role="group" aria-label="Passenger ${i + 1} type" style="margin-bottom:10px"><button type="button" class="pick" data-type="hrid" aria-pressed="${p.type === "hrid"}">HRID employee</button><button type="button" class="pick" data-type="external" aria-pressed="${p.type !== "hrid"}">Non-HRID</button></div>` : ""}
        ${p.type === "hrid"
          ? `<div class="field"><label>HRID employee <span class="req">*</span></label>${empSelect(p)}</div>`
          : `<div class="grid two"><div class="field"><label>Full name <span class="req">*</span></label><input class="input" data-f="name" value="${esc(p.name)}" autocomplete="off" /></div><div class="field"><label>Company / organisation</label><input class="input" data-f="organization" value="${esc(p.organization)}" autocomplete="off" /></div></div>`}
        ${signatures ? `<div class="row between" style="margin-top:12px">${p.signature ? `<div class="row"><img class="sig-img" src="${p.signature}" alt="Signature of ${esc(p.name)}" /><span class="badge b-ok">${icon("check")} Signed ${esc(fmtDateTime(new Date(p.signed_at)))}</span></div>` : `<span class="badge b-pending">Signature missing</span>`}<button type="button" class="btn ${p.signature ? "btn-outline" : "btn-blue"} btn-sm" data-sign>${p.signature ? "Re-sign" : "Collect signature"}</button></div>` : ""}
      </div>`).join("") : `<p class="muted small">${esc(emptyText)}</p>`)
      + `<button type="button" class="btn btn-outline btn-block" data-add style="margin-top:12px">${icon("plus")} Add passenger</button>`;

    box.querySelectorAll(".passenger").forEach((el) => {
      const p = list[+el.dataset.i];
      el.querySelector("[data-rm]").addEventListener("click", () => {
        if (p.signature && !confirm("Remove this signed passenger?")) return;
        list.splice(list.indexOf(p), 1); draw(); onChange();
      });
      el.querySelectorAll("[data-type]").forEach((b) => b.addEventListener("click", () => {
        if ((p.type === "hrid") === (b.dataset.type === "hrid")) return;
        Object.assign(p, { type: b.dataset.type, user_id: null, name: "", employee_no: "", department: "", organization: "", signature: null, signed_at: null });
        draw(); onChange();
        box.querySelectorAll(".passenger")[list.indexOf(p)]?.querySelector("select,input")?.focus();
      }));
      el.querySelector("[data-emp]")?.addEventListener("change", (e) => {
        const emp = employees.find((x) => x.id === e.target.value);
        Object.assign(p, { user_id: emp?.id || null, name: emp?.full_name || "", employee_no: emp?.employee_no || "", department: emp?.department || "", signature: null, signed_at: null });
        if (signatures) draw();
        onChange();
      });
      el.querySelectorAll("[data-f]").forEach((inp) => inp.addEventListener("input", () => { p[inp.dataset.f] = inp.value; onChange(); }));
      el.querySelector("[data-sign]")?.addEventListener("click", () => collectSignature(p, draw));
    });
    box.querySelector("[data-add]").addEventListener("click", () => {
      list.push(newPax(allowHRID ? "hrid" : "external")); draw(); onChange();
      box.querySelectorAll(".passenger")[list.length - 1]?.querySelector("select,input")?.focus();
    });
  };
  draw();
  return { redraw: draw };
}

// Clear a field's error message as soon as the user edits it.
const clearErr = (e) => {
  const t = e.target;
  if (!(t instanceof Element)) return;
  if (t.name) {
    t.classList.remove("invalid");
    const form = t.closest("form");
    const m = form?.querySelector(`[data-err="${t.name}"]`);
    if (m) m.textContent = "";
  }
  const scoped = t.closest("#stops") ? "stops" : t.closest("#pax") ? "passengers" : null;
  if (scoped) { const m = t.closest("form")?.querySelector(`[data-err="${scoped}"]`); if (m) m.textContent = ""; }
};
document.addEventListener("input", clearErr);
document.addEventListener("change", clearErr);
