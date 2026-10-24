import test from 'node:test';
import assert from 'node:assert/strict';
import { cenarioNacional, project } from '../lib/projecao.mjs';
import { RACES } from '../lib/rounds.mjs';

test('cenário chega à quota escolhida sem alterar incertezas ou votos esperados; votos finais prevalecem', () => {
  const races = RACES.filter((r) => r.cargo === 1 && r.uf !== 'BR');
  const base = races.map((r) => r.prior);
  const priors = cenarioNacional(base, 53.2);
  priors.forEach((p, i) => { assert.equal(p.sd, base[i].sd); assert.equal(p.valid, base[i].valid); });
  const rows = races.map((r, i) => ({ ...r, prior: priors[i], parsed: null }));
  const p = project(rows);
  assert.ok(Math.abs(p.flavio - 53.2) < 1e-7);
  const done = project(rows.map((r) => ({ ...r, parsed: { pctSections: 100, final: true, cands: [{ votes: 49 }, { votes: 51 }] } })));
  assert.ok(Math.abs(done.flavio - 49) < 1e-7);
  assert.throws(() => cenarioNacional(base, 101));
});
