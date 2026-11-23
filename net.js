// How butterflies travel from phone to wall.
// - Local server (npm start): POST /api/butterflies + server-sent events, stored on disk.
// - Static hosting (GitHub Pages, or ?p2p): the phone sends straight to the wall over WebRTC (PeerJS),
//   and the wall keeps its butterflies in this browser's IndexedDB.
export const STATIC = location.hostname.endsWith('github.io') || new URLSearchParams(location.search).has('p2p');
const PEERJS = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/+esm';
const QRLIB = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm';
const RELAY = 'https://ntfy.sh';
const relayTopic = (wall) => 'bw-' + wall;

export function wallId() {
  const fromUrl = new URLSearchParams(location.search).get('wall');
  if (fromUrl) return fromUrl;
  // Fixed so the printed sheets' QR codes always reach the garden, on any TV/browser.
  return 'rishis-garden-b6a66151';
}
export const uploadUrl = () => new URL(`upload.html?wall=${wallId()}${location.hostname.endsWith('github.io') ? '' : '&p2p'}`, location.href).href;
export async function qrSrc() {
  if (!STATIC) return './qr.svg';
  const QR = await import(QRLIB);
  return QR.toDataURL(uploadUrl(), { margin: 1, width: 512, color: { dark: '#2a1a0a', light: '#ffffff' } });
}

let dbp;
const db = () => (dbp ||= new Promise((res, rej) => {
  const r = indexedDB.open('rishis-garden', 2);
  r.onupgradeneeded = (e) => {
    const d = r.result;
    if (!d.objectStoreNames.contains('b')) d.createObjectStore('b', { keyPath: 'id' });
    if (!d.objectStoreNames.contains('keep')) {
      // Permanent archive of every upload; clearing the wall leaves it alone.
      const keep = d.createObjectStore('keep', { keyPath: 'id' });
      if (e.oldVersion >= 1) r.transaction.objectStore('b').getAll().onsuccess = (g) => g.target.result.forEach((x) => keep.put(x));
    }
  };
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
}));
const tx = async (mode, fn, store = 'b') => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(store, mode), req = fn(t.objectStore(store)); t.oncomplete = () => res(req?.result); t.onerror = () => rej(t.error); }); };

export async function listButterflies() {
  if (!STATIC) return (await fetch('./api/butterflies')).json();
  const all = (await tx('readonly', (s) => s.getAll())) || [];
  return all.sort((a, b) => a.created - b.created).map((x) => ({ ...x, url: x.image }));
}
// Shared garden: every relay butterfly, archived into the site by a GitHub Action (garden/index.json).
export async function gardenButterflies() {
  if (!STATIC) return [];
  try { return (await (await fetch('./garden/index.json?t=' + Date.now())).json()).map((x) => ({ ...x, url: './garden/' + x.file })); } catch { return []; }
}
// Every butterfly ever uploaded (including ones cleared from the wall), oldest first.
export async function savedButterflies() {
  if (!STATIC) return listButterflies();
  const all = (await tx('readonly', (s) => s.getAll(), 'keep')) || [];
  return all.sort((a, b) => a.created - b.created).map((x) => ({ ...x, url: x.image }));
}
// Delete one butterfly from the wall and the archive (for tests and mistakes).
export async function removeButterfly(id) {
  if (!STATIC) return fetch('./api/butterflies/' + encodeURIComponent(id), { method: 'DELETE' });
  await tx('readwrite', (s) => s.delete(id)); await tx('readwrite', (s) => s.delete(id), 'keep');
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
  const receive = async (image, name, id, created) => {
    const item = { id: id || crypto.randomUUID(), image, name: String(name || '').slice(0, 40), created: created || Date.now() };
    try { await tx('readwrite', (s) => s.put(item)); await tx('readwrite', (s) => s.put(item), 'keep'); } catch (e) { console.warn('Could not save butterfly', e); }
    add({ ...item, url: item.image });
  };
  // Relay path: works when phones aren't on the TV's Wi-Fi.
  const seen = new Set();
  const relay = new EventSource(`${RELAY}/${relayTopic(wallId())}/sse`);
  relay.onmessage = async (e) => {
    try {
      const m = JSON.parse(e.data), a = m.attachment;
      if (m.event !== 'message' || !a || seen.has(m.id) || a.type !== 'image/png' || a.size > 9e6) return;
      seen.add(m.id);
      const blob = await (await fetch(a.url)).blob();
      const image = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
      await receive(image, String(m.message || '').startsWith('n:') ? m.message.slice(2) : '', m.id, m.time * 1000);
    } catch (err) { console.warn('Relay butterfly failed', err); }
  };
  import(PEERJS).then(({ Peer }) => {
    const open = () => {
      const peer = new Peer(wallId());
      peer.on('open', (id) => console.info('Wall online as', id, '→', uploadUrl()));
      peer.on('connection', (conn) => conn.on('data', async (msg) => {
        if (!msg || typeof msg.image !== 'string' || !msg.image.startsWith('data:image/png;base64,') || msg.image.length > 12e6) return conn.send({ ok: false });
        await receive(msg.image, msg.name);
        conn.send({ ok: true });
      }));
      addEventListener('pagehide', () => peer.destroy(), { once: true });
      peer.on('disconnected', () => { if (!peer.destroyed) setTimeout(() => !peer.destroyed && peer.disconnected && peer.reconnect(), 1000); });
      const wake = () => { if (!peer.destroyed && peer.disconnected) peer.reconnect(); };
      document.addEventListener('visibilitychange', wake); addEventListener('online', wake); addEventListener('focus', wake); setInterval(wake, 20000);
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
  try { return await sendRelay(wall, image, name); } catch (e) { console.warn('Relay send failed, trying direct', e); }
  const { Peer } = await import(PEERJS);
  // The wall may be briefly offline (screen waking, page reloading): retry a few times before giving up.
  let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 4000));
    try { return await sendOnce(Peer, wall, image, name); }
    catch (e) { last = e; if (e.final) break; }
  }
  throw last;
}
async function sendRelay(wall, image, name) {
  const blob = await (await fetch(image)).blob();
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 45000);
  try {
    const res = await fetch(`${RELAY}/${relayTopic(wall)}?filename=butterfly.png&message=${encodeURIComponent('n:' + String(name || '').slice(0, 40))}`, { method: 'PUT', body: blob, signal: ctl.signal });
    if (!res.ok) throw new Error('Relay ' + res.status);
  } finally { clearTimeout(t); }
}
async function sendOnce(Peer, wall, image, name) {
  const peer = new Peer();
  try {
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('The garden isn’t answering. Is the screen switched on?')), 20000);
      const fail = (e) => { clearTimeout(t); rej(e); };
      peer.on('error', (e) => fail(new Error(e.type === 'peer-unavailable' ? 'The garden screen isn’t online right now. Check the TV is on and the garden page is open.' : e.message)));
      peer.on('open', () => {
        const conn = peer.connect(wall, { reliable: true });
        conn.on('open', () => conn.send({ image, name }));
        conn.on('data', (m) => { clearTimeout(t); if (m?.ok) res(); else { const e = new Error('The garden couldn’t take that picture.'); e.final = true; rej(e); } });
        conn.on('error', fail);
      });
    });
  } finally { setTimeout(() => peer.destroy(), 1000); }
}
