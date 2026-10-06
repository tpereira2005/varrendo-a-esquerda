import test from 'node:test';
import assert from 'node:assert/strict';
import { RACES } from '../lib/rounds.mjs';
import { UFS } from '../lib/tse.mjs';
import { project, projectionVerdict, normalCdf, sdFor } from '../lib/projecao.mjs';

const regions = RACES.filter((r) => r.cargo === 1 && (UFS.includes(r.uf) || r.uf === 'ZZ'));
const r1Share = (r) => r.finalists[0].r1Votes / (r.finalists[0].r1Votes + r.finalists[1].r1Votes);
// Ponto de partida: em cada estado, a quota da 1.ª volta entre os dois aplicada a todos os votos válidos
// (na 2.ª volta os votos dos outros candidatos também vão para um dos dois).
const national = () => {
  const v = regions.reduce((n, r) => n + r.r1.validos, 0);
  return (100 * regions.reduce((n, r) => n + r1Share(r) * r.r1.validos, 0)) / v;
};

/** Cada região com `pct` contado e quota do Flávio = quota da 1.ª volta + `swing` (pontos 0–1). */
function scenario(pctOf, swingOf = () => 0, final = false) {
  return regions.map((r) => {
    const pct = pctOf(r);
    const counted = Math.round(r.r1.validos * (pct / 100));
    const share = Math.max(0.02, Math.min(0.98, r1Share(r) + swingOf(r)));
    const a = Math.round(counted * share);
    return { ...r, parsed: pct ? { pctSections: pct, final, cands: [{ votes: a }, { votes: counted - a }] } : null };
  });
}

test('distribuição normal e incerteza', () => {
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-6);
  assert.ok(Math.abs(normalCdf(1.96) - 0.975) < 1e-3);
  assert.ok(sdFor(1) > sdFor(0.5) && sdFor(0.5) > sdFor(0.1) && sdFor(0.1) > sdFor(0));
});

test('sem votos: projeção = 1.ª volta entre os dois, com muita incerteza', () => {
  const p = project(scenario(() => 0));
  assert.ok(Math.abs(p.flavio - national()) < 0.05, `${p.flavio} vs ${national()}`);
  assert.ok(p.probFlavio > 0.5 && p.probFlavio < 0.7);
  assert.equal(projectionVerdict(p).text, 'Empate técnico');
});

test('não se deixa enganar pela ordem de contagem: estados fortes do Flávio contados primeiro', () => {
  // Sul e Sudeste a 60%, resto a 2%; ninguém mudou de voto face à 1.ª volta.
  const early = new Set(['SP', 'PR', 'SC', 'RS', 'RJ', 'MG', 'GO', 'MT', 'MS', 'DF']);
  const regionsNow = scenario((r) => (early.has(r.uf) ? 60 : 2));
  const counted = regionsNow.reduce((n, r) => n + (r.parsed?.cands[0].votes ?? 0), 0);
  const total = regionsNow.reduce((n, r) => n + (r.parsed ? r.parsed.cands[0].votes + r.parsed.cands[1].votes : 0), 0);
  const p = project(regionsNow);
  assert.ok((100 * counted) / total > national() + 2, 'a contagem bruta favorece o Flávio');
  assert.ok(Math.abs(p.flavio - national()) < 0.3, `projeção ${p.flavio} deve ficar perto de ${national()}`);
});

test('deslocação uniforme detetada cedo é projetada para todo o país', () => {
  const p = project(scenario(() => 40, () => -0.03));
  assert.ok(Math.abs(p.flavio - (national() - 3)) < 0.4, `${p.flavio}`);
  assert.ok(p.probFlavio < 0.25, String(p.probFlavio)); // ~20%: com 60% por contar, uma virada de 1,8 pp ainda é possível
  assert.equal(projectionVerdict(p).who, 'lula');
});

test('quase tudo contado: incerteza pequena e projeção ≈ resultado', () => {
  const p = project(scenario(() => 99, () => 0.02));
  assert.ok(p.sd < 0.5);
  assert.ok(p.probFlavio > 0.99);
  assert.equal(projectionVerdict(p).text, 'O Flávio vai ganhar');
  const done = project(scenario(() => 100, () => 0.02, true));
  assert.equal(done.remaining, 0);
});

test('"onde faltam votos": votos por apurar e votos líquidos esperados por estado', () => {
  const p = project(scenario((r) => (r.uf === 'SP' ? 10 : 90)));
  const sp = p.perRegion.find((r) => r.uf === 'SP');
  const ba = p.perRegion.find((r) => r.uf === 'BA');
  assert.ok(sp.remaining > ba.remaining);
  assert.ok(sp.netFlavio > 0, 'SP deve dar votos ao Flávio');
  assert.ok(ba.netFlavio < 0, 'BA deve dar votos ao Lula');
});
