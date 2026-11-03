// Data layer: Supabase (shared, production) when configured, otherwise localStorage (demo).
const cfg = window.HRID_CONFIG || {};
export const MODE = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY ? "supabase" : "local";

const local = {
  read(t) { try { return JSON.parse(localStorage.getItem("hrid_" + t) || "[]"); } catch { return []; } },
  write(t, rows) {
    try { localStorage.setItem("hrid_" + t, JSON.stringify(rows)); }
    catch { alert("Device storage is full. Connect Supabase (see README) to store more trips."); throw new Error("Storage full"); }
  },
  async list(t) { return this.read(t); },
  async get(t, id) { return this.read(t).find((r) => r.id === id) || null; },
  async insert(t, row) { const rows = this.read(t); rows.push(row); this.write(t, rows); return row; },
  async update(t, id, patch) { const rows = this.read(t); const i = rows.findIndex((r) => r.id === id); if (i < 0) throw new Error("Record not found"); rows[i] = { ...rows[i], ...patch }; this.write(t, rows); return rows[i]; },
};

// Each table stores the full record as JSON in a `data` column (see supabase/schema.sql).
const base = (cfg.SUPABASE_URL || "").replace(/\/$/, "") + "/rest/v1/";
const headers = { apikey: cfg.SUPABASE_ANON_KEY, Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}`, "Content-Type": "application/json" };
async function req(path, opts = {}) {
  const r = await fetch(base + path, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
  if (!r.ok) {
    const text = await r.text();
    if (r.status === 404 && /relation|does not exist|Could not find the table/i.test(text)) throw new Error("A database table is missing. Run supabase/schema.sql again in the Supabase SQL Editor.");
    throw new Error(`Database error ${r.status}: ${text}`);
  }
  if (r.status === 204 || r.status === 201) return null;
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
const supa = {
  async list(t) { return ((await req(`${t}?select=data&limit=10000`)) || []).map((r) => r.data); },
  async get(t, id) { const r = await req(`${t}?select=data&id=eq.${encodeURIComponent(id)}`); return r?.[0]?.data || null; },
  async insert(t, row) { await req(t, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ id: row.id, data: row }) }); return row; },
  async update(t, id, patch) {
    const cur = await this.get(t, id); if (!cur) throw new Error("Record not found");
    const next = { ...cur, ...patch };
    await req(`${t}?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ data: next }) });
    return next;
  },
};
export const db = MODE === "supabase" ? supa : local;
