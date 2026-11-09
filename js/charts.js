// Dependency-free charts for reports (work offline, print well, scale on phones).
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const PALETTE = ["#0B5664", "#00A651", "#D69E2E", "#C53030", "#2B6CB0", "#805AD5", "#DD6B20", "#38A169", "#718096", "#D53F8C"];
const nice = (max) => { if (max <= 5) return 5; const p = 10 ** Math.floor(Math.log10(max)); for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= max) return m * p; return 10 * p; };
const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const empty = (msg) => `<div class="chart-empty">${esc(msg)}</div>`;

/** Vertical bars. data = [{label, value}] */
export function columnChart(data, { title = "", color = PALETTE[0], emptyText = "No data for this month." } = {}) {
  if (!data.length || data.every((d) => !d.value)) return empty(emptyText);
  const W = data.length > 12 ? 840 : 420, H = 230, L = 30, R = 6, T = 18, B = 30;
  const max = nice(Math.max(...data.map((d) => d.value)));
  const bw = (W - L - R) / data.length, step = Math.ceil(data.length / 16);
  const y = (v) => T + (H - T - B) * (1 - v / max);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
    ${[0, max / 2, max].map((t) => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="#E2E8F0"/><text x="${L - 5}" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join("")}
    ${data.map((d, i) => { const x = L + i * bw + bw * 0.15, w = bw * 0.7;
      return `<g><title>${esc(d.label)}: ${fmt(d.value)}</title><rect x="${x}" y="${y(d.value)}" width="${w}" height="${Math.max(0, (H - T - B) * (d.value / max))}" rx="2" fill="${d.color || color}"/>
      ${d.value && data.length <= 12 ? `<text class="val" x="${x + w / 2}" y="${y(d.value) - 4}" text-anchor="middle">${fmt(d.value)}</text>` : ""}
      ${i % step === 0 ? `<text x="${x + w / 2}" y="${H - B + 16}" text-anchor="middle">${esc(d.label)}</text>` : ""}</g>`; }).join("")}
  </svg>`;
}

/** Horizontal bars (HTML) – readable on phones, works right-to-left. */
export function barChart(data, { title = "", color = PALETTE[0], unit = "", max: fixedMax = null, emptyText = "No data for this month." } = {}) {
  if (!data.length || data.every((d) => !d.value)) return empty(emptyText);
  const max = fixedMax || Math.max(...data.map((d) => d.value)) || 1;
  return `<div class="hbars" role="img" aria-label="${esc(title)}">${data.map((d) => `
    <div class="hbar" title="${esc(d.label)}: ${fmt(d.value)}${esc(unit)}">
      <span class="hbar-label">${esc(d.label)}</span>
      <span class="hbar-track"><span class="hbar-fill" style="width:${Math.min(100, (d.value / max) * 100)}%;background:${d.color || color}"></span></span>
      <span class="hbar-val">${fmt(d.value)}${esc(unit)}</span>
    </div>`).join("")}</div>`;
}

/** Donut with legend. data = [{label, value, color?}] */
export function donutChart(data, { title = "", emptyText = "No data for this month." } = {}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return empty(emptyText);
  const R = 70, r = 42, C = 90;
  let a = -Math.PI / 2;
  const arcs = data.map((d, i) => ({ ...d, color: d.color || PALETTE[i % PALETTE.length] })).filter((d) => d.value).map((d) => {
    const frac = d.value / total;
    if (frac >= 0.9999) return `<g><title>${esc(d.label)}: ${d.value}</title><circle cx="${C}" cy="${C}" r="${(R + r) / 2}" fill="none" stroke="${d.color}" stroke-width="${R - r}"/></g>`;
    const a2 = a + frac * 2 * Math.PI, large = frac > 0.5 ? 1 : 0;
    const p = (ang, rad) => `${C + rad * Math.cos(ang)},${C + rad * Math.sin(ang)}`;
    const path = `M${p(a, R)} A${R},${R} 0 ${large} 1 ${p(a2, R)} L${p(a2, r)} A${r},${r} 0 ${large} 0 ${p(a, r)} Z`;
    a = a2;
    return `<g><title>${esc(d.label)}: ${d.value}</title><path d="${path}" fill="${d.color}"/></g>`;
  }).join("");
  return `<div class="row" style="gap:18px;align-items:center">
    <svg class="chart" viewBox="0 0 180 180" style="max-width:170px" role="img" aria-label="${esc(title)}">${arcs}
      <text x="${C}" y="${C - 2}" text-anchor="middle" style="font-size:24px;font-weight:700;fill:#2D3748">${total}</text>
      <text x="${C}" y="${C + 16}" text-anchor="middle">Total</text></svg>
    <div class="legend" style="flex-direction:column">${data.map((d, i) => `<span><i style="background:${d.color || PALETTE[i % PALETTE.length]}"></i>${esc(d.label)}: <b>${d.value}</b></span>`).join("")}</div>
  </div>`;
}
