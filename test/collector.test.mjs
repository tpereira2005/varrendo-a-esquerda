import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { D1Store } from '../lib/store.mjs';
import { collectStep, snapshot, collectionPlan, INTERVALS } from '../lib/collector.mjs';
import { jobsFor, ROUND } from '../lib/rounds.mjs';
import { parseRunoff } from '../lib/runoff.mjs';
import { round2File, database } from './round2-files.mjs';

const jobs = jobsFor();
const BR = jobs[0];
const T0 = ROUND.pollsCloseAt + 3_600_000;
const now = () => T0;
const sleep = async () => {};
const config = JSON.parse(readFileSync(new URL('fixtures/config-2026-10-06.json', import.meta.url), 'utf8'));

/** Simula o TSE: configuração + ficheiros da 2.ª volta para qualquer disputa. */
function fakeTse({ votes = () => [10, 5], pct = 50, calls = [] } = {}) {
  return async (url) => {
    calls.push(url);
    if (url.endsWith('ele-c.json')) return Response.json(config);
    if (url.endsWith('-ab.json')) return Response.json({ ele: '6258', t: '2', abr: [] });
    const job = jobs.find((j) => j.url === url);
    const [a, b] = votes(job);
    return Response.json(round2File(job.uf, job.cargo, { pct, a, b, numbers: job.finalists.map((f) => f.number) }), {
      headers: { etag: '"x"' },
    });
  };
}

// Só há ficheiro de exemplo de governador para o RJ; os outros respondem 404 como antes da publicação.
const govSafe = (job) => job.cargo === 1 || job.uf === 'RJ';

test('antes das 16h30 de Brasília de 25/10 não há pedidos ao TSE', async () => {
  const store = new D1Store(database());
  const r = await collectStep(store, { now: () => ROUND.opensAt - 1, sleep, fetchImpl: () => assert.fail('não consultar') });
  assert.equal(r.inactive, true);
  const s = await snapshot(store, ROUND.opensAt - 1);
  assert.equal(s.phase, 'antes');
  assert.equal(s.active, false);
  assert.equal(s.mood.label, 'A aguardar');
});

test('pausa administrativa não consulta o TSE', async () => {
  const r = await collectStep(new D1Store(database()), { now, paused: true, fetchImpl: () => assert.fail('não consultar') });
  assert.equal(r.paused, true);
});

test('lê a configuração e depois só a cada 10 minutos; guarda os IDs esperados até o TSE publicar', async () => {
  const db = database();
  const store = new D1Store(db);
  const calls = [];
  await collectStep(store, { now, sleep, limit: 1, fetchImpl: fakeTse({ calls }) });
  assert.equal(calls[0].endsWith('ele-c.json'), true);
  const round = await store.round();
  assert.equal(round.federal, 6258);
  assert.equal(round.confirmed_at, null);
  calls.length = 0;
  await collectStep(store, { now: () => T0 + 20_000, sleep, limit: 1, fetchImpl: fakeTse({ calls }) });
  assert.equal(calls.some((u) => u.endsWith('ele-c.json')), false);
});

test('uma recolha de cada vez e limite de pedidos por lote', async () => {
  const db = database();
  const calls = [];
  const fetchImpl = fakeTse({ calls });
  const results = await Promise.all([
    collectStep(new D1Store(db), { now, sleep, fetchImpl }),
    collectStep(new D1Store(db), { now, sleep, fetchImpl }),
  ]);
  assert.equal(results.filter((r) => r.busy).length, 1);
  assert.equal(calls.filter((u) => u.includes('-c0')).length, 8);
});

test('403 e 429 param o lote e impõem pausa global de pelo menos dez minutos', async () => {
  for (const status of [403, 429]) {
    const db = database();
    const store = new D1Store(db);
    await store.saveRound({ federal: 6258, estadual: 6260, confirmed: true }, T0);
    let calls = 0;
    await collectStep(store, {
      now, sleep,
      fetchImpl: async () => {
        calls++;
        return new Response('', { status, headers: { 'retry-after': '900' } });
      },
    });
    assert.equal(calls, 1);
    assert.equal((await store.state()).pause_until, T0 + 900_000);
    const blocked = await collectStep(new D1Store(db), { now, sleep, foreground: true, fetchImpl: () => assert.fail('não consultar') });
    assert.equal(blocked.busy, true);
  }
});

test('ficheiro ainda não publicado (404) volta a ser tentado ao ritmo normal', async () => {
  const store = new D1Store(database());
  await store.saveRound({ federal: 6258, estadual: 6260, confirmed: true }, T0);
  await collectStep(store, { now, sleep, limit: 1, fetchImpl: async () => new Response('', { status: 404 }) });
  const row = await store.get(BR.key);
  assert.equal(row.retry_at, T0 + INTERVALS.normal);
  assert.match(row.error, /404/);
});

test('guarda, aceita 304, recusa revisões mais antigas e conserva o último resultado bom', async () => {
  const store = new D1Store(database());
  const json = round2File('BR', 1, { pct: 30, a: 100, b: 90 });
  await store.success(BR, null, json, parseRunoff(json, BR), 'h1', new Headers({ etag: '"1"' }), T0);
  await store.unchanged(BR, T0 + 1000);
  assert.equal((await store.get(BR.key)).success_at, T0 + 1000);
  await store.failure(BR, await store.get(BR.key), 'HTTP 500', T0 + 2000, T0 + 3000);
  assert.equal(JSON.parse((await store.get(BR.key)).parsed).cands[0].votes, 100);

  await store.saveRound({ federal: 6258, estadual: 6260, confirmed: true }, T0 + 10 * INTERVALS.config);
  const older = round2File('BR', 1, { pct: 20, a: 1, b: 1, time: new Date(T0 - 7_200_000) });
  await collectStep(store, { now: () => T0 + 120_000, sleep, limit: 1, fetchImpl: async () => Response.json(older) });
  assert.match((await store.get(BR.key)).error, /anterior/);
  assert.equal((await store.get(BR.key)).hash, 'h1');
});

test('linha temporal, avisos sem duplicação e correção quando o TSE retira um eleito', async () => {
  const db = database();
  const store = new D1Store(db);
  const save = async (i, opts, hash) => {
    const json = round2File('BR', 1, { time: new Date(T0 + i * 60_000), ...opts });
    await store.success(BR, await store.get(BR.key), json, parseRunoff(json, BR), hash, new Headers(), T0 + i * 60_000);
  };
  await save(0, { pct: 30, a: 100, b: 110 }, 'a');
  await save(1, { pct: 40, a: 130, b: 120 }, 'b');
  await save(2, { pct: 50, a: 160, b: 140 }, 'c');
  await save(2, { pct: 50, a: 160, b: 140 }, 'c'); // mesmo ficheiro: nada muda
  let s = await snapshot(store, T0 + 180_000);
  assert.equal(s.timeline.length, 3);
  assert.deepEqual(s.events.map((e) => e.kind).sort(), ['marco', 'marco', 'virada']);
  assert.equal(s.events.find((e) => e.kind === 'virada').title, 'Flávio passou à frente!');

  await save(3, { pct: 100, a: 200, b: 150, st: ['Eleito', 'Não eleito'] }, 'd');
  s = await snapshot(store, T0 + 240_000);
  assert.equal(s.phase, 'encerrado');
  assert.equal(s.events.some((e) => e.kind === 'eleito'), true);
  assert.equal(s.mood.label, 'Giga Chad');

  await save(4, { pct: 100, a: 200, b: 150 }, 'e');
  s = await snapshot(store, T0 + 300_000);
  assert.equal(s.events.some((e) => e.kind === 'eleito'), false);
  assert.equal(s.corrections.length, 1);
  assert.equal(s.corrections[0].title, 'FLÁVIO BOLSONARO ELEITO PRESIDENTE!');
});

test('ritmo: nacional a cada 10 s, estado visto a cada 20 s, restantes a cada 60 s; finais deixam de ser pedidos', async () => {
  const store = new D1Store(database());
  await store.db.batch(
    jobs.map((j) =>
      store.db
        .prepare('INSERT INTO results(key,uf,cargo,url,turn,checked_at,success_at) VALUES(?,?,?,?,2,?,?)')
        .bind(j.key, j.uf, j.cargo, j.url, T0, T0),
    ),
  );
  await store.prioritize(jobs, 'SP', T0);
  const due = async (t, changed = 0) => collectionPlan(jobs, await store.queue(), t, changed).due.map((p) => p.job.key).sort();
  assert.deepEqual(await due(T0 + INTERVALS.national), ['2026:2:BR:1']);
  assert.deepEqual(await due(T0 + INTERVALS.priority), ['2026:2:BR:1', '2026:2:SP:1']);
  assert.equal((await due(T0 + INTERVALS.normal)).length, jobs.length);

  const json = round2File('BR', 1, { pct: 100, a: 2, b: 1, final: true });
  await store.success(BR, await store.get(BR.key), json, parseRunoff(json, BR), 'f', new Headers(), T0);
  const plan = collectionPlan(jobs, await store.queue(), T0 + 3_600_000);
  assert.equal(plan.due.some((p) => p.job.key === BR.key), false);
});

test('nova geração nacional: todos os outros ficheiros ficam logo pendentes e entram no mesmo lote', async () => {
  const db = database();
  const store = new D1Store(db);
  await store.saveRound({ federal: 6258, estadual: 6260, confirmed: true }, T0);
  await store.db.batch(
    jobs.map((j) =>
      store.db
        .prepare('INSERT INTO results(key,uf,cargo,url,turn,checked_at,success_at) VALUES(?,?,?,?,2,?,?)')
        .bind(j.key, j.uf, j.cargo, j.url, T0, T0),
    ),
  );
  // 11 s depois: só o nacional estaria pendente; ele traz uma geração nova.
  const calls = [];
  let t = T0 + 11_000;
  await collectStep(store, { now: () => t, sleep, limit: 40, foreground: true, fetchImpl: fakeTse({ calls }) });
  const results = calls.filter((u) => u.includes('-c0'));
  assert.equal(results[0].includes('/br/'), true);
  assert.equal(results.length, jobs.length);
  // Sem nova geração, 11 s depois só volta a pedir o nacional.
  calls.length = 0;
  t += 11_000;
  await collectStep(store, { now: () => t, sleep, limit: 40, foreground: true, fetchImpl: fakeTse({ calls }) });
  assert.deepEqual(calls.filter((u) => u.includes('-c0')).map((u) => u.includes('/br/')), [true]);
});

test('recolha completa das 35 disputas e estado da noite', async () => {
  const db = database();
  let t = T0;
  const fetchImpl = fakeTse({ votes: (j) => (j.uf === 'SC' ? [70, 30] : [48, 52]), pct: 100 });
  for (let i = 0; i < 10; i++) {
    await collectStep(new D1Store(db), { now: () => t, sleep, limit: 32, foreground: true, fetchImpl: async (u) => {
      const job = jobs.find((j) => j.url === u);
      if (job && !govSafe(job)) return new Response('', { status: 404 });
      return fetchImpl(u);
    } });
    t += 1000;
  }
  const s = await snapshot(new D1Store(db), t);
  assert.equal(s.states.filter((x) => x.parsed).length, 27);
  assert.equal(s.score.flavio, 1);
  assert.equal(s.score.lula, 26);
  assert.equal(s.mood.label, 'Desespero'); // tudo contado, Lula à frente, ainda sem indicação oficial
  assert.equal(s.phase, 'apuramento');
  assert.equal(s.toFlip.impossible, true);
  assert.ok(s.events.some((e) => e.kind === 'estado' || e.kind === 'estado-virou'));
});
