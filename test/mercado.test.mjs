import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEvent, parseHistory, priceOf, refreshMarket, marketView, thin, EVENT_URL, MARKET_INTERVALS } from '../lib/mercado.mjs';
import { D1Store } from '../lib/store.mjs';
import { snapshot } from '../lib/collector.mjs';
import { ROUND } from '../lib/rounds.mjs';
import { database } from './round2-files.mjs';

const evento = JSON.parse(readFileSync(new URL('fixtures/polymarket-evento.json', import.meta.url), 'utf8'));
const T0 = ROUND.opensAt - 86_400_000;
const history = (from, n, p) => ({ history: Array.from({ length: n }, (_, i) => ({ t: (from + i * 600_000) / 1000, p })) });

function fakeFetch(routes) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    for (const [prefix, body] of routes) {
      if (url.startsWith(prefix)) {
        if (typeof body === 'number') return new Response('', { status: body });
        return Response.json(typeof body === 'function' ? body(url) : body);
      }
    }
    return new Response('', { status: 404 });
  };
  return { impl, calls };
}

test('Polymarket: lê as probabilidades do Flávio e do Lula do evento real', () => {
  const m = parseEvent(evento);
  assert.ok(m.flavio > 50 && m.flavio < 100);
  assert.ok(m.lula > 0 && m.lula < 50);
  assert.ok(Math.abs(m.flavio + m.lula - 100) < 2);
  assert.ok(m.volume > 1_000_000);
  assert.match(m.token, /^\d+$/);
  assert.equal(m.closed, false);
});

test('Polymarket: preço = meio do intervalo compra/venda; com intervalo largo, a última transação', () => {
  assert.equal(priceOf({ bestBid: 0.84, bestAsk: 0.86, lastTradePrice: 0.5 }), 0.85);
  assert.equal(priceOf({ bestBid: 0.2, bestAsk: 0.6, lastTradePrice: 0.33 }), 0.33);
  assert.equal(priceOf({ outcomePrices: '["0.7", "0.3"]' }), 0.7);
});

test('Polymarket: rejeita respostas sem os dois finalistas ou com preços absurdos', () => {
  assert.throws(() => parseEvent([]), /sem mercados/);
  assert.throws(() => parseEvent([{ markets: [evento[0].markets.find((m) => /Lula/.test(m.groupItemTitle))] }]), /não encontrados/);
  const bad = structuredClone(evento);
  for (const m of bad[0].markets) Object.assign(m, { bestBid: null, bestAsk: null, lastTradePrice: 3, outcomePrices: '["3","0"]' });
  assert.throws(() => parseEvent(bad), /inválidos/);
  assert.throws(() => parseHistory({}), /histórico/);
  assert.deepEqual(parseHistory({ history: [{ t: 2, p: 0.5 }, { t: 1, p: 0.25 }, { t: 3, p: 7 }] }), [[1000, 25], [2000, 50]]);
});

test('Polymarket: séries reduzidas mantêm o primeiro e o último ponto', () => {
  const pts = Array.from({ length: 1000 }, (_, i) => [i, i]);
  const t = thin(pts, 50);
  assert.equal(t.length, 50);
  assert.deepEqual(t[0], [0, 0]);
  assert.deepEqual(t.at(-1), [999, 999]);
});

test('Polymarket: guarda a leitura, respeita o intervalo e não apaga a última leitura boa quando falha', async () => {
  const store = new D1Store(database());
  let now = T0;
  const ok = fakeFetch([
    [EVENT_URL, evento],
    ['https://clob.polymarket.com/prices-history', (url) => history(T0 - (url.includes('interval=max') ? 30 * 86_400_000 : 86_400_000), 20, 0.84)],
  ]);
  assert.deepEqual(await refreshMarket(store, { fetchImpl: ok.impl, now: () => now }), { ok: true });
  assert.equal(ok.calls.length, 3); // evento + 24 h + campanha
  const view = marketView(await store.market(), now, false);
  assert.ok(view.flavio > 50);
  assert.equal(view.campaign.at(-1)[0], T0); // a campanha acaba no preço atual
  assert.equal(view.stale, false);

  // Antes do intervalo: nenhum pedido.
  now += 60_000;
  assert.deepEqual(await refreshMarket(store, { fetchImpl: ok.impl, now: () => now }), { skipped: true });
  assert.equal(ok.calls.length, 3);

  // Depois do intervalo: a campanha (6 h) não é pedida outra vez.
  now = T0 + MARKET_INTERVALS.idle;
  await refreshMarket(store, { fetchImpl: ok.impl, now: () => now });
  assert.equal(ok.calls.length, 5);

  // Falha: a última leitura boa continua, com o erro.
  now += MARKET_INTERVALS.idle;
  const down = fakeFetch([[EVENT_URL, 503]]);
  assert.match((await refreshMarket(store, { fetchImpl: down.impl, now: () => now })).error, /HTTP 503/);
  const after = marketView(await store.market(), now, false);
  assert.ok(after.flavio > 50);
  assert.match(after.error, /503/);

  // Muito tempo sem leitura boa: marcado como desatualizado.
  assert.equal(marketView(await store.market(), now + 4 * 3_600_000, false).stale, true);
});

test('Polymarket: na noite eleitoral lê de minuto a minuto', async () => {
  const store = new D1Store(database());
  let now = ROUND.pollsCloseAt;
  const ok = fakeFetch([[EVENT_URL, evento], ['https://clob.polymarket.com/prices-history', history(now - 3_600_000, 5, 0.9)]]);
  await refreshMarket(store, { fetchImpl: ok.impl, now: () => now, active: true });
  now += MARKET_INTERVALS.active;
  assert.deepEqual(await refreshMarket(store, { fetchImpl: ok.impl, now: () => now, active: true }), { ok: true });
  assert.ok(ok.calls.some((u) => u.includes('fidelity=2')));
});

test('Polymarket: a página recebe o mercado no estado (ou nada, antes da primeira leitura)', async () => {
  const store = new D1Store(database());
  assert.equal((await snapshot(store, T0)).market, null);
  const ok = fakeFetch([[EVENT_URL, evento], ['https://clob.polymarket.com/prices-history', history(T0 - 86_400_000, 10, 0.8)]]);
  await refreshMarket(store, { fetchImpl: ok.impl, now: () => T0 });
  const s = await snapshot(store, T0 + 1000);
  assert.ok(s.market.flavio > 50);
  assert.ok(s.market.recent.length >= 2);
});
