export class SignaturePad {
  constructor(canvas, onChange) {
    this.c = canvas; this.onChange = onChange; this.ink = false; this.drawing = false;
    const r = canvas.getBoundingClientRect(), ratio = window.devicePixelRatio || 1;
    canvas.width = r.width * ratio; canvas.height = r.height * ratio;
    this.ctx = canvas.getContext("2d"); this.ctx.scale(ratio, ratio);
    Object.assign(this.ctx, { lineWidth: 2.4, lineCap: "round", lineJoin: "round", strokeStyle: "#0B3A5C" });
    const pt = (e) => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    canvas.addEventListener("pointerdown", (e) => { e.preventDefault(); canvas.setPointerCapture(e.pointerId); this.drawing = true; const [x, y] = pt(e); this.ctx.beginPath(); this.ctx.moveTo(x, y); this.ctx.lineTo(x + 0.1, y + 0.1); this.ctx.stroke(); this.ink = true; onChange?.(); });
    canvas.addEventListener("pointermove", (e) => { if (!this.drawing) return; const [x, y] = pt(e); this.ctx.lineTo(x, y); this.ctx.stroke(); });
    const end = () => (this.drawing = false);
    canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);
  }
  isEmpty() { return !this.ink; }
  clear() { this.ctx.clearRect(0, 0, this.c.width, this.c.height); this.ink = false; }
  toDataURL() {
    // White background so signatures are visible in PDFs/prints.
    const out = document.createElement("canvas"); out.width = this.c.width; out.height = this.c.height;
    const o = out.getContext("2d"); o.fillStyle = "#fff"; o.fillRect(0, 0, out.width, out.height); o.drawImage(this.c, 0, 0);
    return out.toDataURL("image/jpeg", 0.7);
  }
}
