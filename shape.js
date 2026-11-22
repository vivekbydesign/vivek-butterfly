// Right-half butterfly geometry in a 200x160 box centred on the body (x=0). Left half is mirrored.
export const WING = {
  outline: 'M4,-20 C20,-44 50,-74 86,-81 C96,-82 100,-74 98,-62 C96,-46 88,-22 76,-10 C68,-2 56,2 48,3 C60,8 72,18 73,32 C74,42 70,46 68,52 C66,58 60,58 58,63 C56,70 52,73 46,72 C34,70 24,54 14,36 C9,26 6,16 4,8 Z',
  upper: 'M4,-20 C20,-44 50,-74 86,-81 C96,-82 100,-74 98,-62 C96,-46 88,-22 76,-10 C68,-2 56,2 48,3 L4,4 Z',
  lower: 'M4,4 L48,3 C60,8 72,18 73,32 C74,42 70,46 68,52 C66,58 60,58 58,63 C56,70 52,73 46,72 C34,70 24,54 14,36 C9,26 6,16 4,8 Z',
  upperSpots: [[72, -58, 9], [48, -34, 6], [88, -62, 4]],
  lowerSpots: [[52, 40, 8], [32, 28, 5]],
  upperVeins: ['M4,-4 C30,-30 55,-55 80,-72', 'M4,-3 C40,-20 70,-30 92,-40', 'M4,-6 C20,-30 30,-48 40,-60'],
  lowerVeins: ['M4,4 C24,20 36,40 44,64', 'M4,3 C30,10 52,20 68,34'],
  body: 'M0,-24 C4,-24 4.5,-10 4,6 C3.5,26 2,46 0,50 C-2,46 -3.5,26 -4,6 C-4.5,-10 -4,-24 0,-24 Z',
  antenna: 'M2,-34 C5,-42 12,-52 20,-60',
  club: [20, -60, 2.2],
};

const mirror = (d) => d.replace(/(-?\d+(?:\.\d+)?),/g, (_, x) => `${-Number(x)},`);

export function templateSvg({ stroke = '#111', width = 1.4 } = {}) {
  const [cx, cy, cr] = WING.club;
  const half = (flip) => {
    const t = flip ? mirror : (d) => d;
    return `<path d="${t(WING.outline)}"/><path d="${t(WING.antenna)}"/><circle cx="${flip ? -cx : cx}" cy="${cy}" r="${cr}"/>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-104 -82 208 156" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round">
    ${half(false)}${half(true)}<path d="${WING.body}"/><circle cx="0" cy="-30" r="4.5"/>
  </svg>`;
}

// Printed sheet: butterfly plus four registration squares. Top-left is a ring so orientation is unambiguous.
export const SHEET = {
  viewBox: [-124, -110, 248, 214],
  markers: [[-112, -98], [112, -98], [112, 92], [-112, 92]],
  markerSize: 14,
  ringHole: 6,
};
// Area the cut-out covers (template units), matches templateSvg's viewBox.
export const ART = { x: -104, y: -82, w: 208, h: 156 };

export function sheetSvg({ stroke = '#111', width = 1.1 } = {}) {
  const inner = templateSvg({ stroke, width }).replace(/^<svg[^>]*>|<\/svg>\s*$/g, '');
  const s = SHEET.markerSize, h = SHEET.ringHole;
  const marks = SHEET.markers.map(([x, y], i) => i === 0
    ? `<path fill="#000" fill-rule="evenodd" d="M${x - s / 2},${y - s / 2}h${s}v${s}h${-s}Z M${x - h / 2},${y - h / 2}h${h}v${h}h${-h}Z"/>`
    : `<rect fill="#000" x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}"/>`).join('');
  const [vx, vy, vw, vh] = SHEET.viewBox;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}">
    ${marks}<g fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round">${inner}</g>
  </svg>`;
}

// Draws the butterfly silhouette (template units) into ctx — used as the cut-out mask.
export function fillSilhouette(g, { outline = 1.8, antenna = 2.6 } = {}) {
  g.fillStyle = g.strokeStyle = '#000';
  g.lineJoin = 'round'; g.lineCap = 'round';
  for (const flip of [1, -1]) {
    g.save(); g.scale(flip, 1);
    for (const d of [WING.upper, WING.lower]) { const p = new Path2D(d); g.fill(p); if (outline) { g.lineWidth = outline; g.stroke(p); } }
    if (antenna) { g.lineWidth = antenna; g.stroke(new Path2D(WING.antenna)); g.beginPath(); g.arc(WING.club[0], WING.club[1], WING.club[2] + antenna / 2, 0, 7); g.fill(); }
    g.restore();
  }
  const body = new Path2D(WING.body); g.fill(body); if (outline) { g.lineWidth = outline; g.stroke(body); }
  g.beginPath(); g.arc(0, -30, 4.5 + outline / 2, 0, 7); g.fill();
}

const PALETTES = [
  ['#ffd6e7', '#ff8fb8', '#ffffff', '#ff4f8b'],
  ['#fff3f8', '#f9b4d0', '#c78bff', '#ff6fa8'],
  ['#ffe2a8', '#ff9a3c', '#ff4b6e', '#7b2cbf'],
  ['#9be7ff', '#3a86ff', '#c1f7ff', '#1b3fa0'],
  ['#ffffff', '#ffd1e8', '#ffc4a3', '#ff8fab'],
  ['#ff5f6d', '#ffc371', '#fff6c2', '#7a1f3d'],
  ['#b8f2e6', '#5eead4', '#a78bfa', '#312e81'],
  ['#ffe066', '#ff6b6b', '#4ecdc4', '#1a535c'],
  ['#ffffff', '#f3e8ff', '#e9d5ff', '#c084fc'],
];

// Paints a full procedural butterfly onto a canvas, returns { canvas, cx }.
export function paintButterfly(scale = 2, seed = Math.random()) {
  const rnd = mulberry(Math.floor(seed * 1e9));
  const pal = PALETTES[Math.floor(rnd() * PALETTES.length)];
  const c = document.createElement('canvas');
  c.width = 208 * scale; c.height = 156 * scale;
  const g = c.getContext('2d');
  g.translate(104 * scale, 82 * scale);
  g.scale(scale, scale);
  const pick = () => pal[Math.floor(rnd() * pal.length)];
  const rainbow = rnd() < 0.18;
  for (const flip of [1, -1]) {
    g.save();
    g.scale(flip, 1);
    const up = new Path2D(WING.upper), lo = new Path2D(WING.lower);
    for (const [path, y0, y1, spots] of [[up, -70, 0, WING.upperSpots], [lo, 0, 64, WING.lowerSpots]]) {
      const gr = rainbow ? g.createLinearGradient(0, y0, 90, y1) : g.createRadialGradient(0, 0, 4, 0, 0, 95);
      if (rainbow) ['#ff4d6d', '#ffb703', '#8ac926', '#1982c4', '#6a4c93'].forEach((col, i) => gr.addColorStop(i / 4, col));
      else { gr.addColorStop(0, pal[0]); gr.addColorStop(0.55, pal[1]); gr.addColorStop(1, pal[3]); }
      g.fillStyle = gr; g.fill(path);
      g.save(); g.clip(path);
      g.globalAlpha = 0.85;
      for (const [x, y, r] of spots) { g.fillStyle = pick(); g.beginPath(); g.arc(x, y, r * (0.8 + rnd() * 0.6), 0, 7); g.fill(); }
      g.globalAlpha = 0.35; g.strokeStyle = pal[3]; g.lineWidth = 1.1;
      for (const d of [...WING.upperVeins, ...WING.lowerVeins]) g.stroke(new Path2D(d));
      g.globalAlpha = 0.9; g.lineWidth = 5; g.strokeStyle = pal[3]; g.stroke(path);
      g.restore();
      g.lineWidth = 1; g.strokeStyle = 'rgba(30,10,20,.55)'; g.stroke(path);
    }
    g.strokeStyle = '#2a1a22'; g.lineWidth = 1; g.stroke(new Path2D(WING.antenna));
    g.restore();
  }
  g.fillStyle = '#2a1a22'; g.fill(new Path2D(WING.body));
  g.beginPath(); g.arc(0, -30, 4.5, 0, 7); g.fill();
  return { canvas: c, cx: c.width / 2 };
}

function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
