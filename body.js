// Webcam body tracking: white silhouette + perch points (head, shoulders, hands) in video pixel space.
import { STATIC } from './net.js?v=20261121h';
const MP = STATIC ? 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2' : new URL('./vendor/mediapipe', location.href).href;
const { FilesetResolver, PoseLandmarker } = await import(`${MP}/vision_bundle.mjs`);

const LM = { nose: 0, lEar: 7, rEar: 8, lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lWrist: 15, rWrist: 16, lPinky: 17, rPinky: 18, lIndex: 19, rIndex: 20 };

export class BodyTracker {
  constructor() {
    this.video = document.createElement('video');
    this.video.muted = true; this.video.playsInline = true;
    this.sil = document.createElement('canvas');
    this.people = [];
    this.ready = false;
    this.lastTs = -1;
    this.smooth = new Map();
  }

  async start(source) {
    const stream = source || await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false });
    this.video.srcObject = stream;
    await this.video.play();
    this.people = [];
    if (this.pose) return;
    const fileset = await FilesetResolver.forVisionTasks(`${MP}/wasm`);
    const opts = (delegate) => ({ baseOptions: { modelAssetPath: `./models/pose_landmarker_${delegate === 'GPU' ? 'full' : 'lite'}.task`, delegate }, runningMode: 'VIDEO', numPoses: 5, outputSegmentationMasks: true, minPoseDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    this.makeCpu = () => PoseLandmarker.createFromOptions(fileset, opts('CPU'));
    const forceCpu = new URLSearchParams(location.search).has('cpu');
    try { this.pose = forceCpu ? await this.makeCpu() : await PoseLandmarker.createFromOptions(fileset, opts('GPU')); this.delegate = forceCpu ? 'CPU' : 'GPU'; }
    catch { this.pose = await this.makeCpu(); this.delegate = 'CPU'; }
    this.blankMasks = 0;
    this.ready = true;
  }

  stop() {
    const st = this.video.srcObject;
    if (st) st.getTracks().forEach((t) => t.stop());
    this.video.srcObject = null; this.people = []; this.lastVideoTime = -1;
    if (this.sil.width) this.sil.getContext('2d').clearRect(0, 0, this.sil.width, this.sil.height);
  }

  get width() { return this.video.videoWidth; }
  get height() { return this.video.videoHeight; }

  // Call once per animation frame. Returns true when new data arrived.
  update(nowMs) {
    if (!this.ready || this.video.readyState < 2) return false;
    const ts = Math.max(this.lastTs + 1, Math.round(nowMs));
    if (this.video.currentTime === this.lastVideoTime) return false;
    this.lastVideoTime = this.video.currentTime; this.lastTs = ts;
    const vw = this.width, vh = this.height;
    let people = [];
    this.pose.detectForVideo(this.video, ts, (res) => {
      const masks = res.segmentationMasks || [];
      let any = 0;
      if (masks.length) {
        const mw = masks[0].width, mh = masks[0].height, n = mw * mh;
        if (!this.acc || this.acc.length !== n) { this.acc = new Float32Array(n); this.tmp = new Float32Array(n); this.cur = new Float32Array(n); }
        const cur = this.cur; cur.fill(0);
        for (const m of masks) { const f = m.getAsFloat32Array(); for (let i = 0; i < n; i++) if (f[i] > cur[i]) cur[i] = f[i]; m.close(); }
        // Temporal smoothing: rise fast, fall a bit slower, so edges stop flickering without lagging.
        const acc = this.acc;
        for (let i = 0; i < n; i++) { const d = cur[i] - acc[i]; acc[i] += d * (d > 0 ? 0.65 : 0.45); }
        // Two box-blur passes ~ gaussian, then a sharp threshold gives smooth, clean contours and kills specks.
        const r = Math.max(1, Math.round(mw / 160));
        boxBlur(acc, this.tmp, this.cur, mw, mh, r); boxBlur(this.cur, this.tmp, this.cur, mw, mh, r);
        const sm = this.cur;
        const S = 2, ow = vw * S, oh = vh * S;
        if (this.sil.width !== ow || this.sil.height !== oh) { this.sil.width = ow; this.sil.height = oh; this.silData = new ImageData(ow, oh); }
        const out = this.silData.data;
        for (let y = 0; y < oh; y++) {
          const fy = Math.max(0, Math.min(mh - 1.001, (y + 0.5) * mh / oh - 0.5)), y0 = fy | 0, ty = fy - y0, r0 = y0 * mw, r1 = r0 + mw;
          for (let x = 0; x < ow; x++) {
            const o = (y * ow + x) * 4;
            const fx = Math.max(0, Math.min(mw - 1.001, (x + 0.5) * mw / ow - 0.5)), x0 = fx | 0, tx = fx - x0;
            const v = (sm[r0 + x0] * (1 - tx) + sm[r0 + x0 + 1] * tx) * (1 - ty) + (sm[r1 + x0] * (1 - tx) + sm[r1 + x0 + 1] * tx) * ty;
            let a = (v - 0.48) / 0.05;
            if (a <= 0) { out[o + 3] = 0; continue; }
            if (a > 1) a = 1; else a = a * a * (3 - 2 * a);
            out[o] = out[o + 1] = out[o + 2] = 255; out[o + 3] = a * 255; any++;
          }
        }
      } else { if (this.silData) this.silData.data.fill(0); if (this.acc) this.acc.fill(0); }
      if (this.silData) this.sil.getContext('2d').putImageData(this.silData, 0, 0);
      // Some GPUs can't read the mask back; switch to CPU if people are found but the mask stays blank.
      this.blankMasks = (res.landmarks || []).length && !any ? this.blankMasks + 1 : 0;
      const lms = res.landmarks || [];
      const ids = this.track(lms, nowMs);
      people = lms.map((lm, i) => this.anchors(lm, ids[i], vw, vh, nowMs));
    });
    this.people = people;
    if (this.blankMasks > 15 && this.delegate === 'GPU' && !this.switching) {
      this.switching = true;
      this.makeCpu().then((pose) => { this.pose.close(); this.pose = pose; this.delegate = 'CPU'; this.blankMasks = 0; console.info('Pose: switched to CPU for segmentation'); });
    }
    return true;
  }

  // Detections come back in no fixed order; match them to last frame's people by torso position
  // so each person keeps a stable id (and their butterflies) as people move around each other.
  track(lms, now) {
    this.tracks = (this.tracks || []).filter((t) => now - t.t < 1200);
    const dets = lms.map((lm) => { const pts = [11, 12, 23, 24].map((i) => lm[i]); return { x: pts.reduce((a, p) => a + p.x, 0) / 4, y: pts.reduce((a, p) => a + p.y, 0) / 4, s: Math.hypot(lm[11].x - lm[12].x, lm[11].y - lm[12].y) || 0.2 }; });
    const pairs = [];
    dets.forEach((d, i) => this.tracks.forEach((t, j) => { const dist = Math.hypot(d.x - t.x, d.y - t.y); if (dist < Math.max(0.12, d.s * 1.5)) pairs.push([dist, i, j]); }));
    pairs.sort((a, b) => a[0] - b[0]);
    const ids = new Array(dets.length).fill(null), used = new Set();
    for (const [, i, j] of pairs) if (ids[i] === null && !used.has(j)) { ids[i] = this.tracks[j].id; used.add(j); Object.assign(this.tracks[j], dets[i], { t: now }); }
    dets.forEach((d, i) => { if (ids[i] === null) { this.nextId = (this.nextId || 0) + 1; ids[i] = this.nextId; this.tracks.push({ id: this.nextId, ...d, t: now }); } });
    if (this.smooth.size > 400) for (const [k, v] of this.smooth) if (now - v.t > 3000) this.smooth.delete(k);
    return ids;
  }

  anchors(lm, idx, vw, vh, now) {
    const P = (i) => ({ x: lm[i].x * vw, y: lm[i].y * vh, v: lm[i].visibility ?? 1 });
    const ls = P(LM.lShoulder), rs = P(LM.rShoulder), nose = P(LM.nose), le = P(LM.lEar), re = P(LM.rEar);
    const shoulderW = Math.hypot(ls.x - rs.x, ls.y - rs.y) || vw * 0.2;
    const hand = (w, p, ix) => { const a = P(w), b = P(p), c = P(ix); return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 - shoulderW * 0.08, v: Math.min(a.v, c.v) }; };
    const earMidX = (le.x + re.x) / 2, earMidY = (le.y + re.y) / 2;
    const raw = {
      head: { x: earMidX * 0.5 + nose.x * 0.5, y: Math.min(earMidY, nose.y) - shoulderW * 0.42, v: nose.v },
      lShoulder: { x: ls.x + (ls.x - rs.x) * 0.05, y: ls.y - shoulderW * 0.07, v: ls.v },
      rShoulder: { x: rs.x + (rs.x - ls.x) * 0.05, y: rs.y - shoulderW * 0.07, v: rs.v },
      lHand: hand(LM.lWrist, LM.lPinky, LM.lIndex),
      rHand: hand(LM.rWrist, LM.rPinky, LM.rIndex),
      lElbow: P(LM.lElbow), rElbow: P(LM.rElbow), lHip: P(LM.lHip), rHip: P(LM.rHip), lKnee: P(LM.lKnee), rKnee: P(LM.rKnee),
    };
    const out = { id: idx, scale: shoulderW / vw, points: {} };
    for (const [k, p] of Object.entries(raw)) {
      const key = `${idx}:${k}`, prev = this.smooth.get(key);
      let s;
      if (prev && now - prev.t < 400) {
        const dt = Math.max(1, now - prev.t) / 1000, a = 0.55;
        const x = prev.x + (p.x - prev.x) * a, y = prev.y + (p.y - prev.y) * a;
        const sp = Math.hypot(x - prev.x, y - prev.y) / dt / vw; // fraction of frame width per second
        s = { x, y, t: now, speed: prev.speed * 0.6 + sp * 0.4, still: sp < 0.18 ? prev.still + dt : 0, v: p.v };
      } else s = { x: p.x, y: p.y, t: now, speed: 0, still: 0, v: p.v };
      this.smooth.set(key, s);
      out.points[k] = { ...s, key, kind: k.includes('Hand') ? 'hand' : k === 'head' ? 'head' : k.includes('Shoulder') ? 'shoulder' : 'limb', ok: p.v > 0.5 && p.x > 0 && p.x < vw && p.y > 0 && p.y < vh };
    }
    return out;
  }
}

function boxBlur(src, tmp, dst, w, h, r) {
  const k = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w; let sum = 0;
    for (let x = -r; x <= r; x++) sum += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) { tmp[row + x] = sum * k; sum += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)]; }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) { dst[y * w + x] = sum * k; sum += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; }
  }
}
