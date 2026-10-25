// Só repete leituras. Nunca repetir automaticamente uma escrita/recolha.
const KEY = 'https://varrendo-a-esquerda.tomaspereira.chatgpt.site/__snapshot-v22';
const MAX_AGE = 10 * 60_000;
const permanent = /syntax|no such|has no column|constraint|quota|limit exceeded|unauthoriz/i;

export function errorDetail(error) {
  const parts = [];
  for (let e = error, i = 0; e && i < 4; e = e.cause, i++) parts.push(String(e.message ?? e));
  return parts.join(' → ');
}

/** Última fotografia válida na cache do Worker; sempre identificada se a D1 falhar. */
export async function readSnapshot(read, {
  cache = globalThis.caches?.default,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  let failure;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const data = await read();
      if (cache) {
        try {
          await cache.put(new Request(KEY), Response.json(data, { headers: { 'cache-control': 'public, max-age=600' } }));
        } catch (e) { console.warn('Cache de resultados:', errorDetail(e)); }
      }
      return data;
    } catch (e) {
      failure = e;
      console.error('Leitura de resultados:', errorDetail(e));
      if (permanent.test(errorDetail(e))) break;
      if (attempt < 2) await sleep(attempt ? 300 : 100);
    }
  }
  if (cache) {
    try {
      const response = await cache.match(new Request(KEY));
      const saved = response && await response.json();
      if (saved && now() >= saved.serverNow && now() - saved.serverNow <= MAX_AGE) {
        return { ...saved, serverNow: now(), availability: { cachedAt: saved.serverNow } };
      }
    } catch (e) { console.warn('Cache de resultados:', errorDetail(e)); }
  }
  throw failure;
}
