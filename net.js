// How butterflies travel from phone to wall.
// - Local server (npm start): POST /api/butterflies + server-sent events, stored on disk.
// - Static hosting (GitHub Pages, or ?p2p): the phone sends straight to the wall over WebRTC (PeerJS),
//   and the wall keeps its butterflies in this browser's IndexedDB.
export const STATIC = location.hostname.endsWith('github.io') || new URLSearchParams(location.search).has('p2p');
const PEERJS = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/+esm';
const QRLIB = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm';

export function wallId() {
  const fromUrl = new URLSearchParams(location.search).get('wall');
  if (fromUrl) return fromUrl;
  let id = localStorage.getItem('rg-wall');
  if (!id) { id = 'rishis-garden-' + crypto.randomUUID().slice(0, 8); localStorage.setItem('rg-wall', id); }
  return id;
}
export const uploadUrl = () => new URL(`upload.html?wall=${wallId()}${location.hostname.endsWith('github.io') ? '' : '&p2p'}`, location.href).href;
export async function qrSrc() {
  if (!STATIC) return './qr.svg';
  const QR = await import(QRLIB);
  return QR.toDataURL(uploadUrl(), { margin: 1, width: 512, color: { dark: '#2a1a0a', light: '#ffffff' } });
}

let dbp;
const db = () => (dbp ||= new Promise((res, rej) => {
  const r = indexedDB.open('rishis-garden', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('b', { keyPath: 'id' });
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
}));
const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('b', mode), req = fn(t.objectStore('b')); t.oncomplete = () => res(req?.result); t.onerror = () => rej(t.error); }); };

export async function listButterflies() {
  if (!STATIC) return (await fetch('./api/butterflies')).json();
  const all = (await tx('readonly', (s) => s.getAll())) || [];
  return all.sort((a, b) => a.created - b.created).map((x) => ({ ...x, url: x.image }));
}
export async function clearButterflies() {
  if (!STATIC) return fetch('./api/butterflies', { method: 'DELETE' });
  await tx('readwrite', (s) => s.clear());
}

// Wall side: call add(item) for each new butterfly, reset() when the wall is cleared.
export function listen(add, reset) {
  if (!STATIC) {
    const es = new EventSource('./events');
    es.addEventListener('butterfly', (e) => add(JSON.parse(e.data)));
    es.addEventListener('reset', reset);
    return;
  }
  import(PEERJS).then(({ Peer }) => {
    const open = () => {
      const peer = new Peer(wallId());
      peer.on('open', (id) => console.info('Wall online as', id, '→', uploadUrl()));
      peer.on('connection', (conn) => conn.on('data', async (msg) => {
        if (!msg || typeof msg.image !== 'string' || !msg.image.startsWith('data:image/png;base64,') || msg.image.length > 12e6) return conn.send({ ok: false });
        const item = { id: crypto.randomUUID(), image: msg.image, name: String(msg.name || '').slice(0, 40), created: Date.now() };
        try { await tx('readwrite', (s) => s.put(item)); } catch (e) { console.warn('Could not save butterfly', e); }
        add({ ...item, url: item.image });
        conn.send({ ok: true });
      }));
      addEventListener('pagehide', () => peer.destroy(), { once: true });
      peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
      peer.on('error', (e) => { console.warn('Wall connection:', e.type); if (['network', 'server-error', 'socket-error', 'socket-closed', 'unavailable-id'].includes(e.type)) { peer.destroy(); setTimeout(open, 5000); } });
    };
    open();
  });
}

// Phone side.
export async function sendButterfly(image, name) {
  if (!STATIC) {
    const res = await fetch('./api/butterflies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image, name }) });
    if (!res.ok) throw new Error(await res.text());
    return;
  }
  const wall = new URLSearchParams(location.search).get('wall');
  if (!wall) throw new Error('Scan the QR code on the garden screen to send your butterfly.');
  const { Peer } = await import(PEERJS);
  const peer = new Peer();
  try {
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('The garden isn’t answering. Is the screen switched on?')), 25000);
      const fail = (e) => { clearTimeout(t); rej(e); };
      peer.on('error', (e) => fail(new Error(e.type === 'peer-unavailable' ? 'The garden screen isn’t online right now.' : e.message)));
      peer.on('open', () => {
        const conn = peer.connect(wall, { reliable: true });
        conn.on('open', () => conn.send({ image, name }));
        conn.on('data', (m) => { clearTimeout(t); m?.ok ? res() : rej(new Error('The garden couldn’t take that picture.')); });
        conn.on('error', fail);
      });
    });
  } finally { setTimeout(() => peer.destroy(), 1000); }
}
