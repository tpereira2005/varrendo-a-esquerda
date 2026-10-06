import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CITIES, PORTUGAL, parseAb, parseCity, byCountry } from '../lib/exterior.mjs';
import { D1Store } from '../lib/store.mjs';
import { collectExterior, snapshot } from '../lib/collector.mjs';
import { ROUND } from '../lib/rounds.mjs';
import { round2File, database } from './round2-files.mjs';

const T0 = ROUND.pollsCloseAt + 3_600_000;
const ids = { federal: 6258, estadual: 6260 };
const LISBOA = '29955';
const PORTO = '30341';
const MIAMI = '30112';
const archive = JSON.parse(readFileSync(new URL('../data/exterior-turno1.json', import.meta.url), 'utf8'));

const city = (cd, a, b, pct = 100) => round2File(cd, 1, { a, b, pct });
const ab = (entries) => ({
  ele: '6258',
  t: '2',
  abr: Object.entries(entries).map(([cd, [stamp, pst]]) => ({ tpabr: 'mun', cdabr: cd, dt: '25/10/2026', ht: stamp, s: { st: '1', pst } })),
});

test('186 cidades com país; Portugal = Lisboa, Porto e Faro', () => {
  assert.equal(Object.keys(CITIES).length, 186);
  assert.ok(Object.values(CITIES).every((c) => c.pais && c.cidade));
  const pt = Object.values(CITIES).filter((c) => c.pais === PORTUGAL).map((c) => c.cidade).sort();
  assert.deepEqual(pt, ['Faro', 'Lisboa', 'Porto']);
});

test('arquivo da 1.ª volta: Portugal primeiro e soma igual ao total oficial do estrangeiro (330 882)', () => {
  assert.equal(archive.countries[0].pais, PORTUGAL);
  const total = archive.countries.reduce((n, c) => n + Object.values(c.votes).reduce((m, v) => m + v, 0), 0);
  assert.equal(total, 330_882);
  assert.equal(archive.countries.length, 133);
});

test('ficheiros de cidade e resumo: rejeita outra eleição, outra volta e outra cidade', () => {
  const ok = parseCity(city(LISBOA, 10, 20), { ele: 6258, turn: 2, cd: LISBOA });
  assert.deepEqual(ok.votes, { 22: 10, 13: 20 });
  assert.throws(() => parseCity(city(LISBOA, 1, 1), { ele: 6258, turn: 2, cd: PORTO }), /Cidade/);
  assert.throws(() => parseCity(round2File(LISBOA, 1, { t: 1 }), { ele: 6258, turn: 2, cd: LISBOA }), /outra eleição/);
  assert.throws(() => parseAb({ ele: '6257', t: '1', abr: [] }, { ele: 6258, turn: 2 }), /outra eleição/);
  assert.deepEqual(Object.keys(parseAb(ab({ [LISBOA]: ['21:00:00', '50,00'], 99999: ['x', '1'] }), { ele: 6258, turn: 2 })), [LISBOA]);
});

test('agregação por país: Portugal sempre primeiro, mesmo com menos votos', () => {
  const list = byCountry(
    { [MIAMI]: parseCity(city(MIAMI, 900, 100), { ele: 6258, turn: 2, cd: MIAMI }), [LISBOA]: parseCity(city(LISBOA, 5, 5), { ele: 6258, turn: 2, cd: LISBOA }) },
    ['22', '13'],
  );
  assert.equal(list[0].pais, PORTUGAL);
  assert.equal(list[1].pais, 'Estados Unidos');
  assert.equal(list[0].cidades[0].cidade, 'Lisboa');
});

test('recolha: só pede cidades com votos novos, Portugal primeiro, e volta a pedir quando mudam', async () => {
  const store = new D1Store(database());
  const calls = [];
  let summary = { [MIAMI]: ['21:00:00', '100,00'], [LISBOA]: ['21:00:00', '100,00'], [PORTO]: ['21:00:00', '0,00'] };
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.endsWith('-ab.json')) return Response.json(ab(summary));
    const cd = url.match(/zz(\d+)-c0001/)[1];
    return Response.json(city(cd, 100, 50));
  };
  let t = T0;
  const opts = { fetchImpl, now: () => t, base: 'https://x', ids, timeoutMs: 1000, limit: 1 };
  await collectExterior(store, opts);
  assert.equal(calls.length, 2);
  assert.match(calls[1], new RegExp(`zz${LISBOA}-`)); // Portugal antes dos Estados Unidos; Porto ainda sem votos
  await collectExterior(store, opts); // resumo ainda fresco: só a cidade que faltava
  assert.equal(calls.length, 3);
  assert.match(calls[2], new RegExp(`zz${MIAMI}-`));
  await collectExterior(store, opts); // nada de novo
  assert.equal(calls.length, 3);
  summary = { ...summary, [LISBOA]: ['21:30:00', '100,00'] };
  t += 45_000;
  await collectExterior(store, opts);
  assert.equal(calls.length, 5);
  assert.match(calls[4], new RegExp(`zz${LISBOA}-`));

  const s = await snapshot(store, t);
  assert.equal(s.exterior.countries[0].pais, PORTUGAL);
  assert.equal(s.exterior.countries[0].flavio, 100);
  assert.ok(s.exterior.countries[0].r1.flavio > 0);
  assert.equal(s.states.length, 27);
});

test('429 no estrangeiro também impõe pausa', async () => {
  const store = new D1Store(database());
  const r = await collectExterior(store, {
    fetchImpl: async () => new Response('', { status: 429 }),
    now: () => T0,
    base: 'https://x',
    ids,
    timeoutMs: 1000,
  });
  assert.equal(r.pause, T0 + 600_000);
});
