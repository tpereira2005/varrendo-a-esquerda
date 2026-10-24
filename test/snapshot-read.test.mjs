import test from 'node:test';
import assert from 'node:assert/strict';
import { readSnapshot, errorDetail } from '../lib/snapshot-read.mjs';

test('leitura transitória recupera; cache válida é identificada e nunca renovada por falhas', async () => {
  let calls = 0, stored, puts = 0;
  const cache = { put: async (_, r) => { stored = await r.json(); puts++; }, match: async () => stored && Response.json(stored) };
  const sleep = async () => {};
  const good = await readSnapshot(async () => { if (++calls < 3) throw new Error('D1 temporarily unavailable'); return { serverNow: 1000, phase: 'apuramento' }; }, { cache, sleep });
  assert.equal(calls, 3);
  assert.equal(good.availability, undefined);
  const fail = async () => { throw new Error('D1 temporarily unavailable'); };
  const fallback = await readSnapshot(fail, { cache, sleep, now: () => 2000 });
  assert.deepEqual(fallback.availability, { cachedAt: 1000 });
  assert.equal(puts, 1);
  await assert.rejects(readSnapshot(fail, { cache, sleep, now: () => 602000 }));
});

test('erros permanentes não são repetidos e a causa é preservada', async () => {
  let calls = 0;
  const error = new Error('D1_ERROR', { cause: new Error('no such table: results') });
  await assert.rejects(readSnapshot(async () => { calls++; throw error; }, { cache: null }));
  assert.equal(calls, 1);
  assert.match(errorDetail(error), /no such table/);
});
