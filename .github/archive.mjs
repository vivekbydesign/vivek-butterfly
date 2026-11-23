// Runs in the site repo's GitHub Action: saves new relay butterflies into garden/ so every visitor sees them.
import fs from 'fs';
const TOPIC = 'bw-rishis-garden-b6a66151', IDX = 'garden/index.json';
const idx = JSON.parse(fs.readFileSync(IDX, 'utf8')), have = new Set(idx.map((x) => x.id));
const lines = (await (await fetch(`https://ntfy.sh/${TOPIC}/json?poll=1&since=12h`)).text()).split('\n').filter(Boolean);
let added = 0;
for (const l of lines) {
  const m = JSON.parse(l), a = m.attachment;
  if (m.event !== 'message' || !a || a.type !== 'image/png' || a.size > 9e6 || have.has(m.id)) continue;
  const name = String(m.message || '').startsWith('n:') ? m.message.slice(2, 42) : '';
  if (idx.some((x) => x.name === name && Math.abs(x.created - m.time * 1000) < 60000)) continue;
  const r = await fetch(a.url); if (!r.ok) continue;
  fs.writeFileSync(`garden/${m.id}.png`, Buffer.from(await r.arrayBuffer()));
  idx.push({ id: m.id, name, file: `${m.id}.png`, created: m.time * 1000 });
  have.add(m.id); added++;
}
if (added) fs.writeFileSync(IDX, JSON.stringify(idx, null, 1));
console.log('added', added);
