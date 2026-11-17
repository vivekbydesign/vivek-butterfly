// Optional garden art (caterpillar, painted-paper swatches) kept out of the repo.
// Served from ./local when running the local server; on the hosted site the wall's owner
// imports their own copy once ("Load garden art") and it is kept in this browser only.
let dbp;
const db = () => (dbp ||= new Promise((res, rej) => {
  const r = indexedDB.open('rishis-garden-art', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('f');
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
}));
const urls = new Map();

export async function artSrc(path) {
  if (urls.has(path)) return urls.get(path);
  let src = `./local/${path}`;
  try {
    const d = await db();
    const blob = await new Promise((res) => { const q = d.transaction('f').objectStore('f').get(path); q.onsuccess = () => res(q.result); q.onerror = () => res(null); });
    if (blob) src = URL.createObjectURL(blob);
  } catch {}
  urls.set(path, src);
  return src;
}

// files from <input webkitdirectory>: "local/tex/leafD.jpg" → "tex/leafD.jpg"
export async function importArt(files) {
  const keep = [...files].filter((f) => /\.(png|jpe?g)$/i.test(f.name));
  const d = await db();
  await new Promise((res, rej) => {
    const t = d.transaction('f', 'readwrite'), s = t.objectStore('f');
    for (const f of keep) {
      const parts = (f.webkitRelativePath || f.name).split('/');
      const i = parts.lastIndexOf('tex');
      s.put(f, i >= 0 ? parts.slice(i).join('/') : parts[parts.length - 1]);
    }
    t.oncomplete = res; t.onerror = () => rej(t.error);
  });
  urls.clear();
  return keep.length;
}
