import test from 'node:test';
import assert from 'node:assert/strict';
import { vapidHeaders, sendPush, validSubscription, pushWorthy, b64u, fromB64u } from '../lib/webpush.mjs';
import { D1Store } from '../lib/store.mjs';
import { dispatchPush, projectionNotices } from '../lib/collector.mjs';
import { jobsFor, ROUND } from '../lib/rounds.mjs';
import { parseRunoff } from '../lib/runoff.mjs';
import { round2File, database } from './round2-files.mjs';

const T0 = ROUND.pollsCloseAt + 3_600_000;
const APPLE = 'https://web.push.apple.com/QGuQyavXutnMH-abc';

async function keys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicKey = b64u(await crypto.subtle.exportKey('raw', pair.publicKey));
  const { d } = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicKey, privateKey: d, subject: 'mailto:teste@example.com', verifyKey: pair.publicKey };
}

test('VAPID: JWT ES256 válido para o serviço de push, assinado com a chave privada', async () => {
  const k = await keys();
  const h = await vapidHeaders(APPLE, k, T0);
  const [, token, pub] = h.Authorization.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.equal(pub, k.publicKey);
  const [head, payload, sig] = token.split('.');
  const claims = JSON.parse(new TextDecoder().decode(fromB64u(payload)));
  assert.equal(claims.aud, 'https://web.push.apple.com');
  assert.equal(claims.sub, 'mailto:teste@example.com');
  assert.ok(claims.exp > T0 / 1000 && claims.exp <= T0 / 1000 + 24 * 3600);
  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    k.verifyKey,
    fromB64u(sig),
    new TextEncoder().encode(`${head}.${payload}`),
  );
  assert.equal(ok, true);
  assert.equal(h.TTL, '3600');
});

test('só aceita subscrições de serviços de push conhecidos, em https', () => {
  const keysOk = { p256dh: 'x', auth: 'y' };
  assert.equal(validSubscription({ endpoint: APPLE, keys: keysOk }), true);
  assert.equal(validSubscription({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: keysOk }), true);
  assert.equal(validSubscription({ endpoint: 'https://evil.example.com/x', keys: keysOk }), false);
  assert.equal(validSubscription({ endpoint: 'http://web.push.apple.com/x', keys: keysOk }), false);
  assert.equal(validSubscription({ endpoint: APPLE }), false);
});

test('envio: push vazio com cabeçalhos VAPID', async () => {
  const k = await keys();
  let seen;
  const status = await sendPush({ endpoint: APPLE }, k, {
    now: T0,
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return new Response(null, { status: 201 });
    },
  });
  assert.equal(status, 201);
  assert.equal(seen.init.method, 'POST');
  assert.equal(seen.init.headers['Content-Length'], '0');
  assert.match(seen.init.headers.Authorization, /^vapid t=/);
});

test('notificações: só avisos importantes, uma vez, e subscrições expiradas são apagadas', async () => {
  const k = await keys();
  const store = new D1Store(database());
  await store.pushSubscribe({ endpoint: APPLE, keys: { p256dh: 'a', auth: 'b' } }, T0);
  await store.pushSubscribe({ endpoint: 'https://fcm.googleapis.com/fcm/send/velho', keys: { p256dh: 'a', auth: 'b' } }, T0);
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return new Response(null, { status: url.includes('velho') ? 410 : 201 });
  };
  // Aviso sem importância (estado decidido): não envia.
  await store.addNotice({ id: 'x1', key: '2026:2:SP:1', kind: 'estado', uf: 'SP', cargo: 1, title: 't', detail: 'd' }, T0);
  assert.equal((await dispatchPush(store, k, { fetchImpl, now: () => T0 + 1 })).sent, 0);
  // Virada nacional: envia a todos; a subscrição expirada (410) é apagada.
  await store.addNotice({ id: 'x2', key: '2026:2:BR:1', kind: 'virada', uf: 'BR', cargo: 1, title: 't', detail: 'd' }, T0 + 2);
  assert.equal((await dispatchPush(store, k, { fetchImpl, now: () => T0 + 3 })).sent, 1);
  assert.equal(calls.length, 2);
  assert.equal((await store.pushSubs()).length, 1);
  // Nada de novo: não volta a enviar.
  assert.equal((await dispatchPush(store, k, { fetchImpl, now: () => T0 + 4 })).sent, 0);
  assert.equal(calls.length, 2);
  // Sem chaves configuradas: não faz nada.
  assert.equal((await dispatchPush(store, null, { fetchImpl })).sent, 0);
});

test('avisos da projeção: só a partir de 10% apurado, uma vez por nível, e não aparecem com vencedor oficial', async () => {
  const store = new D1Store(database());
  const jobs = jobsFor();
  const save = async (pct, st, hash) => {
    for (const j of jobs.filter((x) => x.cargo === 1)) {
      const valid = j.r1.validos;
      const counted = Math.round((valid * pct) / 100);
      const json = round2File(j.uf === 'BR' ? 'BR' : j.uf, 1, {
        pct,
        a: Math.round(counted * 0.6),
        b: counted - Math.round(counted * 0.6),
        st: j.uf === 'BR' ? st : undefined,
        numbers: ['22', '13'],
      });
      if (j.uf === 'ZZ') continue;
      await store.success(j, await store.get(j.key), json, parseRunoff(json, j), hash + j.key, new Headers(), T0);
    }
  };
  await save(5, undefined, 'a');
  assert.equal((await projectionNotices(store, T0)).length, 0); // menos de 10%
  await save(60, undefined, 'b');
  const added = await projectionNotices(store, T0);
  assert.equal(added.length, 1);
  assert.equal(added[0].title, 'Projeção: o Flávio vai ganhar');
  assert.ok(pushWorthy(added[0]));
  await projectionNotices(store, T0 + 1);
  const all = (await store.notices()).filter((n) => JSON.parse(n.payload).kind === 'projecao');
  assert.equal(all.length, 1);
  await save(100, ['Eleito', 'Não eleito'], 'c');
  assert.equal((await projectionNotices(store, T0 + 2)).length, 0);
});
