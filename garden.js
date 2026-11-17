// Eric Carle–style collage, generated in code: acrylic washes and dry-brush streaks on tissue,
// cut into simple shapes with scissors and pasted flat on a white page.
import { WING } from './shape.js';
import { artSrc } from './art.js';
const TAU = Math.PI * 2;
let seed = 11;
const R = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rr = (a, b) => a + R() * (b - a);
const pick = (a) => a[Math.floor(R() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

// base, soft washes, hairline streak tones, contrasting streaks, and small flat patches
const PAPERS = {
  green:   { base: '#3f9640', wash: ['#2c7a35', '#5aae45', '#1f6a55', '#7fbf4a'], tones: ['#2a7a33', '#4fa043', '#1e5f3f', '#6db64a'], streak: ['#c9dc4a', '#14402c', '#2a7ad0', '#f2d23a'] },
  dkgreen: { base: '#276b45', wash: ['#17523a', '#2f7f50', '#1f5f6a', '#3a8a4a'], tones: ['#1a5a3c', '#2f7a4c', '#0f4436'], streak: ['#6fb04a', '#0a2e26', '#3a7ab0', '#9ad04a'] },
  lgreen:  { base: '#8cc440', wash: ['#a8d43c', '#6aaa30', '#c6dc48', '#5a9e38'], tones: ['#7ab838', '#a2d040', '#5f9f30'], streak: ['#e6e050', '#3f8a30', '#f6c615', '#2a9a8a'] },
  teal:    { base: '#23807a', wash: ['#1a6a6a', '#2f9a8a', '#1f5a7a', '#3aa080'], tones: ['#1a6a64', '#2a8a7a'], streak: ['#9ad04a', '#0f3f4a', '#3a6ad8', '#d8e860'] },
  leafL:   { base: '#4cb03e', wash: ['#3a9a36', '#68c24a', '#46a83a', '#7ccf55'], tones: ['#3f9f3a', '#5cb846'], streak: ['#a6d84a', '#2f7f30'], patch: ['#d9c247', '#a99ad0'] },
  leafD:   { base: '#318533', wash: ['#1f5a22', '#3a6a1e', '#4a9a35', '#2a6a2a', '#5a7a22'], tones: ['#2a6e2a', '#3d8a35', '#1e5a25'], streak: ['#7ab040', '#163f1a'], patch: ['#c9b84a'] },
  yellow:  { base: '#f6c615', wash: ['#ffd93a', '#f0a810', '#fde96a'], tones: ['#f2b812', '#ffe060'], streak: ['#e88a10', '#fff4a0', '#9ac83a', '#f26a1a'] },
  gold:    { base: '#f5a514', wash: ['#ffc030', '#e88610', '#f9cf48'], tones: ['#ee9a14', '#ffc23a'], streak: ['#d85a10', '#ffe880', '#c8301a'] },
  orange:  { base: '#ef7016', wash: ['#f79226', '#dc4e10', '#ffaa30'], tones: ['#e8641a', '#f88a28'], streak: ['#ffd040', '#b8380e', '#e02a5a', '#ffe680'] },
  red:     { base: '#d92a1c', wash: ['#ec4a24', '#b0141a', '#f06a2c', '#c01e1e'], tones: ['#c82018', '#e84024'], streak: ['#8a0e14', '#f88a40', '#d02a7a', '#ffc23a'] },
  berry:   { base: '#d2321f', wash: ['#e04a2a', '#b0201a', '#e8603a', '#a01a1a'], tones: ['#c42a1c', '#e0482a', '#a81e16', '#ea6a3a'], streak: ['#6a2014', '#e08a5a'] },
  magenta: { base: '#cf2f84', wash: ['#e45aa2', '#a62068', '#d84090'], tones: ['#b82576', '#e868a8'], streak: ['#6a2290', '#ffb0d6', '#f05a2a', '#2a3ab0'] },
  blue:    { base: '#2050bc', wash: ['#3878de', '#14398f', '#2a62d0'], tones: ['#1a46a8', '#3a74d8'], streak: ['#0b2a66', '#8cc0f0', '#2ab0c0', '#7a3ac0'] },
  plum:    { base: '#2a3fae', wash: ['#1a2a8a', '#3a5ad0', '#25307a', '#4a3a9a'], tones: ['#203aa0', '#3a5ac8', '#18287a'], streak: ['#6a8af0', '#0f1a50'], patch: ['#5a3a9a'] },
  violet:  { base: '#6a3aa0', wash: ['#8655c0', '#4a2480', '#9a60c8'], tones: ['#5a2e90', '#8a58c0'], streak: ['#2f5ab0', '#d68ae0', '#d0307a', '#1a1a6a'] },
  brown:   { base: '#7a4a22', wash: ['#99612e', '#5a3214', '#8a5428'], tones: ['#6a3c1a', '#9a6230', '#4a2a10'], streak: ['#2f1a08', '#c08a48', '#6a7a2a', '#a0401a'] },
  pear:    { base: '#6aaa36', wash: ['#5a8a2a', '#7aba3a', '#6a5a22', '#4a7a2a', '#8ac040', '#5a4a20'], tones: ['#5a9a30', '#7ab83a', '#4a6a28'], streak: ['#3a2a12', '#b8d04a'], patch: ['#7a4a20'] },
  sky:     { base: '#9fd2ee', wash: ['#c0e4f6', '#78bce6', '#e0f2fa'], tones: ['#86c6ea', '#b8e0f4', '#5aaade'], streak: ['#ffffff', '#3a8ad0', '#c6e8f8', '#7ac0e0'] },
};

// Dry brush: a band of hairline bristle marks along a curve, ragged ends, broken by dry gaps.
function hairs(g, x0, y0, cx, cy, x1, y1, sw, color, alpha, u) {
  let nx = y0 - y1, ny = x1 - x0; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
  const nb = clamp(Math.round(sw / (1.7 * u)), 3, 28);
  const q = (t, o) => { const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; return [a * x0 + b * cx + c * x1 + nx * o, a * y0 + b * cy + c * y1 + ny * o]; };
  g.strokeStyle = color; g.lineCap = 'round';
  for (let j = 0; j < nb; j++) {
    const o = rr(-0.5, 0.5) * sw, s = rr(0, 0.3), e = rr(0.65, 1);
    const [ax, ay] = q(s, o), [bx, by] = q(e, o), [mx, my] = q((s + e) / 2, o);
    g.globalAlpha = alpha * rr(0.25, 1);
    g.lineWidth = rr(0.6, 2.2) * u;
    g.setLineDash(R() < 0.3 ? [rr(20, 140) * u, rr(3, 25) * u] : []);
    g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo(2 * mx - (ax + bx) / 2, 2 * my - (ay + by) / 2, bx, by); g.stroke();
  }
  g.setLineDash([]); g.globalAlpha = 1;
}

// Hand-painted tissue, one seamless tile per paper, generated once: wet washes, bold brushwork,
// contrasting dry-brush streaks, combed lines, sponge stipple, spatter and paper grain.
const TEX = {}, TILE = 512;
function tissueTile(key) {
  const P = PAPERS[key], T = TILE, c = mk(T, T), g = c.getContext('2d'), keep = seed;
  seed = [...key].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 7);
  // draw a mark, repeated across the edges it crosses so the tile wraps without seams
  const wrap = (x, y, r, fn) => {
    const xs = [0, ...(x - r < 0 ? [T] : []), ...(x + r > T ? [-T] : [])], ys = [0, ...(y - r < 0 ? [T] : []), ...(y + r > T ? [-T] : [])], s0 = seed;
    let s1 = s0;
    for (const ox of xs) for (const oy of ys) { seed = s0; g.save(); g.translate(ox, oy); fn(); g.restore(); s1 = seed; }
    seed = s1;
  };
  const band = (sw, col, alpha, lMin, lMax) => {
    const cx = rr(0, T), cy = rr(0, T), a = rr(-0.3, 0.3), len = rr(lMin, lMax), dx = (Math.cos(a) * len) / 2, dy = (Math.sin(a) * len) / 2, bend = (R() < 0.25 ? rr(-0.45, 0.45) : rr(-0.12, 0.12)) * len;
    wrap(cx, cy, len / 2 + sw, () => hairs(g, cx - dx, cy - dy, cx - Math.sin(a) * bend, cy + Math.cos(a) * bend, cx + dx, cy + dy, sw, col, alpha, 1));
  };
  g.fillStyle = P.base; g.fillRect(0, 0, T, T);
  g.filter = 'blur(14px)';
  for (let i = 0; i < 26; i++) { const cx = rr(0, T), cy = rr(0, T), rx = rr(50, 170), ry = rx * rr(0.25, 0.6), a = rr(-0.4, 0.4), col = pick(P.wash), al = rr(0.3, 0.6); wrap(cx, cy, rx + 30, () => { g.globalAlpha = al; g.fillStyle = col; g.beginPath(); g.ellipse(cx, cy, rx, ry, a, 0, TAU); g.fill(); }); }
  g.filter = 'none'; g.globalAlpha = 1;
  for (let i = 0; i < 70; i++) band(rr(18, 46), pick(R() < 0.7 ? P.tones : P.wash), rr(0.45, 0.85), 140, 400);
  for (let i = 0; i < 40; i++) band(rr(5, 15), pick(P.streak), rr(0.6, 0.95), 80, 320);
  // loaded-brush ribbons: opaque wavy strokes with ragged, thinning ends
  for (let i = 0; i < 14; i++) {
    const cx = rr(0, T), cy = rr(0, T), a = rr(-0.25, 0.25), len = rr(120, 340), wd = rr(6, 18), col = pick(R() < 0.5 ? P.streak : P.wash), al = rr(0.55, 0.9), ph = rr(0, TAU), amp = rr(3, 14);
    wrap(cx, cy, len / 2 + wd + amp, () => {
      const pts = [], m = 24, ca = Math.cos(a), sa = Math.sin(a);
      for (let j = 0; j <= m; j++) { const t = j / m, along = (t - 0.5) * len, off = Math.sin(t * 5 + ph) * amp, hw = (wd / 2) * Math.pow(Math.sin(Math.PI * t), 0.4) * rr(0.8, 1.15); pts.push([along, off - hw, off + hw]); }
      const path = new Path2D(); pts.forEach(([x, y0], j) => { const X = cx + x * ca - y0 * sa, Y = cy + x * sa + y0 * ca; j ? path.lineTo(X, Y) : path.moveTo(X, Y); });
      for (let j = pts.length - 1; j >= 0; j--) { const [x, , y1] = pts[j]; path.lineTo(cx + x * ca - y1 * sa, cy + x * sa + y1 * ca); }
      g.globalAlpha = al; g.fillStyle = col; g.fill(path); g.globalAlpha = 1;
      hairs(g, cx - (ca * len) / 2, cy - (sa * len) / 2, cx, cy, cx + (ca * len) / 2, cy + (sa * len) / 2, wd * 0.8, pick(P.tones), 0.35, 1);
    });
  }
  for (let k = 0; k < 4; k++) {
    const cx = rr(0, T), cy = rr(0, T), len = rr(90, 240), n = 5 + Math.floor(R() * 5), sp = rr(4, 7), col = pick(P.streak.concat(P.wash)), ph = rr(0, TAU), amp = rr(2, 9), al = rr(0.3, 0.55);
    wrap(cx, cy, len / 2 + n * sp, () => { g.strokeStyle = col; g.lineWidth = rr(1, 2); g.globalAlpha = al; g.lineCap = 'round'; for (let j = 0; j < n; j++) { g.beginPath(); for (let t = 0; t <= len; t += 6) { const px = cx - len / 2 + t, py = cy + j * sp + Math.sin(t / 30 + ph) * amp; t ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); } });
  }
  // scraped highlights: a lighter mix of the base dragged across with a dry brush
  const lite = (hex, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - k) + 255 * k).toString(16).padStart(2, '0')).join('');
  for (let i = 0; i < 10; i++) band(rr(10, 26), lite(P.base, rr(0.2, 0.4)), rr(0.2, 0.4), 120, 360);
  for (let i = 0; i < 10; i++) band(rr(10, 26), pick(P.tones), rr(0.5, 0.8), 100, 260);
  for (let k = 0; k < 4; k++) {
    const cx = rr(0, T), cy = rr(0, T), r = rr(25, 60), col = pick(P.wash.concat(P.streak));
    wrap(cx, cy, r, () => { g.fillStyle = col; for (let j = 0; j < 70; j++) { const a = rr(0, TAU), d = r * Math.sqrt(R()); g.globalAlpha = rr(0.25, 0.6); g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rr(0.8, 2.6), 0, TAU); g.fill(); } });
  }
  for (let i = 0; i < 150; i++) { const cx = rr(0, T), cy = rr(0, T), r = R() < 0.08 ? rr(3, 6) : rr(0.6, 2.4), col = pick(P.streak.concat(P.wash)), al = rr(0.5, 0.9); wrap(cx, cy, r, () => { g.globalAlpha = al; g.fillStyle = col; g.beginPath(); g.ellipse(cx, cy, r, r * rr(0.6, 1), rr(0, TAU), 0, TAU); g.fill(); }); }
  g.globalAlpha = 1;
  g.filter = 'blur(22px)';
  for (let i = 0; i < 30; i++) { const cx = rr(0, T), cy = rr(0, T), r = rr(40, 120), col = R() < 0.5 ? '#000' : '#fff', al = rr(0.04, 0.09); wrap(cx, cy, r + 40, () => { g.globalAlpha = al; g.fillStyle = col; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill(); }); }
  g.filter = 'none'; g.globalAlpha = 1;
  const im = g.getImageData(0, 0, T, T), d = im.data;
  for (let p = 0; p < d.length; p += 4) { const n = rr(-5, 5); d[p] += n; d[p + 1] += n; d[p + 2] += n; }
  g.putImageData(im, 0, 0);
  seed = keep;
  return c;
}
const tex = (key) => (TEX[key] ||= tissueTile(key));
export function loadTextures() { return Promise.resolve(0); }
function texFill(g, x, y, w, h, key, dir, u, o) {
  const img = tex(key), pat = g.createPattern(img, 'repeat'), sc = u * 1.25 * (o.texScale || 1);
  pat.setTransform(new DOMMatrix().translateSelf(x + rr(0, img.width * sc), y + rr(0, img.height * sc)).rotateSelf(((dir + rr(-0.25, 0.25)) * 180) / Math.PI).scaleSelf(sc));
  g.fillStyle = pat; g.fillRect(x, y, w, h);
}

// Paint a sheet of tissue over a rect: the paper's tile, plus a few loose strokes so repeats don't show.
function paint(g, x, y, w, h, key, dir, u, o = {}) {
  const P = PAPERS[key];
  texFill(g, x, y, w, h, key, dir, u, o);
  const sw0 = clamp(Math.min(w, h) * 0.3, 8 * u, 30 * u), L0 = Math.min(Math.max(w, h) * 0.9, 240 * u);
  const n = clamp(Math.round((w * h) / (sw0 * L0 * 1.2)), 1, 120);
  for (let i = 0; i < n; i++) { const cx = rr(x, x + w), cy = rr(y, y + h), a = (o.radial ? Math.atan2(cy - o.radial[1], cx - o.radial[0]) + Math.PI / 2 : dir) + rr(-0.3, 0.3), len = L0 * rr(0.5, 1.1), dx = (Math.cos(a) * len) / 2, dy = (Math.sin(a) * len) / 2; hairs(g, cx - dx, cy - dy, cx, cy, cx + dx, cy + dy, sw0 * rr(0.5, 1.2), pick(R() < 0.8 ? P.tones : P.streak), rr(0.2, 0.45), u); }
  if (P.patch && !o.noPatch) {
    const np = Math.round(((w * h) / (160 * u) ** 2) * 0.8);
    for (let i = 0; i < np; i++) { const cx = rr(x, x + w), cy = rr(y, y + h), s = rr(6, 22) * u, pts = []; for (let j = 0; j < 5; j++) { const a = (j / 5) * TAU + rr(-0.3, 0.3); pts.push([cx + Math.cos(a) * s * rr(0.5, 1.4), cy + Math.sin(a) * s * rr(0.4, 1)]); } g.globalAlpha = rr(0.5, 0.85); g.fillStyle = pick(P.patch); g.fill(poly(pts)); }
    g.globalAlpha = 1;
  }
  if (o.mottle) {
    const m = clamp(Math.round((w * h) / (14 * u) ** 2), 20, 900);
    for (let i = 0; i < m; i++) { g.globalAlpha = rr(0.12, 0.35); g.fillStyle = pick(P.wash.concat(P.streak)); g.beginPath(); g.ellipse(rr(x, x + w), rr(y, y + h), rr(2, 6) * u, rr(1.5, 4) * u, rr(0, TAU), 0, TAU); g.fill(); }
    g.globalAlpha = 1;
  }
}

// Paste a cut piece: faint pasted shadow, then the painted paper clipped to the cut.
function paste(g, path, key, dir, u, b, o = {}) {
  g.save(); g.shadowColor = 'rgba(70,45,15,.18)'; g.shadowBlur = 2.5 * u; g.shadowOffsetY = 1.2 * u; g.fillStyle = PAPERS[key].base; g.fill(path); g.restore();
  g.save(); g.clip(path); paint(g, b[0], b[1], b[2], b[3], key, dir, u, o); if (o.pattern) o.pattern(g, b, u); g.restore();
}

// Shapes: slightly faceted and wobbly, like scissor cuts.
const poly = (pts, p = new Path2D()) => { pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; };
const smooth = (pts, p = new Path2D()) => { const n = pts.length, m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; const s = m(pts[n - 1], pts[0]); p.moveTo(s[0], s[1]); for (let i = 0; i < n; i++) { const a = pts[i], c = m(a, pts[(i + 1) % n]); p.quadraticCurveTo(a[0], a[1], c[0], c[1]); } p.closePath(); return p; };
const blob = (cx, cy, rx, ry, amt = 0.05, rot = 0, n = 30, p) => { const p1 = rr(0, TAU), p2 = rr(0, TAU), cr = Math.cos(rot), sr = Math.sin(rot), pts = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU, k = 1 + amt * (Math.sin(a * 2 + p1) * 0.5 + Math.sin(a * 3 + p2) * 0.5 + rr(-0.4, 0.4)), x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k; pts.push([cx + x * cr - y * sr, cy + x * sr + y * cr]); } return smooth(pts, p); };
const box = (cx, cy, r) => [cx - r, cy - r, r * 2, r * 2];
function leafPts(x, y, L, W, rot, j = 0.04) {
  const n = 16, top = [], bot = [], c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i <= n; i++) { const t = i / n, hw = W * Math.pow(Math.sin(Math.PI * t), 0.75) * (1 - 0.3 * t); top.push([t * L, -hw * (1 + rr(-j, j))]); bot.push([t * L, hw * (1 + rr(-j, j))]); }
  return top.concat(bot.reverse().slice(1, -1)).map(([px, py]) => [x + px * c - py * s, y + px * s + py * c]);
}
const leaf = (x, y, L, W, rot, j) => smooth(leafPts(x, y, L, W, rot, j));
function strip(x0, y0, x1, y1, bend, w0, w1) {
  const n = 14, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, a = [], b = [];
  for (let i = 0; i <= n; i++) { const t = i / n, bx = x0 + dx * t + nx * bend * Math.sin(Math.PI * t), by = y0 + dy * t + ny * bend * Math.sin(Math.PI * t), w = ((w0 + (w1 - w0) * t) / 2) * (1 + rr(-0.07, 0.07)); a.push([bx + nx * w, by + ny * w]); b.push([bx - nx * w, by - ny * w]); }
  return poly(a.concat(b.reverse()));
}

// Printed patterns for the letters, after the alphabet papers.
const PAT = {
  dots: (cols, s) => (g, [x, y, w, h], u) => { const st = s * u; let row = 0; for (let yy = y; yy < y + h + st; yy += st * 0.85, row++) for (let xx = x + (row % 2) * st * 0.5; xx < x + w + st; xx += st) { g.fillStyle = pick(cols); g.globalAlpha = rr(0.8, 1); g.beginPath(); g.ellipse(xx + rr(-0.25, 0.25) * st, yy + rr(-0.25, 0.25) * st, st * rr(0.18, 0.34), st * rr(0.15, 0.3), rr(0, TAU), 0, TAU); g.fill(); } g.globalAlpha = 1; },
  grain: (cols, s) => (g, [x, y, w, h], u) => { const st = s * u; g.lineCap = 'round'; for (let xx = x - st; xx < x + w + st; xx += st * rr(0.5, 1.2)) { g.strokeStyle = pick(cols); g.lineWidth = st * rr(0.1, 0.4); g.globalAlpha = rr(0.75, 1); const ph = rr(0, TAU), amp = st * rr(0.1, 0.35), fr = rr(0.5, 1.4) / st; g.beginPath(); for (let yy = y; yy <= y + h; yy += 4 * u) { const xv = xx + Math.sin(yy * fr + ph) * amp; yy === y ? g.moveTo(xv, yy) : g.lineTo(xv, yy); } g.stroke(); if (R() < 0.5) { g.lineWidth = st * 0.1; g.beginPath(); g.arc(xx + st * 0.3, rr(y, y + h), st * rr(0.15, 0.3), rr(0, 3), rr(3.5, 6.5)); g.stroke(); } } g.globalAlpha = 1; },
  blooms: (cols, s) => (g, [x, y, w, h], u) => { const st = s * u, n = Math.round(((w * h) / (st * st)) * 2.2); for (let i = 0; i < n; i++) { const cx = rr(x, x + w), cy = rr(y, y + h), r = st * rr(0.1, 0.18), col = pick(cols); g.globalAlpha = rr(0.85, 1); if (R() < 0.55) { g.fillStyle = col; for (let p = 0; p < 5; p++) { const a = (p / 5) * TAU; g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, r * 0.75, 0, TAU); g.fill(); } g.fillStyle = pick(cols); g.beginPath(); g.arc(cx, cy, r * 0.55, 0, TAU); g.fill(); } else { g.fillStyle = col; g.beginPath(); g.arc(cx, cy, r * 0.5, 0, TAU); g.fill(); } } g.globalAlpha = 1; },
  scribble: (cols, s) => (g, [x, y, w, h], u) => { const st = s * u, n = Math.round(((w * h) / (st * st)) * 0.35); g.lineCap = g.lineJoin = 'round'; for (let i = 0; i < n; i++) { let px = rr(x, x + w), py = rr(y, y + h), a = rr(0, TAU); g.strokeStyle = pick(cols); g.lineWidth = rr(2.5, 5) * u; g.globalAlpha = rr(0.55, 0.9); g.beginPath(); g.moveTo(px, py); for (let k = 0; k < 14; k++) { a += rr(-0.5, 0.5); px += Math.cos(a) * st * 0.25; py += Math.sin(a) * st * 0.25; g.lineTo(px, py); } g.stroke(); } g.globalAlpha = 1; },
  dashes: (cols, s) => (g, [x, y, w, h], u) => { const st = s * u, n = Math.round(((w * h) / (st * st)) * 2.4); g.lineCap = 'round'; for (let i = 0; i < n; i++) { const cx = rr(x, x + w), cy = rr(y, y + h), a = -0.7 + rr(-0.35, 0.35), L = st * rr(0.35, 0.7); const dx = (Math.cos(a) * L) / 2, dy = (Math.sin(a) * L) / 2; hairs(g, cx - dx, cy - dy, cx, cy, cx + dx, cy + dy, st * rr(0.2, 0.32), pick(cols), rr(0.75, 1), u); } g.setLineDash([]); g.globalAlpha = 1; },
};

const LETTERS = [
  ['red', 0, PAT.dots(['#ffcf1a', '#f39a1a', '#2a1408', '#ffe98a', '#ff7a1a'], 13)],
  ['orange', -Math.PI / 2, PAT.grain(['#ffd23a', '#ffe680', '#c8380e', '#f8b020'], 16)],
  ['green', 0.4, PAT.blooms(['#ffffff', '#5ab0f0', '#ffd83a', '#f0607a', '#2a50c0', '#a8e070'], 26)],
  ['blue', -0.5, PAT.scribble(['#cfe6ff', '#ffffff', '#7ab0f0'], 30)],
  ['magenta', 0.6, PAT.dashes(['#7a2a9c', '#ff9ad0', '#e8323a', '#2a8ab0', '#ffc23a', '#4a1a6a'], 16)],
  ['yellow', 1.2, PAT.dots(['#2a1a0a', '#e05a10', '#ffffff'], 14)],
  ['brown', -Math.PI / 2, PAT.grain(['#3a200c', '#c08a48'], 14)],
];
function nameLayer(g, text, cx, cy, fs, u, off = 0) {
  const font = `bold ${fs}px Futura, "Avenir Next", "Arial Rounded MT Bold", Arial, sans-serif`;
  g.save(); g.font = font; const ws = [...text].map((ch) => g.measureText(ch).width); g.restore();
  const gap = -fs * 0.03, total = ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1);
  let x = cx - total / 2;
  [...text].forEach((ch, i) => {
    const [key, dir, pattern] = LETTERS[(i + off) % LETTERS.length], lw = ws[i] + fs * 0.3, lh = fs * 1.3;
    const c = mk(lw, lh), lg = c.getContext('2d');
    paint(lg, 0, 0, lw, lh, key, dir, u, { noPatch: true }); pattern(lg, [0, 0, lw, lh], u);
    lg.globalCompositeOperation = 'destination-in'; lg.font = font; lg.textBaseline = 'alphabetic'; lg.fillStyle = '#000'; lg.fillText(ch, fs * 0.15, fs);
    g.save(); g.translate(x + ws[i] / 2, cy + rr(-0.025, 0.025) * fs); g.rotate(rr(-0.05, 0.05));
    g.shadowColor = 'rgba(70,45,15,.2)'; g.shadowBlur = 3 * u; g.shadowOffsetY = 1.5 * u;
    g.drawImage(c, -ws[i] / 2 - fs * 0.15, -fs * 0.68);
    g.restore();
    x += ws[i] + gap;
  });
}

function sunSprite(r, u) {
  const S = r * 3.8, c = mk(S, S), g = c.getContext('2d'), m = S / 2, n = 13, a0 = rr(0, TAU);
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU + rr(-0.07, 0.07), r0 = r * rr(1.18, 1.3), r1 = r * rr(1.55, 1.82), hw = r * rr(0.1, 0.14), tw = hw * rr(0.15, 0.35);
    const c1 = Math.cos(a), s1 = Math.sin(a), at = (rad, off) => [m + c1 * rad - s1 * off, m + s1 * rad + c1 * off];
    paste(g, poly([at(r0, -hw), at(r1, -tw), at(r1 + r * 0.02, tw), at(r0, hw)]), i % 2 ? 'yellow' : 'gold', a, u, box(m + (c1 * (r0 + r1)) / 2, m + (s1 * (r0 + r1)) / 2, r * 0.4));
  }
  paste(g, blob(m, m, r, r, 0.035, 0, 36), 'orange', 0, u, box(m, m, r * 1.1), { radial: [m, m] });
  return { cv: c, ax: m, ay: m };
}

function treeSprite(H, u) {
  const pad = H * 0.1, cw = H * 0.95, c = mk(cw, H + pad), g = c.getContext('2d'), bx = cw * 0.5, by = H + pad, cy = pad + H * 0.3, up = -Math.PI / 2;
  paste(g, strip(bx - H * 0.01, by, bx + H * 0.02, cy + H * 0.12, H * 0.025, H * 0.15, H * 0.075), 'brown', up, u, [bx - H * 0.12, cy, H * 0.24, by - cy], { scratch: true });
  paste(g, strip(bx + H * 0.01, cy + H * 0.25, bx - H * 0.22, cy - H * 0.02, -H * 0.03, H * 0.055, H * 0.02), 'brown', -2.3, u, [bx - H * 0.26, cy - H * 0.06, H * 0.3, H * 0.34]);
  paste(g, strip(bx + H * 0.02, cy + H * 0.2, bx + H * 0.24, cy, H * 0.03, H * 0.05, H * 0.018), 'brown', -0.8, u, [bx - H * 0.02, cy - H * 0.04, H * 0.3, H * 0.28]);
  const papers = ['green', 'dkgreen', 'lgreen', 'teal', 'green', 'leafD', 'lgreen'], pieces = [];
  for (let i = 0; i < 13; i++) { const a = rr(0, TAU), d = Math.pow(R(), 0.6) * H * 0.2; pieces.push([bx + Math.cos(a) * d * 1.3, cy + Math.sin(a) * d * 0.75, H * rr(0.1, 0.155)]); }
  pieces.sort((p, q) => q[2] - p[2]).forEach(([x, y, rx], i) => paste(g, blob(x, y, rx, rx * rr(0.72, 0.98), 0.06, rr(0, TAU), 18), papers[i % papers.length], rr(0, Math.PI), u, box(x, y, rx * 1.15)));
  return { cv: c, ax: bx, ay: by };
}

// The big leaf: two cut halves (dark top, bright bottom), a stem strip, holes nibbled through.
function holeLeaf(L, u) {
  const c = mk(L * 1.2, L * 0.8), g = c.getContext('2d'), m = L * 0.4, x0 = L * 0.1, W = L * 0.33, n = 11;
  const mid = (t) => [x0 + t * L, m - Math.sin(Math.PI * t) * L * 0.02];
  const edge = (t, s) => { const hw = W * Math.pow(Math.sin(Math.PI * t), 0.7) * (1 - 0.2 * t) * (s < 0 ? 1.08 : 0.95) * (1 + rr(-0.03, 0.03)); const [x, y] = mid(t); return [x, y + s * hw]; };
  const half = (s) => { const pts = []; for (let i = 0; i <= n; i++) pts.push(i === 0 || i === n ? mid(i / n) : edge(i / n, s)); for (let i = n - 1; i > 0; i--) pts.push(mid(i / n)); return poly(pts); };
  paste(g, half(1), 'leafL', 0.25, u, [x0, m - L * 0.04, L, W + L * 0.06]);
  paste(g, half(-1), 'leafD', -0.45, u, [x0, m - W * 1.1, L, W * 1.1 + L * 0.03]);
  paste(g, strip(0, m + L * 0.01, x0 + L * 0.55, m - L * 0.016, -L * 0.012, L * 0.032, L * 0.012), 'dkgreen', 0, u, [0, m - L * 0.04, L * 0.7, L * 0.08]);
  g.globalCompositeOperation = 'destination-out';
  [[0.32, 0.12, 0.05], [0.5, -0.1, 0.045], [0.66, 0.1, 0.055], [0.8, -0.04, 0.036]].forEach(([t, o, r]) => g.fill(blob(x0 + t * L, m + o * L, r * L, r * L * 0.94, 0.05)));
  return { cv: c, ax: L * 0.02, ay: m };
}

// Fruit from the book's week, each with a hole eaten through.
function fruitSprite(type, s, u) {
  const c = mk(s * 1.25, s * 1.4), g = c.getContext('2d'), cx = c.width / 2, by = c.height - 2;
  let cy = by - s * 0.47, hole = [cx + rr(-0.06, 0.06) * s, cy + s * 0.08];
  if (type === 'apple') {
    const r = s * 0.47, pts = [];
    for (let i = 0; i < 36; i++) { const a = (i / 36) * TAU, dt = Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2)), db = Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2)), k = (1 - 0.14 * Math.exp(-(dt * dt) / 0.05) - 0.05 * Math.exp(-(db * db) / 0.05)) * (1 + rr(-0.012, 0.012)); pts.push([cx + Math.cos(a) * r * 1.05 * k, cy + Math.sin(a) * r * k]); }
    paste(g, strip(cx, cy - r * 0.75, cx + s * 0.06, cy - r * 1.25, s * 0.02, s * 0.05, s * 0.035), 'brown', -Math.PI / 2, u, box(cx, cy - r, s * 0.2));
    paste(g, smooth(pts), 'red', rr(-0.5, 0.5), u, box(cx, cy, r * 1.12), { mottle: true });
    paste(g, leaf(cx + s * 0.05, cy - r * 1.05, s * 0.3, s * 0.085, -0.5), 'lgreen', -0.5, u, box(cx + s * 0.18, cy - r * 1.1, s * 0.2));
  } else if (type === 'pear') {
    const p = new Path2D(); blob(cx, by - s * 0.33, s * 0.33, s * 0.33, 0.04, 0, 30, p); blob(cx + s * 0.02, by - s * 0.74, s * 0.18, s * 0.2, 0.04, 0, 24, p);
    p.addPath(poly([[cx - s * 0.15, by - s * 0.76], [cx + s * 0.19, by - s * 0.74], [cx + s * 0.3, by - s * 0.42], [cx - s * 0.3, by - s * 0.42]]));
    paste(g, strip(cx + s * 0.02, by - s * 0.9, cx - s * 0.03, by - s * 1.15, s * 0.02, s * 0.04, s * 0.03), 'brown', -Math.PI / 2, u, box(cx, by - s, s * 0.15));
    paste(g, p, 'pear', -1.2, u, [cx - s * 0.36, by - s * 0.96, s * 0.72, s * 0.96]);
    hole = [cx + rr(-0.04, 0.04) * s, by - s * 0.32];
  } else if (type === 'plum') {
    paste(g, strip(cx, by - s * 0.92, cx - s * 0.02, by - s * 1.18, s * 0.02, s * 0.035, s * 0.028), 'brown', -Math.PI / 2, u, box(cx, by - s, s * 0.15));
    paste(g, blob(cx, by - s * 0.48, s * 0.34, s * 0.48, 0.05, 0.1), 'plum', -1.3, u, [cx - s * 0.4, by - s, s * 0.8, s]);
    hole = [cx, by - s * 0.36];
  } else if (type === 'strawberry') {
    const rx = s * 0.44, ry = s * 0.48, pts = []; cy = by - ry;
    for (let i = 0; i < 32; i++) { const a = (i / 32) * TAU, sn = Math.sin(a), k = sn > 0 ? 1 - 0.5 * Math.pow(sn, 1.5) : 1; pts.push([cx + Math.cos(a) * rx * k * (1 + rr(-0.02, 0.02)), cy + sn * ry * (sn < 0 ? 0.78 : 1)]); }
    const body = smooth(pts);
    paste(g, body, 'berry', 0.05, u, box(cx, cy, rx * 1.05), {
      pattern: (pg) => { pg.strokeStyle = '#3a1208'; pg.lineCap = 'round'; pg.lineWidth = s * 0.026; for (let yy = cy - ry * 0.55; yy < by; yy += s * 0.12) for (let xx = cx - rx + ((Math.round((yy - cy) / (s * 0.12)) & 1) * s * 0.06); xx < cx + rx; xx += s * 0.12) { pg.globalAlpha = rr(0.6, 0.9); const x2 = xx + rr(-0.02, 0.02) * s, y2 = yy + rr(-0.02, 0.02) * s; pg.beginPath(); pg.moveTo(x2, y2); pg.quadraticCurveTo(x2 + s * 0.02, y2 + s * 0.02, x2 + s * 0.005, y2 + s * 0.05); pg.stroke(); } pg.globalAlpha = 1; },
    });
    const ty = cy - ry * 0.72;
    [-2.7, -2.1, -1.57, -1.05, -0.45].forEach((a) => paste(g, leaf(cx, ty, s * rr(0.24, 0.32), s * 0.07, a), 'dkgreen', a, u, box(cx, ty, s * 0.32)));
    paste(g, strip(cx, ty, cx + s * 0.04, ty - s * 0.2, s * 0.02, s * 0.04, s * 0.03), 'dkgreen', -Math.PI / 2, u, box(cx, ty - s * 0.1, s * 0.12));
    hole = [cx - s * 0.04, cy + s * 0.08];
  } else {
    paste(g, blob(cx, cy, s * 0.46, s * 0.45, 0.03), 'orange', 0, u, box(cx, cy, s * 0.5), { radial: [cx, cy] });
    paste(g, leaf(cx, cy - s * 0.43, s * 0.26, s * 0.08, -0.7), 'green', -0.7, u, box(cx + s * 0.1, cy - s * 0.5, s * 0.2));
  }
  g.globalCompositeOperation = 'destination-out';
  g.fill(blob(hole[0], hole[1], s * 0.07, s * 0.066, 0.04));
  return { cv: c, ax: cx, ay: by };
}

function flowerSprite(type, Lh, hr, u) {
  const cw = hr * 3.2, ch = Lh + hr * 1.6, c = mk(cw, ch), g = c.getContext('2d'), bx = cw / 2, by = ch, hx = bx + rr(-0.15, 0.15) * hr, hy = hr * 1.45;
  paste(g, strip(bx, by, hx, hy, rr(-0.06, 0.06) * Lh, hr * 0.16, hr * 0.11), 'green', -Math.PI / 2, u, [bx - hr * 0.5, hy, hr, by - hy]);
  for (let s = -1; s <= 1; s += 2) { const y = by - Lh * rr(0.3, 0.55); paste(g, leaf(bx + (hx - bx) * (1 - (y - hy) / (by - hy)), y, hr * 1.05, hr * 0.26, s < 0 ? Math.PI + 0.55 : -0.55), s < 0 ? 'lgreen' : 'dkgreen', s < 0 ? Math.PI + 0.5 : -0.5, u, box(bx, y - hr * 0.3, hr * 1.2)); }
  const ring = (n, dist, rx, ry, key) => { for (let i = 0; i < n; i++) { const a = (i / n) * TAU + rr(-0.1, 0.1) - Math.PI / 2, px = hx + Math.cos(a) * dist, py = hy + Math.sin(a) * dist; paste(g, blob(px, py, rx, ry, 0.06, a), key, a, u, box(px, py, Math.max(rx, ry) * 1.15)); } };
  const petals = (n, len, wid, keyA, keyB) => { for (let i = 0; i < n; i++) { const a = (i / n) * TAU + rr(-0.06, 0.06); paste(g, leaf(hx, hy, len * rr(0.9, 1.05), wid, a, 0.05), i % 2 ? keyB : keyA, a, u, box(hx + (Math.cos(a) * len) / 2, hy + (Math.sin(a) * len) / 2, len * 0.6)); } };
  const centre = (r, key, dots) => paste(g, blob(hx, hy, r, r * 0.95, 0.05), key, rr(0, TAU), u, box(hx, hy, r * 1.1), { radial: [hx, hy], pattern: dots && PAT.dots(dots, (r / u) * 0.45) });
  if (type === 'red') { ring(5, hr * 0.46, hr * 0.6, hr * 0.5, 'red'); centre(hr * 0.3, 'violet', ['#1a1030', '#2a1a50']); }
  else if (type === 'yellow') { petals(14, hr, hr * 0.13, 'yellow', 'gold'); centre(hr * 0.34, 'brown', ['#2a1608', '#d08a3a']); }
  else if (type === 'blue') { ring(6, hr * 0.5, hr * 0.5, hr * 0.42, 'blue'); centre(hr * 0.28, 'yellow', ['#e05a10']); }
  else if (type === 'magenta') { [-0.42, 0.42, 0].forEach((o) => paste(g, leaf(hx, hy + hr * 0.75, hr * 1.55, hr * 0.42, -Math.PI / 2 + o, 0.04), 'magenta', -Math.PI / 2 + o, u, box(hx, hy, hr * 1.1))); }
  else { petals(8, hr * 0.95, hr * 0.26, 'violet', 'violet'); centre(hr * 0.3, 'orange', ['#ffd83a']); }
  return { cv: c, ax: bx, ay: by };
}

function tuftSprite(hg, u) {
  const cw = hg * 0.9, c = mk(cw, hg), g = c.getContext('2d'), bx = cw / 2;
  for (let i = 0; i < 6; i++) { const x = bx + rr(-0.18, 0.18) * hg, top = hg * rr(0.05, 0.45), lean = rr(-0.25, 0.25) * hg, w = hg * rr(0.05, 0.08), tx = x + lean; paste(g, poly([[x - w, hg], [tx, top], [x + w, hg]]), pick(['green', 'dkgreen', 'lgreen', 'teal']), Math.atan2(top - hg, tx - x), u, [Math.min(x, tx) - w, top, Math.abs(tx - x) + 2 * w, hg - top]); }
  return { cv: c, ax: bx, ay: hg };
}

export function makeGarden(w, h, opts = {}) {
  seed = 11;
  const u = h / 1000, back = mk(w, h), g = back.getContext('2d');
  g.fillStyle = '#fdfcf9'; g.fillRect(0, 0, w, h);
  nameLayer(g, opts.name ?? "rishi's", w * 0.5, h * 0.15, h * 0.19, u);
  nameLayer(g, opts.sub ?? 'garden', w * 0.5, h * 0.3, h * 0.1, u, 3);

  const hill = [[-20, h + 10]]; for (let i = 0; i <= 10; i++) { const x = (i / 10) * (w + 40) - 20; hill.push([x, h * 0.925 + Math.sin(i * 0.9 + 1) * h * 0.01 + rr(-4, 4) * u]); } hill.push([w + 20, h + 10]);
  paste(g, poly(hill), 'lgreen', 0.05, u, [0, h * 0.9, w, h * 0.1]);

  const sprites = [];
  sprites.push({ ...sunSprite(h * 0.055, u), x: w * 0.9, y: h * 0.14, spin: 0.02 });
  sprites.push({ ...treeSprite(h * 0.55, u), x: w * 0.05, y: h * 1.0, amp: 0.004, sp: 0.3, ph: 0 });
  // Fruit hanging in the canopy (canopy centre is ~0.385h above the ground).
  const tcx = w * 0.05, tcy = h * 0.615;
  [['apple', 0.0, -0.07, 0.05], ['pear', 0.09, -0.1, 0.06], ['plum', 0.15, -0.01, 0.05], ['strawberry', 0.07, 0.04, 0.05], ['orange', -0.01, 0.06, 0.048]].forEach(([type, dx, dy, s], i) =>
    sprites.push({ ...fruitSprite(type, h * s, u), x: tcx + h * dx, y: tcy + h * dy + h * s * 0.5, rot: rr(-0.08, 0.08), amp: 0.025, sp: 0.6, ph: i * 1.1 }));
  [[0.17, 'magenta', 0.16], [0.42, 'blue', 0.18], [0.84, 'red', 0.2], [0.95, 'yellow', 0.17]].forEach(([x, type, lh], i) =>
    sprites.push({ ...flowerSprite(type, h * lh, h * (type === 'red' ? 0.036 : 0.028), u), x: w * x, y: h * 0.98, amp: 0.03, sp: 0.6 + i * 0.07, ph: i * 1.3 }));
  sprites.push({ ...holeLeaf(h * 0.16, u), x: w * 0.62, y: h * 0.95, amp: 0.012, sp: 0.4, ph: 1, rot: -0.5 });

  // Front grass: one long strip with scissor-cut teeth along the top.
  const gc = mk(w, h * 0.08), gg = gc.getContext('2d'), gh = gc.height, top = h * 0.035, teeth = [[-20, gh + 10]];
  for (let x = -20; x < w + 40;) { const st = rr(14, 42) * u; teeth.push([x, top + rr(-4, 10) * u], [x + st / 2, top - rr(8, 28) * u]); x += st; }
  teeth.push([w + 40, top], [w + 40, gh + 10]);
  paste(gg, poly(teeth), 'green', -Math.PI / 2, u, [0, 0, w, gh]);
  sprites.push({ cv: gc, x: 0, y: h - gh, ax: 0, ay: 0 });
  for (let i = 0; i < 9; i++) sprites.push({ ...tuftSprite(h * rr(0.045, 0.07), u), x: w * (0.05 + i * 0.11 + rr(-0.03, 0.03)), y: h * 1.01, amp: 0.05, sp: rr(0.7, 1.1), ph: rr(0, TAU) });

  // Tissue paper for the people silhouettes (painted at half size, scaled up).
  const tissue = mk(w, h), tc = mk(w / 2, h / 2);
  paint(tc.getContext('2d'), 0, 0, tc.width, tc.height, 'sky', -Math.PI / 2, u / 2, { max: 600 });
  tissue.getContext('2d').drawImage(tc, 0, 0, w, h);
  if (opts.cat) sprites.push(caterpillarSprite(opts.cat, w, h));
  return { back, sprites, tissue };
}

// Caterpillar art shared by localhost and the hosted garden.
export function loadCaterpillar() {
  const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; artSrc(src).then((s) => { i.src = s; }); });
  return Promise.all([load('cat_head.png'), load('segments.jpg')]).then(([head, seg]) => ({ head, seg })).catch(() => null);
}
function caterpillarSprite({ head, seg }, w, h) {
  const R = h * 0.024, n = Math.min(10, Math.floor(seg.width / 52)), S = Math.ceil(R * 3);
  const segs = [];
  for (let i = 0; i < n; i++) {
    const c = mk(S, S), g = c.getContext('2d'), rx = R * 0.72, ry = R;
    g.translate(S / 2, S / 2);
    g.save(); g.shadowColor = 'rgba(10,40,12,.4)'; g.shadowBlur = R * 0.2; g.shadowOffsetX = -R * 0.1; g.shadowOffsetY = R * 0.05;
    g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.fillStyle = '#2f7d34'; g.fill(); g.restore();
    g.save(); g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.clip(); g.rotate(i * 1.3);
    g.drawImage(seg, i * 52 + 1, 1, 50, 50, -ry * 1.2, -ry * 1.2, ry * 2.4, ry * 2.4); g.restore();
    segs.push(c);
  }
  const hs = (R * 1.3 * 1.25) / 66, gap = R * 1.2;
  const margin = Math.min(w / 2, gap * n / 2 + R * 1.6), distance = w - margin * 2;
  const travelTime = Math.max(1, distance / (w * 0.012)), turnTime = 0.9, legTime = travelTime + turnTime;
  const foot = (g, x, y) => { g.fillStyle = '#7a3f8f'; g.beginPath(); g.ellipse(x, y, R * 0.13, R * 0.24, 0, 0, TAU); g.fill(); };
  return {
    draw(g, t) {
      const phase = (t + travelTime * 0.45) % (legTime * 2), returning = phase >= legTime;
      const leg = phase % legTime, progress = Math.min(1, leg / travelTime);
      const cx = margin + distance * (returning ? 1 - progress : progress);
      const facing = (returning ? -1 : 1) * Math.cos(Math.max(0, leg - travelTime) / turnTime * Math.PI);
      const hx = gap * n / 2, base = h * 0.925;
      g.save(); g.translate(cx, 0); g.scale(facing, 1);
      for (let i = n - 1; i >= 0; i--) {
        const x = hx - (i + 1) * gap, k = Math.max(0, Math.sin(t * 2.4 - i * 0.55));
        const y = base - R - k * k * R * 0.55;
        foot(g, x - R * 0.2, base - R * 0.15); foot(g, x + R * 0.25, base - R * 0.15);
        g.drawImage(segs[i], x - S / 2, y - S / 2);
      }
      const hy = base - R * 1.3 - Math.max(0, Math.sin(t * 2.4 + 0.55)) * R * 0.25;
      g.save(); g.translate(hx, hy); g.rotate(Math.sin(t * 1.2) * 0.05); g.scale(hs, hs); g.drawImage(head, -44, -142); g.restore();
      g.restore();
    },
  };
}

export function drawGarden(g, gd, time) {
  g.drawImage(gd.back, 0, 0);
  for (const s of gd.sprites) {
    if (s.draw) { s.draw(g, time); continue; }
    const a = (s.rot || 0) + (s.spin ? time * s.spin : s.amp ? s.amp * Math.sin(time * s.sp + s.ph) + s.amp * 0.4 * Math.sin(time * s.sp * 2.3 + s.ph * 1.7) : 0);
    if (!a) { g.drawImage(s.cv, s.x - s.ax, s.y - s.ay); continue; }
    g.save(); g.translate(s.x, s.y); g.rotate(a); g.drawImage(s.cv, -s.ax, -s.ay); g.restore();
  }
}

// Collage butterfly: wings cut from radiating painted strips, violet border, eyespots.
const BFLY = [
  { strips: ['green', 'teal', 'blue', 'lgreen', 'yellow', 'dkgreen'], border: 'violet' },
  { strips: ['red', 'orange', 'yellow', 'magenta', 'gold'], border: 'violet' },
  { strips: ['blue', 'violet', 'teal', 'sky', 'magenta'], border: 'plum' },
  { strips: ['lgreen', 'yellow', 'orange', 'green', 'teal'], border: 'blue' },
  { strips: ['magenta', 'violet', 'red', 'gold', 'blue'], border: 'plum' },
];
export function collageButterfly(scale = 2, s = Math.random()) {
  seed = Math.floor(s * 1e9);
  const u = 0.45, pal = pick(BFLY), W2 = 104 * scale, H2 = 156 * scale;
  const half = mk(W2 + 2, H2), hg = half.getContext('2d');
  hg.translate(0, 82 * scale); hg.scale(scale, scale);
  for (const [d, a0, a1] of [[WING.upper, -1.75, 0.05], [WING.lower, -0.05, 1.6]]) {
    const wp = new Path2D(d), n = 6 + Math.floor(R() * 2);
    hg.save(); hg.clip(wp);
    for (let i = 0; i < n; i++) {
      const t0 = a0 + ((a1 - a0) * i) / n - 0.04, t1 = a0 + ((a1 - a0) * (i + 1)) / n + rr(0, 0.05), am = (t0 + t1) / 2;
      paste(hg, poly([[0, 0], [Math.cos(t0) * 130, Math.sin(t0) * 130], [Math.cos(t1) * 130, Math.sin(t1) * 130]]), pal.strips[(i + (a0 > -1 ? 2 : 0)) % pal.strips.length], am, u, box(Math.cos(am) * 60, Math.sin(am) * 60, 70));
    }
    // border band: a violet paper stroke kept inside the wing
    const bc = mk(half.width, half.height), bg = bc.getContext('2d');
    bg.setTransform(hg.getTransform()); paint(bg, -5, -90, 120, 170, pal.border, 0.5, u);
    bg.globalCompositeOperation = 'destination-in'; bg.lineWidth = 15; bg.lineJoin = 'round'; bg.stroke(wp);
    hg.save(); hg.setTransform(1, 0, 0, 1, 0, 0); hg.drawImage(bc, 0, 0); hg.restore();
    hg.restore();
  }
  for (const [x, y, r] of [...WING.upperSpots, ...WING.lowerSpots]) {
    if (R() < 0.3) continue;
    paste(hg, blob(x, y, r * 1.15, r * 1.1, 0.06), pick(['yellow', 'gold', 'magenta']), 0, u, box(x, y, r * 1.3));
    paste(hg, blob(x, y, r * 0.7, r * 0.66, 0.06), pick(['red', 'magenta', 'violet']), 0, u, box(x, y, r));
  }
  const c = mk(W2 * 2, H2), g = c.getContext('2d');
  g.drawImage(half, W2, 0); g.save(); g.translate(W2, 0); g.scale(-1, 1); g.drawImage(half, 0, 0); g.restore();
  g.translate(W2, 82 * scale); g.scale(scale, scale);
  g.strokeStyle = '#3a2a10'; g.lineWidth = 1.2; g.lineCap = 'round';
  for (const f of [1, -1]) { g.save(); g.scale(f, 1); g.stroke(new Path2D(WING.antenna)); g.beginPath(); g.arc(20, -60, 1.8, 0, TAU); g.fillStyle = '#3a2a10'; g.fill(); g.restore(); }
  paste(g, new Path2D(WING.body), 'gold', Math.PI / 2, u, [-6, -28, 12, 66], { scratch: true });
  paste(g, blob(0, -30, 5, 5, 0.04), 'gold', 0, u, box(0, -30, 6));
  return { canvas: c, cx: c.width / 2 };
}
