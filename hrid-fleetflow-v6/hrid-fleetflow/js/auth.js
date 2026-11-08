// Sign-in, first-time setup, forced password change and employee CSV import.
import { db } from "./store.js";
import { icon } from "./icons.js";
import { app, state, hooks, session, go, router, langCorner } from "./core.js";
import { esc, uid, norm, toast, field, readForm, validate } from "./ui.js";

export async function hash(password, salt) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${password}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function passwordRules(d) {
  if (d.password.length < 8) return { password: "At least 8 characters" };
  if (/^\d+$/.test(d.password)) return { password: "Use letters and numbers – not only digits (not your birthday)" };
  if (d.password !== d.password2) return { password2: "Passwords do not match" };
  return {};
}

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
export async function importUsersCSV(file, done) {
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

/* ---------------- screens ---------------- */
hooks.setup = () => {
  app.innerHTML = `<div class="auth">${langCorner()}<form class="card stack" id="setup" novalidate>
    <div class="brand"><img src="assets/logo.png" alt="" /><div><h2 style="font-size:19px">HRID FleetFlow</h2><p class="muted small">First-time setup</p></div></div>
    <label class="btn btn-blue btn-block" for="setup-csv">${icon("users")} Import employees from CSV</label>
    <input id="setup-csv" type="file" accept=".csv,text/csv" hidden />
    <p class="muted small">Passwords are set to each person's date of birth (DDMMYYYY) and must be changed at first sign-in.</p>
    <div class="muted small" style="text-align:center">— or create one administrator manually —</div>
    ${field("full_name", "Full name", { required: true })}
    <div class="grid two">${field("employee_no", "Employee number", { required: true })}${field("email", "Email", { type: "email" })}</div>
    ${field("password", "Password", { type: "password", required: true, attrs: 'autocomplete="new-password"' })}
    ${field("password2", "Confirm password", { type: "password", required: true, attrs: 'autocomplete="new-password"' })}
    <button class="btn btn-primary btn-block" type="submit">Create administrator</button>
  </form></div>`;
  document.getElementById("setup-csv").addEventListener("change", (e) => importUsersCSV(e.target.files[0], () => { toast("Employees imported – please sign in"); router(); }));
  document.getElementById("setup").addEventListener("submit", async (e) => {
    e.preventDefault(); const f = e.target;
    if (!validate(f, passwordRules)) return;
    const d = readForm(f), salt = uid();
    const u = await db.insert("users", { id: uid(), full_name: d.full_name, username: norm(d.full_name), employee_no: d.employee_no, email: d.email.toLowerCase(), role: "admin", salt, password_hash: await hash(d.password, salt), active: true, created_at: new Date().toISOString() });
    session.set(u); toast("Administrator created"); go("/");
  });
};

hooks.login = () => {
  app.innerHTML = `<div class="auth">${langCorner()}<form class="card stack" id="login" novalidate>
    <div class="brand"><img src="assets/logo.png" alt="" /><div><h2 style="font-size:19px">HRID FleetFlow</h2><p class="muted small">Company transport</p></div></div>
    ${field("username", "Employee number or email", { required: true, attrs: 'autocomplete="username" inputmode="email"' })}
    ${field("password", "Password", { type: "password", required: true, attrs: 'autocomplete="current-password"' })}
    <div class="err-text" id="login-err" role="alert"></div>
    <button class="btn btn-primary btn-block btn-lg" type="submit">Sign in</button>
    <p class="muted small">First time? Your password is your date of birth as DDMMYYYY (for example 08/09/2003 → 08092003). You will be asked to change it.</p>
    <p class="muted small" style="text-align:center">Hiwa Rauf for Investment & Development</p>
  </form></div>`;
  document.getElementById("login").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate(e.target)) return;
    const d = readForm(e.target);
    const key = norm(d.username).replace(/^#/, "");
    const u = (await db.list("users")).find((x) => x.active !== false && (String(x.employee_no || "").toLowerCase() === key || norm(x.email) === key || x.username === key));
    if (!u || (await hash(d.password, u.salt)) !== u.password_hash) { document.getElementById("login-err").textContent = "Incorrect employee number/email or password."; return; }
    session.set(u); go("/");
  });
};

hooks.forceChange = () => {
  app.innerHTML = `<div class="auth">${langCorner()}<form class="card stack" id="fc" novalidate>
    <div class="brand"><img src="assets/logo.png" alt="" /><div><h2 style="font-size:19px">Welcome, <span data-no-tr>${esc(state.user.full_name)}</span></h2><p class="muted small">Please choose your own password to continue.</p></div></div>
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
    await db.update("users", state.user.id, { salt, password_hash: await hash(f.password.value, salt), must_change_password: false });
    toast("Password saved"); go("/");
  });
};
