// Notificações Web Push (incluindo iPhone com o site instalado no ecrã principal), só com WebCrypto.
//
// Envia-se um "push" sem conteúdo, assinado com VAPID (RFC 8292). Ao recebê-lo, o service worker
// (public/sw.js) pede /api/push/ultimo e mostra o aviso mais recente. Sem conteúdo não é preciso
// cifrar a mensagem (RFC 8291), o que evita bibliotecas e funciona igual em todos os serviços de push.

const enc = (s) => new TextEncoder().encode(s);

export const b64u = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export const fromB64u = (s) => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(t + '==='.slice((t.length + 3) % 4)), (c) => c.charCodeAt(0));
};

/** Serviços de push conhecidos (Apple, Google, Mozilla, Microsoft): evita usar o servidor para chamar outros endereços. */
const PUSH_HOSTS = [/^web\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/];

export function validSubscription(sub) {
  try {
    const u = new URL(sub?.endpoint);
    if (u.protocol !== 'https:' || !PUSH_HOSTS.some((h) => h.test(u.hostname))) return false;
    return typeof sub.keys?.p256dh === 'string' && typeof sub.keys?.auth === 'string' && sub.endpoint.length < 1000;
  } catch {
    return false;
  }
}

/**
 * Cabeçalhos VAPID para um endereço de push.
 * @param keys { publicKey: chave pública P-256 não comprimida (base64url, 65 bytes), privateKey: "d" (base64url), subject }
 */
export async function vapidHeaders(endpoint, keys, now = Date.now()) {
  const header = b64u(enc(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = { aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: keys.subject };
  const payload = b64u(enc(JSON.stringify(claims)));
  const pub = fromB64u(keys.publicKey);
  const jwk = { kty: 'EC', crv: 'P-256', x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), d: keys.privateKey, ext: true };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  // O WebCrypto devolve a assinatura no formato r||s (64 bytes), que é o que o JWT ES256 exige.
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc(`${header}.${payload}`));
  return {
    Authorization: `vapid t=${header}.${payload}.${b64u(sig)}, k=${keys.publicKey}`,
    TTL: '3600',
    Urgency: 'high',
  };
}

/** Envia um push vazio. Devolve o código HTTP (201 = aceite; 404/410 = subscrição expirada). */
export async function sendPush(sub, keys, { fetchImpl = fetch, now = Date.now(), timeoutMs = 5000 } = {}) {
  const headers = { ...(await vapidHeaders(sub.endpoint, keys, now)), 'Content-Length': '0' };
  const r = await fetchImpl(sub.endpoint, { method: 'POST', headers, signal: AbortSignal.timeout(timeoutMs) });
  await r.body?.cancel();
  return r.status;
}

/** Avisos que merecem uma notificação no telemóvel (os restantes ficam só na página). */
export function pushWorthy(notice) {
  if (notice.kind === 'projecao') return true;
  return notice.uf === 'BR' && ['virada', 'marco', 'eleito'].includes(notice.kind);
}
