import { SHEET, ART, WING, fillSilhouette, templateSvg } from './shape.js?v=20261121h';
import { STATIC } from './net.js?v=20261121h';

const PX = 4; // output pixels per template unit

// Photo of a coloured-in sheet -> transparent, colour-corrected cut-out.
// Require registration to the printed sheet so page fragments cannot become part of the cut-out.
export async function extractButterfly(file) {
  const bmp = file instanceof HTMLCanvasElement ? file : await decodeUpright(file);
  const full = toCanvas(bmp, 2400);
  try { return { ...(await fromTemplate(full)), mode: 'template' }; }
  catch (e) {
    console.warn('Template registration failed:', e.message);
    throw new Error('Could not find the butterfly sheet. Make sure all four black corner squares are in the photo, the page is flat, and try again.');
  }
}

// <img> applies the photo's EXIF rotation in all current browsers (createImageBitmap doesn't on some iOS versions).
async function decodeUpright(file) {
  const viaImg = async (blob) => { const url = URL.createObjectURL(blob);
    try { const img = new Image(); img.src = url; await img.decode(); return img; } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); } };
  try { return await viaImg(file); } catch {}
  try { return await createImageBitmap(file); } catch {}
  // e.g. HEIC from an iPhone in a browser without HEIC support: let the server convert it.
  if (STATIC) throw new Error('That photo format isn’t supported. Try a JPEG or PNG.');
  const res = await fetch('./api/convert', { method: 'POST', body: file });
  if (!res.ok) throw new Error('That photo format isn’t supported. Try a JPEG or PNG.');
  return viaImg(await res.blob());
}

function toCanvas(src, maxSide) {
  const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height, k = Math.min(1, maxSide / Math.max(sw, sh));
  const c = document.createElement('canvas'); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
  c.getContext('2d', { willReadFrequently: true }).drawImage(src, 0, 0, c.width, c.height);
  return c;
}
const pixels = (c) => c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);

async function fromTemplate(full) {
  const det = toCanvas(full, 1100), W = det.width, H = det.height, N = W * H;
  const norm = flatten(pixels(det).data, W, H);
  const lum = new Float32Array(N);
  for (let i = 0; i < N; i++) lum[i] = (norm[i * 3] + norm[i * 3 + 1] + norm[i * 3 + 2]) / 3;

  // 1. Dark blobs -> square-ish solid / ring candidates (moment-based, rotation and mild perspective invariant).
  const dark = new Uint8Array(N); for (let i = 0; i < N; i++) dark[i] = lum[i] < 105 ? 1 : 0;
  const lab = new Int32Array(N), stack = [], cands = [];
  for (let s0 = 0; s0 < N; s0++) {
    if (!dark[s0] || lab[s0]) continue;
    lab[s0] = 1; stack.push(s0);
    let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, edge = false;
    while (stack.length) {
      const i = stack.pop(), x = i % W, y = (i - x) / W;
      n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < N && dark[j] && !lab[j]) { lab[j] = 1; stack.push(j); }
    }
    if (n < 30 || edge) continue;
    const mx = sx / n, my = sy / n, cxx = sxx / n - mx * mx, cyy = syy / n - my * my, cxy = sxy / n - mx * my;
    const tr = cxx + cyy, dt = cxx * cyy - cxy * cxy, disc = Math.sqrt(Math.max(0, tr * tr / 4 - dt));
    const l1 = tr / 2 + disc, l2 = tr / 2 - disc;
    if (l2 <= 0) continue;
    const ratio = Math.sqrt(l1 / l2), fill = n / (12 * Math.sqrt(l1 * l2));
    if (ratio < 2.4 && fill > 0.5 && fill < 1.2) cands.push({ x: mx, y: my, n, ring: fill < 0.84 });
  }
  cands.sort((a, b) => b.n - a.n);
  const pool = cands.slice(0, 20);

  // 2. Best four: convex, similar size, marker size consistent with frame size, exactly one ring preferred.
  const quads = [];
  for (let a = 0; a < pool.length; a++) for (let b = a + 1; b < pool.length; b++) for (let c = b + 1; c < pool.length; c++) for (let d = c + 1; d < pool.length; d++) {
    const q = [pool[a], pool[b], pool[c], pool[d]];
    const ns = q.map((m) => m.n); if (Math.max(...ns) / Math.min(...ns) > 3.5) continue;
    const gx = q.reduce((s, m) => s + m.x, 0) / 4, gy = q.reduce((s, m) => s + m.y, 0) / 4;
    q.sort((m1, m2) => Math.atan2(m1.y - gy, m1.x - gx) - Math.atan2(m2.y - gy, m2.x - gx));
    let area = 0, convex = true;
    for (let i = 0; i < 4; i++) {
      const p0 = q[i], p1 = q[(i + 1) % 4], p2 = q[(i + 2) % 4];
      area += p0.x * p1.y - p1.x * p0.y;
      if ((p1.x - p0.x) * (p2.y - p1.y) - (p1.y - p0.y) * (p2.x - p1.x) <= 0) convex = false;
    }
    area /= 2;
    if (!convex || area <= 0) continue;
    const rel = Math.sqrt(ns.reduce((s, v) => s + v, 0) / 4) / Math.sqrt(area);
    if (rel < 0.042 || rel > 0.11) continue; // printed: 14-unit squares on a 224x190 frame = 0.068
    quads.push(q);
  }
  if (!quads.length) throw new Error('corner squares not found');
  const pts = await templatePoints();
  const ridge = ridgeMap(lum, W, H);
  // Fraction of template outline points that land on dark drawn lines (vs. the same shifted aside).
  const lineHits = (Hm, fit, sx, sy) => { let n = 0;
    for (let i = 0; i < pts.length; i += 2) {
      const [u, v] = apply(Hm, pts[i] * fit.s + fit.dx, pts[i + 1] * fit.s + fit.dy);
      let mn = 255; for (const [ox, oy] of [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) mn = Math.min(mn, sampleF(lum, W, H, u + sx + ox, v + sy + oy));
      if (mn < 120) n++;
    }
    return n / (pts.length / 2); };
  const outlineMatch = (Hm, fit) => { const on = lineHits(Hm, fit, 0, 0), off = (lineHits(Hm, fit, 7, 0) + lineHits(Hm, fit, -7, 0) + lineHits(Hm, fit, 0, 7) + lineHits(Hm, fit, 0, -7)) / 4; return { on, off }; };
  // Every plausible square set and orientation is ranked by how well the printed butterfly lines up with it.
  const tries = [];
  for (const q of quads) {
    const ringAt = q.findIndex((m) => m.ring), starts = q.filter((m) => m.ring).length === 1 ? [ringAt] : [0, 1, 2, 3];
    for (const st of starts) {
      const Hm = homography(SHEET.markers, [0, 1, 2, 3].map((i) => [q[(st + i) % 4].x, q[(st + i) % 4].y]));
      if (!Hm || !Hm.every(Number.isFinite)) continue;
      const { on, off } = outlineMatch(Hm, { dx: 0, dy: 0, s: 1 });
      tries.push({ Hm, quick: on - off, ring: st === ringAt && q.filter((m) => m.ring).length === 1, area: quadArea(q) });
    }
  }
  // Best outline overlap first, then the largest sets that include the ringed corner (curled paper scores low before refinement).
  const byQuick = [...tries].sort((a, b) => b.quick - a.quick).slice(0, 5);
  const byRing = tries.filter((t) => t.ring).sort((a, b) => b.area - a.area).slice(0, 5);
  const order = [...new Set([...byQuick, ...byRing])];
  // Black printed ink only (crayon strokes also make dark ridges, but they are coloured).
  const inkMap = new Float32Array(N);
  for (let i = 0; i < N; i++) { const r = norm[i * 3], g = norm[i * 3 + 1], b = norm[i * 3 + 2], ch = Math.max(r, g, b) - Math.min(r, g, b);
    inkMap[i] = Math.max(0, 150 - lum[i]) * Math.max(0, Math.min(1, (60 - ch) / 30)); }
  const inkWide = boxBlur(inkMap, W, H, 4), inkMid = boxBlur(inkMap, W, H, 1);
  let Hm = null, fit = null, lastErr = new Error('corner squares not found');
  for (const t of order) {
    try { ({ Hm, fit } = alignQuad(t.Hm)); break; } catch (e) { lastErr = e; }
  }
  if (!Hm) throw lastErr;

  function alignQuad(Hm) {
  Hm = bendToOutline(Hm);

  // 3. Fine-align template lines to the drawn outline (paper curl, print scaling).
  const score = (dx, dy, s) => {
    let t = 0;
    for (let i = 0; i < pts.length; i += 2) {
      const [u, v] = apply(Hm, pts[i] * s + dx, pts[i + 1] * s + dy);
      t += sampleF(ridge, W, H, u, v);
    }
    return t;
  };
  let fit = { dx: 0, dy: 0, s: 1 }, fitScore = score(0, 0, 1);
  const base = fitScore;
  const search = (range, step, srange, sstep) => {
    const c = { ...fit };
    for (let s = c.s - srange; s <= c.s + srange + 1e-9; s += sstep)
      for (let dy = c.dy - range; dy <= c.dy + range + 1e-9; dy += step)
        for (let dx = c.dx - range; dx <= c.dx + range + 1e-9; dx += step) {
          const v = score(dx, dy, s); if (v > fitScore) { fitScore = v; fit = { dx, dy, s }; }
        }
  };
  search(1, 0.25, 0, 1);
  if (fitScore < base * 1.04) fit = { dx: 0, dy: 0, s: 1 };
  // Reject false square matches (textures, other printouts): the template outline must land on real drawn lines.
  const { on: onLine, off } = outlineMatch(Hm, fit);
  if (onLine < 0.6 || onLine - off < 0.3) throw new Error(`outline mismatch (on ${onLine.toFixed(2)}, off ${off.toFixed(2)})`);
  return { Hm, fit };
  }

  // 4. Warp into template space at full resolution (2x2 supersampled).
  // Paper held in a hand or lap curls: nudge each corner so the template outline locks onto the drawn one.
  function bendToOutline(H0) {
    const corners = SHEET.markers.map(([x, y]) => apply(H0, x, y)), orig = corners.map((c) => [...c]);
    const diag = Math.hypot(corners[2][0] - corners[0][0], corners[2][1] - corners[0][1]), lim = diag * 0.08;
    const sub = []; for (let i = 0; i < pts.length; i += 6) sub.push(pts[i], pts[i + 1]);
    const evalC = (cs, map) => { const h = homography(SHEET.markers, cs); if (!h.every(Number.isFinite)) return -1;
      let t = 0; for (let i = 0; i < sub.length; i += 2) { const [u, v] = apply(h, sub[i], sub[i + 1]); t += sampleF(map, W, H, u, v); } return t; };
    for (const [map, steps] of [[inkWide, [diag * 0.03, diag * 0.015, diag * 0.008]], [inkMid, [diag * 0.006, diag * 0.003, diag * 0.0015]]]) {
      let best = evalC(corners, map);
      for (const step of steps) for (let pass = 0, moved = true; pass < 4 && moved; pass++) { moved = false;
        for (let k = 0; k < 4; k++) for (let ax = 0; ax < 2; ax++) for (const sg of [-1, 1]) {
          const old = corners[k][ax]; corners[k][ax] = old + sg * step;
          const v = Math.abs(corners[k][ax] - orig[k][ax]) <= lim ? evalC(corners, map) : -1;
          if (v > best) { best = v; moved = true; } else corners[k][ax] = old;
        } }
    }
    return homography(SHEET.markers, corners);
  }

  const k = full.width / W, src = pixels(full), SW = full.width, SH = full.height, sd = src.data;
  const OW = ART.w * PX, OH = ART.h * PX, out = new Float32Array(OW * OH * 3);
  for (let j = 0; j < OH; j++) for (let i = 0; i < OW; i++) {
    let r = 0, g = 0, b = 0;
    for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
      const tx = ART.x + (i + ox) / PX, ty = ART.y + (j + oy) / PX;
      const [u, v] = apply(Hm, tx * fit.s + fit.dx, ty * fit.s + fit.dy);
      const px = sampleRGB(sd, SW, SH, u * k, v * k); r += px[0]; g += px[1]; b += px[2];
    }
    const o = (j * OW + i) * 3; out[o] = r / 4; out[o + 1] = g / 4; out[o + 2] = b / 4;
  }

  // 5. White-balance against the visible paper around the butterfly.
  const inner = silhouetteCanvas(OW, OH, 0, 0), band = silhouetteCanvas(OW, OH, 1.4, 1.4), grown = silhouetteCanvas(OW, OH, 10);
  const id0 = pixels(inner).data, bd = pixels(band).data, gd = pixels(grown).data;
  whiteBalance(out, OW, OH, (i) => gd[i * 4 + 3] < 10);

  // 6. Compose: the photographed drawing as-is (including its own outline), cut out along the outline's outer edge.
  const c = document.createElement('canvas'); c.width = OW; c.height = OH;
  const cg = c.getContext('2d'), id = cg.createImageData(OW, OH);
  // Curled paper: where the drawn outline sits inside the template edge, peel the paper between them
  // (flood in from outside through plain white paper only, near the edge so a gap in the line can't eat a wing).
  const ON = OW * OH, isInk = new Uint8Array(ON), paper = new Uint8Array(ON), dist = new Int16Array(ON).fill(-1), st = [];
  for (let i = 0; i < ON; i++) { const r = out[i * 3], g = out[i * 3 + 1], b = out[i * 3 + 2], l = (r + g + b) / 3, ch = Math.max(r, g, b) - Math.min(r, g, b);
    isInk[i] = l < 150 && ch < 60 ? 1 : 0; paper[i] = l > 185 && ch < 30 ? 1 : 0; }
  const inkD = dilate(isInk, OW, OH, 2), DEPTH = Math.round(OW * 0.04);
  for (let i = 0; i < ON; i++) if (id0[i * 4 + 3] < 128) { dist[i] = 0; st.push(i); }
  for (let h = 0; h < st.length; h++) { const i = st[h], x = i % OW;
    if (dist[i] >= DEPTH) continue;
    for (const j of [x > 0 ? i - 1 : -1, x < OW - 1 ? i + 1 : -1, i - OW, i + OW]) if (j >= 0 && j < ON && dist[j] < 0 && !inkD[j] && paper[j]) { dist[j] = dist[i] + 1; st.push(j); } }
  for (let i = 0; i < OW * OH; i++) {
    const r = out[i * 3], g = out[i * 3 + 1], b = out[i * 3 + 2], l = (r + g + b) / 3;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    const ink = Math.max(0, Math.min(1, (225 - l) / 110)) * Math.max(0, Math.min(1, (90 - chroma) / 40));
    id.data[i * 4] = r; id.data[i * 4 + 1] = g; id.data[i * 4 + 2] = b;
    const body = dist[i] > 0 ? 0 : id0[i * 4 + 3];
    id.data[i * 4 + 3] = Math.max(body, (bd[i * 4 + 3] / 255) * ink * 255);
  }
  cg.putImageData(id, 0, 0);
  return { canvas: c, cx: OW / 2 };
}

// Each wing cell (area enclosed by printed lines) is cleaned on its own: white gaps between
// crayon/marker strokes are filled from nearby colour in the same cell, streaks are softened,
// and cells left uncoloured become clean paper white. Colour never bleeds across a printed line.
let lineCache = null, artCache = null;
async function lineArt() {
  if (artCache) return artCache;
  const img = new Image();
  img.src = 'data:image/svg+xml,' + encodeURIComponent(templateSvg({ stroke: '#1d1820', width: 1.1 }).replace('<svg ', `<svg width="${ART.w * PX}" height="${ART.h * PX}" `));
  await img.decode();
  // Antennae in a soft light tone so they read against the dark wall.
  const c = document.createElement('canvas'); c.width = ART.w * PX; c.height = ART.h * PX;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  g.setTransform(PX, 0, 0, PX, -ART.x * PX, -ART.y * PX);
  g.lineCap = 'round'; g.strokeStyle = '#f4e9f0'; g.lineWidth = 1.5;
  const ant = new Path2D(WING.antenna);
  g.stroke(ant); g.scale(-1, 1); g.stroke(ant);
  return (artCache = c);
}
async function lineMask(OW, OH) {
  if (lineCache && lineCache.w === OW) return lineCache.d;
  const img = new Image();
  img.src = 'data:image/svg+xml,' + encodeURIComponent(templateSvg({ width: 2.4 }));
  await img.decode();
  const c = document.createElement('canvas'); c.width = OW; c.height = OH;
  c.getContext('2d').drawImage(img, 0, 0, OW, OH);
  const d = pixels(c).data, m = new Uint8Array(OW * OH);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 60 ? 1 : 0;
  lineCache = { w: OW, d: m };
  return m;
}
async function cleanRegions(rgb, W, H, insideRGBA, customLine) {
  const N = W * H, line = customLine || await lineMask(W, H), label = new Int32Array(N).fill(-1);
  const regions = [], stack = new Int32Array(N);
  for (let s = 0; s < N; s++) {
    if (label[s] !== -1 || line[s] || insideRGBA[s * 4 + 3] < 200) continue;
    const id = regions.length, px = [];
    let sp = 0; stack[sp++] = s; label[s] = id;
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    while (sp) {
      const p = stack[--sp], x = p % W, y = (p / W) | 0; px.push(p);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const q of [p - 1, p + 1, p - W, p + W]) {
        if (q < 0 || q >= N || label[q] !== -1 || line[q] || insideRGBA[q * 4 + 3] < 200) continue;
        if ((q === p - 1 && x === 0) || (q === p + 1 && x === W - 1)) continue;
        label[q] = id; stack[sp++] = q;
      }
    }
    regions.push({ px, x0, y0, x1, y1 });
  }
  // Pigment strength: how far a pixel is from clean paper (white) in chroma and darkness.
  const strength = (o) => { const r = rgb[o], g = rgb[o + 1], b = rgb[o + 2]; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return Math.max(0, (mx - mn) - 10) / 120 + Math.max(0, 238 - (r + g + b) / 3) / 160; };
  for (let id = 0; id < regions.length; id++) {
    const { px, x0, y0, x1, y1 } = regions[id];
    let nc = 0;
    for (const p of px) if (strength(p * 3) > 0.1) nc++;
    if (nc < px.length * 0.3) { for (const p of px) rgb[p * 3] = rgb[p * 3 + 1] = rgb[p * 3 + 2] = 250; continue; }
    // Local pigment colour: blur weighted by strength^3, so dense strokes dominate and paper gaps don't dilute.
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, n = bw * bh;
    const acc = new Float32Array(n * 4);
    let gr = 0, gg = 0, gb = 0, gw = 0;
    for (const p of px) {
      const o = p * 3, st = Math.min(1.5, strength(o)), w = st * st * st;
      if (w < 1e-4) continue;
      const k = ((((p / W) | 0) - y0) * bw + (p % W) - x0) * 4;
      acc[k] = rgb[o] * w; acc[k + 1] = rgb[o + 1] * w; acc[k + 2] = rgb[o + 2] * w; acc[k + 3] = w;
      gr += rgb[o] * w; gg += rgb[o + 1] * w; gb += rgb[o + 2] * w; gw += w;
    }
    gr /= gw; gg /= gw; gb /= gw;
    // Mostly one colour? Lean on the cell's main colour to smooth streaks and glare; multi-colour cells keep local colour.
    let vr = 0;
    for (const p of px) { const o = p * 3, st = Math.min(1.5, strength(o)), w = st * st * st; vr += w * ((rgb[o] - gr) ** 2 + (rgb[o + 1] - gg) ** 2 + (rgb[o + 2] - gb) ** 2); }
    const sd = Math.sqrt(vr / gw / 3), unify = Math.max(0, Math.min(0.75, 1.1 - sd / 45));
    const R = 14, tmp = new Float32Array(n * 4), sm = new Float32Array(n * 4);
    for (let y = 0; y < bh; y++) { const s4 = [0, 0, 0, 0];
      for (let x = -R; x < bw + R; x++) {
        if (x + R < bw && x + R >= 0) for (let c = 0; c < 4; c++) s4[c] += acc[(y * bw + x + R) * 4 + c];
        if (x - R - 1 >= 0 && x - R - 1 < bw) for (let c = 0; c < 4; c++) s4[c] -= acc[(y * bw + x - R - 1) * 4 + c];
        if (x >= 0 && x < bw) for (let c = 0; c < 4; c++) tmp[(y * bw + x) * 4 + c] = s4[c];
      } }
    for (let x = 0; x < bw; x++) { const s4 = [0, 0, 0, 0];
      for (let y = -R; y < bh + R; y++) {
        if (y + R < bh && y + R >= 0) for (let c = 0; c < 4; c++) s4[c] += tmp[((y + R) * bw + x) * 4 + c];
        if (y - R - 1 >= 0 && y - R - 1 < bh) for (let c = 0; c < 4; c++) s4[c] -= tmp[((y - R - 1) * bw + x) * 4 + c];
        if (y >= 0 && y < bh) for (let c = 0; c < 4; c++) sm[(y * bw + x) * 4 + c] = s4[c];
      } }
    for (const p of px) {
      const k = ((((p / W) | 0) - y0) * bw + (p % W) - x0) * 4, w = sm[k + 3], o = p * 3;
      const t = Math.min(1, w / 2); // fall back to the cell's overall pigment where strokes are sparse
      const lr = w > 1e-3 ? sm[k] / w : gr, lg = w > 1e-3 ? sm[k + 1] / w : gg, lb = w > 1e-3 ? sm[k + 2] / w : gb;
      const tt = t * (1 - unify);
      const pr = lr * tt + gr * (1 - tt), pg = lg * tt + gg * (1 - tt), pb = lb * tt + gb * (1 - tt);
      rgb[o] = pr * 0.95 + rgb[o] * 0.05; rgb[o + 1] = pg * 0.95 + rgb[o + 1] * 0.05; rgb[o + 2] = pb * 0.95 + rgb[o + 2] * 0.05;
    }
  }
  // Printed lines are redrawn as vectors later; fill the line gutters from neighbouring cells so no paper shows.
  let front = [];
  for (let p = 0; p < N; p++) if (label[p] === -1) front.push(p);
  for (let pass = 0; pass < 24 && front.length; pass++) {
    const next = [], set = [];
    for (const p of front) {
      const x = p % W;
      for (const q of [p - 1, p + 1, p - W, p + W]) {
        if (q < 0 || q >= N || label[q] < 0 || (q === p - 1 && x === 0) || (q === p + 1 && x === W - 1)) continue;
        set.push(p, q); break;
      }
    }
    for (let i = 0; i < set.length; i += 2) { const p = set[i], q = set[i + 1]; label[p] = label[q]; rgb[p * 3] = rgb[q * 3]; rgb[p * 3 + 1] = rgb[q * 3 + 1]; rgb[p * 3 + 2] = rgb[q * 3 + 2]; }
    for (const p of front) if (label[p] === -1) next.push(p);
    front = next;
  }
}

function silhouetteCanvas(w, h, outline, antenna = outline + 0.8) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.setTransform(PX, 0, 0, PX, -ART.x * PX, -ART.y * PX);
  fillSilhouette(g, { outline, antenna });
  return c;
}

let ptsCache = null;
async function templatePoints() {
  if (ptsCache) return ptsCache;
  const S = 3, img = new Image();
  img.src = 'data:image/svg+xml,' + encodeURIComponent(templateSvg({ width: 0.8 }));
  await img.decode();
  const c = document.createElement('canvas'); c.width = ART.w * S; c.height = ART.h * S;
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const d = pixels(c).data, pts = [];
  for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) if (d[(y * c.width + x) * 4 + 3] > 120) pts.push(ART.x + x / S, ART.y + y / S);
  return (ptsCache = new Float32Array(pts));
}

// Thin dark lines respond strongly; flat colour fills don't.
function ridgeMap(lum, W, H) {
  const r = 2, tmp = new Float32Array(W * H), blur = new Float32Array(W * H);
  for (let y = 0; y < H; y++) { let s = 0; for (let x = -r; x < W + r; x++) { s += lum[y * W + Math.min(W - 1, Math.max(0, x + r))] - lum[y * W + Math.min(W - 1, Math.max(0, x - r - 1))]; if (x >= 0 && x < W) tmp[y * W + x] = s / (2 * r + 1); } }
  for (let x = 0; x < W; x++) { let s = 0; for (let y = -r; y < H + r; y++) { s += tmp[Math.min(H - 1, Math.max(0, y + r)) * W + x] - tmp[Math.min(H - 1, Math.max(0, y - r - 1)) * W + x]; if (y >= 0 && y < H) blur[y * W + x] = s / (2 * r + 1); } }
  const out = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = Math.max(0, blur[i] - lum[i]);
  return out;
}

const quadArea = (q) => Math.abs(q.reduce((s, m, i) => { const n = q[(i + 1) % 4]; return s + m.x * n.y - n.x * m.y; }, 0)) / 2;

function homography(from, to) {
  const A = [], B = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i], [u, v] = to[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); B.push(v);
  }
  for (let c = 0; c < 8; c++) {
    let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [B[c], B[p]] = [B[p], B[c]];
    for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; B[r] -= f * B[c]; }
  }
  return [...B.map((b, i) => b / A[i][i]), 1];
}
const apply = (h, x, y) => { const w = h[6] * x + h[7] * y + h[8]; return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w]; };

function sampleF(a, W, H, x, y) {
  if (x < 0 || y < 0 || x >= W - 1 || y >= H - 1) return 0;
  const x0 = x | 0, y0 = y | 0, tx = x - x0, ty = y - y0, i = y0 * W + x0;
  return (a[i] * (1 - tx) + a[i + 1] * tx) * (1 - ty) + (a[i + W] * (1 - tx) + a[i + W + 1] * tx) * ty;
}
function sampleRGB(d, W, H, x, y) {
  x = Math.min(W - 1.001, Math.max(0, x - 0.5)); y = Math.min(H - 1.001, Math.max(0, y - 0.5));
  const x0 = x | 0, y0 = y | 0, tx = x - x0, ty = y - y0, i = (y0 * W + x0) * 4, j = i + W * 4, o = [0, 0, 0];
  for (let c = 0; c < 3; c++) o[c] = (d[i + c] * (1 - tx) + d[i + 4 + c] * tx) * (1 - ty) + (d[j + c] * (1 - tx) + d[j + 4 + c] * tx) * ty;
  return o;
}

// Fits a smooth paper-white map from the known paper pixels and divides it out.
function whiteBalance(rgb, W, H, isPaper) {
  const cell = 8 * PX, gw = Math.ceil(W / cell), gh = Math.ceil(H / cell), grid = new Float32Array(gw * gh * 3), has = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const vals = [];
    for (let y = gy * cell; y < Math.min(H, (gy + 1) * cell); y += 2) for (let x = gx * cell; x < Math.min(W, (gx + 1) * cell); x += 2) {
      const i = y * W + x; if (isPaper(i)) vals.push(i);
    }
    if (vals.length < 30) continue;
    vals.sort((a, b) => (rgb[b * 3] + rgb[b * 3 + 1] + rgb[b * 3 + 2]) - (rgb[a * 3] + rgb[a * 3 + 1] + rgb[a * 3 + 2]));
    const top = vals.slice(0, Math.ceil(vals.length / 2)), o = (gy * gw + gx) * 3;
    for (const i of top) for (let c = 0; c < 3; c++) grid[o + c] += rgb[i * 3 + c] / top.length;
    has[gy * gw + gx] = 1;
  }
  if (!has.some(Boolean)) return;
  for (let pass = 0; pass < gw + gh && has.some((v) => !v); pass++) {
    const nh = has.slice();
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      const q = gy * gw + gx; if (has[q]) continue;
      let n = 0; const acc = [0, 0, 0];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const x = gx + dx, y = gy + dy; if (x < 0 || y < 0 || x >= gw || y >= gh || !has[y * gw + x]) continue;
        for (let c = 0; c < 3; c++) acc[c] += grid[(y * gw + x) * 3 + c]; n++;
      }
      if (n) { for (let c = 0; c < 3; c++) grid[q * 3 + c] = acc[c] / n; nh[q] = 1; }
    }
    has.set(nh);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const fx = Math.min(gw - 1, Math.max(0, x / cell - 0.5)), fy = Math.min(gh - 1, Math.max(0, y / cell - 0.5));
    const x0 = fx | 0, y0 = fy | 0, x1 = Math.min(gw - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1), tx = fx - x0, ty = fy - y0, i = (y * W + x) * 3;
    for (let c = 0; c < 3; c++) {
      const v = (q) => grid[q * 3 + c];
      const white = (v(y0 * gw + x0) * (1 - tx) + v(y0 * gw + x1) * tx) * (1 - ty) + (v(y1 * gw + x0) * (1 - tx) + v(y1 * gw + x1) * tx) * ty;
      rgb[i + c] = Math.min(255, (rgb[i + c] / Math.max(30, white)) * 250);
    }
  }
}

// Divides out uneven lighting using a coarse bright-percentile map. Returns RGB (3 per pixel).
function flatten(d, W, H) {
  const N = W * H;
  const cell = 24, gw = Math.ceil(W / cell), gh = Math.ceil(H / cell);
  const grid = new Float32Array(gw * gh * 3);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const lums = [];
    for (let y = gy * cell; y < Math.min(H, (gy + 1) * cell); y += 2) for (let x = gx * cell; x < Math.min(W, (gx + 1) * cell); x += 2) {
      const i = (y * W + x) * 4; lums.push([d[i] + d[i + 1] + d[i + 2], i]);
    }
    lums.sort((a, b) => a[0] - b[0]);
    const top = lums.slice(Math.floor(lums.length * 0.9));
    let r = 0, gg = 0, b = 0;
    for (const [, i] of top) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
    const o = (gy * gw + gx) * 3, n = top.length || 1;
    grid[o] = r / n; grid[o + 1] = gg / n; grid[o + 2] = b / n;
  }
  // Paper is the brightest stuff: spread bright cells into dark (heavily coloured) cells with a few max-ish passes.
  for (let pass = 0; pass < 4; pass++) {
    const copy = grid.slice();
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      const o = (gy * gw + gx) * 3; let best = copy[o] + copy[o + 1] + copy[o + 2], bo = o;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = gx + dx, y = gy + dy; if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
        const q = (y * gw + x) * 3, s = copy[q] + copy[q + 1] + copy[q + 2];
        if (s > best * 1.08) { best = s; bo = q; }
      }
      if (bo !== o) { grid[o] = (copy[o] + copy[bo] * 3) / 4; grid[o + 1] = (copy[o + 1] + copy[bo + 1] * 3) / 4; grid[o + 2] = (copy[o + 2] + copy[bo + 2] * 3) / 4; }
    }
  }
  const sample = (x, y, ch) => {
    const fx = Math.min(gw - 1, Math.max(0, x / cell - 0.5)), fy = Math.min(gh - 1, Math.max(0, y / cell - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(gw - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
    const v = (gx, gy) => grid[(gy * gw + gx) * 3 + ch];
    return (v(x0, y0) * (1 - tx) + v(x1, y0) * tx) * (1 - ty) + (v(x0, y1) * (1 - tx) + v(x1, y1) * tx) * ty;
  };
  const norm = new Uint8ClampedArray(N * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x), p = i * 4;
    for (let ch = 0; ch < 3; ch++) norm[i * 3 + ch] = (d[p + ch] / Math.max(40, sample(x, y, ch))) * 255;
  }
  return norm;
}

// Finds the closed dark outline enclosing the most colouring, filled solid (outline included).
function closedOutline(norm, W, H) {
  // Ink = thin strokes clearly darker than their surroundings (survives crayon drawn over the line).
  const N = W * H, ink = new Uint8Array(N), lum = new Float32Array(N);
  for (let i = 0; i < N; i++) lum[i] = (norm[i * 3] + norm[i * 3 + 1] + norm[i * 3 + 2]) / 3;
  const R = Math.max(4, Math.round(Math.max(W, H) / 220)), loc = boxBlur(lum, W, H, R);
  for (let i = 0; i < N; i++) {
    const mx = Math.max(norm[i * 3], norm[i * 3 + 1], norm[i * 3 + 2]), mn = Math.min(norm[i * 3], norm[i * 3 + 1], norm[i * 3 + 2]);
    if (lum[i] < 150 && loc[i] - lum[i] > 38 && mx - mn < 95) ink[i] = 1;
  }
  if (self.BWDBG) { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), d = g.createImageData(W, H);
    for (let i = 0; i < N; i++) { const v = ink[i] ? 0 : 255; d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; } g.putImageData(d, 0, 0); self.BWINK = c.toDataURL(); }
  for (const rad of [1, 3]) {
    const inkD = dilate(ink, W, H, rad), lab = new Int32Array(N), comps = [], stack = [];
    for (let s = 0; s < N; s++) {
      if (!inkD[s] || lab[s]) continue;
      const id = comps.length + 1; let n = 0, minX = W, minY = H, maxX = 0, maxY = 0; lab[s] = id; stack.push(s);
      while (stack.length) {
        const i = stack.pop(), x = i % W, y = (i - x) / W; n++;
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx; if (inkD[j] && !lab[j]) { lab[j] = id; stack.push(j); }
        }
      }
      comps.push({ id, n, minX, minY, maxX, maxY });
    }
    let best = null;
    for (const c of comps.filter((c) => (c.maxX - c.minX) * (c.maxY - c.minY) > N * 0.01).sort((a, b) => b.n - a.n).slice(0, 20)) {
      // Fill: flood the bbox (+1 margin) from its edge through pixels not on this outline; the rest is the solid shape.
      const x0 = Math.max(0, c.minX - 1), y0 = Math.max(0, c.minY - 1), x1 = Math.min(W - 1, c.maxX + 1), y1 = Math.min(H - 1, c.maxY + 1);
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1, out = new Uint8Array(bw * bh), st = [];
      const go = (x, y) => { const k = y * bw + x; if (!out[k] && lab[(y + y0) * W + x + x0] !== c.id) { out[k] = 1; st.push(k); } };
      for (let x = 0; x < bw; x++) { go(x, 0); go(x, bh - 1); } for (let y = 0; y < bh; y++) { go(0, y); go(bw - 1, y); }
      while (st.length) { const k = st.pop(), x = k % bw, y = (k - x) / bw;
        if (x > 0) go(x - 1, y); if (x < bw - 1) go(x + 1, y); if (y > 0) go(x, y - 1); if (y < bh - 1) go(x, y + 1); }
      let area = 0, col = 0, inside = 0;
      for (let k = 0; k < bw * bh; k++) if (!out[k]) {
        area++; const i = ((k / bw | 0) + y0) * W + (k % bw) + x0;
        if (lab[i] !== c.id) { inside++; if (Math.max(norm[i * 3], norm[i * 3 + 1], norm[i * 3 + 2]) - Math.min(norm[i * 3], norm[i * 3 + 1], norm[i * 3 + 2]) > 40) col++; }
      }
      if (area < N * 0.01 || inside < area * 0.3) continue;
      const colFrac = col / inside, edge = c.minX <= 1 || c.minY <= 1 || c.maxX >= W - 2 || c.maxY >= H - 2;
      const cx = (c.minX + c.maxX) / 2 / W - 0.5, cy = (c.minY + c.maxY) / 2 / H - 0.5;
      const score = area * colFrac * colFrac * (edge ? 0.05 : 1) * (1 - Math.hypot(cx, cy));
      if (colFrac > 0.15 && (!best || score > best.score)) best = { score, c, x0, y0, bw, bh, out };
    }
    if (!best) continue;
    // Shape = inside the outline + the whole printed line. Peel light paper pixels off the outer edge (dilation margin).
    const { c, x0, y0, bw, bh, out } = best, comp = new Int32Array(N);
    for (let k = 0; k < bw * bh; k++) if (!out[k]) comp[((k / bw | 0) + y0) * W + (k % bw) + x0] = 1;
    for (let it = 0; it < rad + 3; it++) {
      const peel = [];
      for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) {
        const i = y * W + x; if (!comp[i] || lum[i] < 175) continue;
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1 || !comp[i - 1] || !comp[i + 1] || !comp[i - W] || !comp[i + W]) peel.push(i);
      }
      if (!peel.length) break; for (const i of peel) comp[i] = 0;
    }
    let minX = W, minY = H, maxX = 0, maxY = 0, n = 0;
    for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) if (comp[y * W + x]) {
      n++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    return { comp, best: 1, box: { minX, minY, maxX, maxY, n } };
  }
  return null;
}

function boxBlur(a, W, H, r) {
  const t = new Float32Array(W * H), o = new Float32Array(W * H);
  for (let y = 0; y < H; y++) { let s = 0, n = 0; for (let x = -r; x < W + r; x++) {
    if (x + r < W && x + r >= 0) { s += a[y * W + x + r]; n++; } if (x - r - 1 >= 0 && x - r - 1 < W) { s -= a[y * W + x - r - 1]; n--; } if (x >= 0 && x < W) t[y * W + x] = s / n; } }
  for (let x = 0; x < W; x++) { let s = 0, n = 0; for (let y = -r; y < H + r; y++) {
    if (y + r < H && y + r >= 0) { s += t[(y + r) * W + x]; n++; } if (y - r - 1 >= 0 && y - r - 1 < H) { s -= t[(y - r - 1) * W + x]; n--; } if (y >= 0 && y < H) o[y * W + x] = s / n; } }
  return o;
}

function dilate(m, W, H, r) {
  const t = new Uint8Array(W * H), o = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let d = -r; d <= r && !v; d++) { const xx = x + d; if (xx >= 0 && xx < W && m[y * W + xx]) v = 1; } t[y * W + x] = v; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let d = -r; d <= r && !v; d++) { const yy = y + d; if (yy >= 0 && yy < H && t[yy * W + x]) v = 1; } o[y * W + x] = v; }
  return o;
}

// Fallback for drawings without a closed outline: biggest coloured blob that isn't page/background.
function blobSelect(norm, W, H) {
  const N = W * H;
  // 2. Paper-like pixels: bright and unsaturated after flattening.
  const paper = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const r = norm[i * 3], gg = norm[i * 3 + 1], b = norm[i * 3 + 2];
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    paper[i] = mx > 205 && mx - mn < 38 ? 1 : 0;
  }
  // 3. Flood-fill paper from the image border: that is the background. White wing areas enclosed by outlines survive.
  const bg = new Uint8Array(N), stack = [];
  const push = (i) => { if (paper[i] && !bg[i]) { bg[i] = 1; stack.push(i); } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (stack.length) {
    const i = stack.pop(), x = i % W;
    if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (i >= W) push(i - W); if (i < N - W) push(i + W);
  }
  // Paper inside a table frame is not connected to the border; mark the biggest paper region as background too.
  const lab = new Int32Array(N); let nl = 0; const sizes = [0];
  for (let s = 0; s < N; s++) {
    if (!paper[s] || bg[s] || lab[s]) continue;
    nl++; let n = 0; stack.push(s); lab[s] = nl;
    while (stack.length) {
      const i = stack.pop(), x = i % W; n++;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < N && paper[j] && !bg[j] && !lab[j]) { lab[j] = nl; stack.push(j); }
    }
    sizes.push(n);
  }
  const biggestPaper = sizes.indexOf(Math.max(...sizes));
  if (sizes[biggestPaper] > N * 0.08) for (let i = 0; i < N; i++) if (lab[i] === biggestPaper) bg[i] = 1;

  // 4. Foreground = everything that isn't background paper.
  const fg = new Uint8Array(N);
  for (let i = 0; i < N; i++) fg[i] = bg[i] ? 0 : 1;

  // 5. Connected components of foreground; pick the large, central one that doesn't hug the frame edge.
  const comp = new Int32Array(N); let best = -1, bestScore = -Infinity, nc = 0; const boxes = [];
  for (let s = 0; s < N; s++) {
    if (!fg[s] || comp[s]) continue;
    nc++; let n = 0, minX = W, minY = H, maxX = 0, maxY = 0, edge = 0, chroma = 0; stack.push(s); comp[s] = nc;
    while (stack.length) {
      const i = stack.pop(), x = i % W, y = (i - x) / W; n++;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge++;
      chroma += Math.max(norm[i * 3], norm[i * 3 + 1], norm[i * 3 + 2]) - Math.min(norm[i * 3], norm[i * 3 + 1], norm[i * 3 + 2]);
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < N && fg[j] && !comp[j]) { comp[j] = nc; stack.push(j); }
    }
    const cx = (minX + maxX) / 2 / W - 0.5, cy = (minY + maxY) / 2 / H - 0.5;
    // Anything touching the photo border is table/background, not the drawing.
    // Rings (paper edges, shadows) are sparse in their box and colourless; a coloured butterfly is neither.
    const fill = n / ((maxX - minX + 1) * (maxY - minY + 1)), col = Math.min(2, 0.2 + chroma / n / 30);
    const score = n * (edge > 2 ? 0.02 : 1) * fill * fill * col * (1 - Math.hypot(cx, cy));
    boxes[nc] = { minX, minY, maxX, maxY, n };
    if (score > bestScore) { bestScore = score; best = nc; }
  }
  if (best < 0) throw new Error('Could not find a butterfly in that photo.');
  return { comp, best, box: boxes[best] };
}

// Heuristic cut-out for drawings without registration squares.
async function extractFreehand(source) {
  const c = toCanvas(source, 1400), W = c.width, H = c.height, N = W * H;
  const norm = flatten(pixels(c).data, W, H);

  // Prefer the printed/drawn closed outline: keep exactly what's inside it, drop colouring that strays past it.
  let sel = closedOutline(norm, W, H), outlined = !!sel;
  if (!sel) sel = blobSelect(norm, W, H);
  const { comp, best, box } = sel;
  if (box.n < N * 0.01) throw new Error('The butterfly looks very small. Move closer and try again.');

  // 6. Cut out with a soft edge; pixels are kept exactly as photographed (lighting-corrected only).
  const pad = 6, bx = Math.max(0, box.minX - pad), by = Math.max(0, box.minY - pad);
  const bw = Math.min(W, box.maxX + pad + 1) - bx, bh = Math.min(H, box.maxY + pad + 1) - by, BN = bw * bh;
  const m = new Float32Array(BN), rgb = new Float32Array(BN * 3);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const si = (y + by) * W + (x + bx), i = y * bw + x;
    m[i] = comp[si] === best ? 1 : 0;
    rgb[i * 3] = norm[si * 3]; rgb[i * 3 + 1] = norm[si * 3 + 1]; rgb[i * 3 + 2] = norm[si * 3 + 2];
  }
  if (!outlined) trimStrays(m, rgb, bw, bh);
  const alpha = new Uint8ClampedArray(BN * 4);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    let s = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < bw && yy < bh) { s += m[yy * bw + xx]; n++; } }
    alpha[(y * bw + x) * 4 + 3] = m[y * bw + x] ? 255 * Math.min(1, (s / n) * 1.6 - 0.3) : 0;
  }
  const od = new ImageData(bw, bh);
  for (let i = 0; i < BN; i++) {
    od.data[i * 4] = rgb[i * 3]; od.data[i * 4 + 1] = rgb[i * 3 + 1]; od.data[i * 4 + 2] = rgb[i * 3 + 2]; od.data[i * 4 + 3] = alpha[i * 4 + 3];
  }
  const raw = document.createElement('canvas'); raw.width = bw; raw.height = bh; raw.getContext('2d').putImageData(od, 0, 0);
  return { ...uprightBySymmetry(raw, m), outlined };
}

// Remove marks that stick out of the drawing (crayon overshoot, page bits touching it): morphological opening
// drops anything thinner than ~1.6% of the drawing, then dark ink (outline, antennae) attached to the body is restored
// and enclosed areas are filled back in.
function trimStrays(m, rgb, W, H) {
  const N = W * H, r = Math.max(3, Math.round(Math.max(W, H) * 0.008));
  const dist = (inside) => { const d = new Float32Array(N);
    for (let i = 0; i < N; i++) d[i] = inside(i) ? 1e9 : 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!d[i]) continue;
      if (x > 0) d[i] = Math.min(d[i], d[i - 1] + 1); if (y > 0) d[i] = Math.min(d[i], d[i - W] + 1);
      if (x > 0 && y > 0) d[i] = Math.min(d[i], d[i - W - 1] + 1.414); if (x < W - 1 && y > 0) d[i] = Math.min(d[i], d[i - W + 1] + 1.414);
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) d[i] = Math.min(d[i], 1); }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (!d[i]) continue;
      if (x < W - 1) d[i] = Math.min(d[i], d[i + 1] + 1); if (y < H - 1) d[i] = Math.min(d[i], d[i + W] + 1);
      if (x < W - 1 && y < H - 1) d[i] = Math.min(d[i], d[i + W + 1] + 1.414); if (x > 0 && y < H - 1) d[i] = Math.min(d[i], d[i + W - 1] + 1.414); }
    return d; };
  const din = dist((i) => m[i] > 0);
  const dout = dist((i) => !(din[i] > r));
  const keep = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (m[i] && dout[i] <= r + 0.5) keep[i] = 1;
  let n0 = 0, n1 = 0; for (let i = 0; i < N; i++) { n0 += m[i] > 0; n1 += keep[i]; }
  if (n1 < n0 * 0.6) return;
  const dark = (i) => { const a = rgb[i * 3], b = rgb[i * 3 + 1], c = rgb[i * 3 + 2]; return (a + b + c) / 3 < 120 && Math.max(a, b, c) - Math.min(a, b, c) < 70; };
  const stack = []; for (let i = 0; i < N; i++) if (keep[i]) stack.push(i);
  while (stack.length) { const i = stack.pop(), x = i % W;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < N && !keep[j] && m[j] && dark(j)) { keep[j] = 1; stack.push(j); } }
  // Fill enclosed holes (e.g. a thin white body inside its outline).
  const out = new Uint8Array(N); for (let x = 0; x < W; x++) { stack.push(x, (H - 1) * W + x); } for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) { const i = stack.pop(); if (out[i] || keep[i]) continue; out[i] = 1; const x = i % W;
    if (x > 0) stack.push(i - 1); if (x < W - 1) stack.push(i + 1); if (i >= W) stack.push(i - W); if (i < N - W) stack.push(i + W); }
  for (let i = 0; i < N; i++) m[i] = (keep[i] || (!out[i] && m[i])) ? 1 : 0;
}

// Find the butterfly's mirror axis (any rotation) and turn it upright, head up.
function uprightBySymmetry(canvas, mask) {
  const W = canvas.width, H = canvas.height;
  let cx = 0, cy = 0, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y * W + x]) { cx += x; cy += y; n++; }
  cx /= n; cy /= n;
  const step = Math.max(1, Math.round(Math.max(W, H) / 160)), pts = [];
  for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) if (mask[y * W + x]) pts.push(x - cx, y - cy);
  const at = (x, y) => { x = Math.round(x + cx); y = Math.round(y + cy); return x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x]; };
  // Score: fraction of points whose reflection across the axis (direction angle a, through the centroid) is also inside.
  const score = (a) => { const ux = Math.cos(a), uy = Math.sin(a); let hit = 0;
    for (let i = 0; i < pts.length; i += 2) { const x = pts[i], y = pts[i + 1], d = x * ux + y * uy; if (at(2 * d * ux - x, 2 * d * uy - y)) hit++; }
    return hit / (pts.length / 2); };
  let best = Math.PI / 2, bs = -1;
  for (let a = 0; a < Math.PI; a += Math.PI / 90) { const v = score(a); if (v > bs) { bs = v; best = a; } }
  for (let a = best - Math.PI / 90; a <= best + Math.PI / 90; a += Math.PI / 720) { const v = score(a); if (v > bs) { bs = v; best = a; } }
  // Axis direction (ux, uy). Head end: forewings are larger, so more mass sits on the head side of the wing-span line.
  const ux = Math.cos(best), uy = Math.sin(best);
  let fwd = 0;
  for (let i = 0; i < pts.length; i += 2) { const t = pts[i] * ux + pts[i + 1] * uy, w = Math.abs(pts[i] * -uy + pts[i + 1] * ux); fwd += Math.sign(t) * w; }
  // Rotate so the head direction points up (-y).
  const head = fwd > 0 ? best : best + Math.PI, rot = -Math.PI / 2 - head;
  if (bs < 0.6 || Math.abs(Math.atan2(Math.sin(rot), Math.cos(rot))) < 0.03) return { canvas, cx: cx };
  const D = Math.ceil(Math.hypot(W, H)), r = document.createElement('canvas'); r.width = D; r.height = D;
  const g = r.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high';
  g.translate(D / 2, D / 2); g.rotate(rot); g.drawImage(canvas, -cx, -cy);
  // Crop to content, keeping the axis centred.
  const d = g.getImageData(0, 0, D, D).data; let x0 = D, y0 = D, x1 = 0, y1 = 0;
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) if (d[(y * D + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const half = Math.max(D / 2 - x0, x1 - D / 2) + 2, ow = Math.ceil(half * 2), oh = y1 - y0 + 5;
  const out = document.createElement('canvas'); out.width = ow; out.height = oh;
  out.getContext('2d').drawImage(r, D / 2 - half, y0 - 2, ow, oh, 0, 0, ow, oh);
  return { canvas: out, cx: ow / 2 };
}

// Saturation + gentle contrast lift so marker colours glow on a dark wall.
function vivid(r, g, b) {
  const l = 0.299 * r + 0.587 * g + 0.114 * b;
  const s = 1.45;
  r = l + (r - l) * s; g = l + (g - l) * s; b = l + (b - l) * s;
  const c = (v) => Math.max(0, Math.min(255, (v - 128) * 1.08 + 128 + 6));
  return [c(r), c(g), c(b)];
}

