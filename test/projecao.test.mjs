import test from 'node:test';
import assert from 'node:assert/strict';
import { RACES } from '../lib/rounds.mjs';
import { UFS } from '../lib/tse.mjs';
import { project, projectionVerdict, normalCdf, priorOf, trendOf } from '../lib/projecao.mjs';
import { refreshProjection } from '../lib/collector.mjs';
import { D1Store } from '../lib/store.mjs';
import { evaluate } from '../scripts/avaliar-projecao.mjs';
import { database } from './round2-files.mjs';

const regions = RACES.filter((r) => r.cargo === 1 && (UFS.includes(r.uf) || r.uf === 'ZZ'));
// Ponto de partida nacional: em cada estado, a 1.ª volta com as transferências dos eliminados.
const national = () => {
  const v = regions.reduce((n, r) => n + r.prior.valid, 0);
  return (100 * regions.reduce((n, r) => n + r.prior.share * r.prior.valid, 0)) / v;
};

/** Cada região com `pct` contado e quota do Flávio = ponto de partida + `swing` (pontos 0–1). */
function scenario(pctOf, swingOf = () => 0, final = false) {
  return regions.map((r) => {
    const pct = pctOf(r);
    const counted = Math.round(r.prior.valid * (pct / 100));
    const share = Math.max(0.02, Math.min(0.98, r.prior.share + swingOf(r)));
    const a = Math.round(counted * share);
    return { ...r, parsed: pct ? { pctSections: pct, final, cands: [{ votes: a }, { votes: counted - a }] } : null };
  });
}

test('distribuição normal', () => {
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-6);
  assert.ok(Math.abs(normalCdf(1.96) - 0.975) < 1e-3);
});

test('ponto de partida: votos dos eliminados redistribuídos (Caiado e Zema sobretudo para o Flávio)', () => {
  const base = [
    { number: '22', votes: 450 },
    { number: '13', votes: 450 },
  ];
  assert.equal(priorOf(base).share, 0.5);
  const right = priorOf([...base, { number: '55', votes: 100 }]);
  assert.ok(right.share > 0.52, String(right.share));
  const left = priorOf([...base, { number: '80', votes: 100 }]);
  assert.ok(left.share < 0.48, String(left.share));
  // nem todos voltam a votar: menos votos válidos do que na 1.ª volta
  assert.ok(right.valid < 1000 && right.valid > 900);
  // Brasil: o Flávio parte à frente da 1.ª volta só entre os dois (51,0%)
  const br = RACES[0];
  const twoWay = (100 * br.finalists[0].r1Votes) / (br.finalists[0].r1Votes + br.finalists[1].r1Votes);
  assert.ok(100 * br.prior.share > twoWay + 0.5, `${100 * br.prior.share} vs ${twoWay}`);
});

test('sem votos: projeção = ponto de partida, com muita incerteza', () => {
  const p = project(scenario(() => 0));
  assert.ok(Math.abs(p.flavio - national()) < 0.05, `${p.flavio} vs ${national()}`);
  assert.ok(p.sd > 3, String(p.sd));
  assert.ok(p.probFlavio > 0.55 && p.probFlavio < 0.85, String(p.probFlavio));
  assert.ok(Math.abs(p.prior - national()) < 0.05);
});

test('não se deixa enganar pela ordem de contagem entre estados', () => {
  // Sul e Sudeste a 60%, resto a 2%; ninguém mudou de voto face ao ponto de partida.
  const early = new Set(['SP', 'PR', 'SC', 'RS', 'RJ', 'MG', 'GO', 'MT', 'MS', 'DF']);
  const now = scenario((r) => (early.has(r.uf) ? 60 : 2));
  const a = now.reduce((n, r) => n + (r.parsed?.cands[0].votes ?? 0), 0);
  const t = now.reduce((n, r) => n + (r.parsed ? r.parsed.cands[0].votes + r.parsed.cands[1].votes : 0), 0);
  const p = project(now);
  assert.ok((100 * a) / t > national() + 2, 'a contagem bruta favorece o Flávio');
  assert.ok(Math.abs(p.flavio - national()) < 0.3, `projeção ${p.flavio} deve ficar perto de ${national()}`);
});

test('deslocação uniforme detetada cedo é projetada para todo o país', () => {
  const p = project(scenario(() => 40, () => -0.03));
  assert.ok(Math.abs(p.flavio - (national() - 3)) < 0.4, `${p.flavio}`);
  assert.ok(Math.abs(p.nationalSwing + 3) < 0.3, String(p.nationalSwing));
});

test('deslocação de uma região chega aos estados dessa região ainda sem votos', () => {
  // Nordeste: BA a 50% com o Lula 4 pp acima do esperado; os outros estados do Nordeste ainda sem votos.
  const p = project(scenario((r) => (r.uf === 'BA' ? 50 : ['SP', 'MG', 'RJ'].includes(r.uf) ? 50 : 0), (r) => (r.uf === 'BA' ? -0.04 : 0)));
  const pe = p.perRegion.find((r) => r.uf === 'PE');
  const pePrior = 100 * regions.find((r) => r.uf === 'PE').prior.share;
  const go = p.perRegion.find((r) => r.uf === 'GO');
  const goPrior = 100 * regions.find((r) => r.uf === 'GO').prior.share;
  assert.ok(pe.shareRemaining < pePrior - 1, `PE ${pe.shareRemaining} vs ${pePrior}`);
  assert.ok(Math.abs(pe.shareRemaining - pePrior) > Math.abs(go.shareRemaining - goPrior), 'a região pesa mais do que o resto do país');
});

test('tendência da contagem: reta c(p) = F + (1 − p)·d recuperada do histórico', () => {
  const F = 0.52;
  const d = 0.04; // contados primeiro 4 pp mais Flávio do que os que faltam
  const pts = [0.1, 0.2, 0.3, 0.4, 0.5].map((p) => [p, Math.round(1e6 * p * (F + (1 - p) * d)), Math.round(1e6 * p * (1 - F - (1 - p) * d))]);
  const t = trendOf(pts);
  assert.ok(Math.abs(t.d - d) < 0.002, String(t.d));
  assert.ok(t.span > 0.35);
  assert.equal(trendOf(pts.slice(0, 2)), null, 'precisa de pelo menos 3 pontos');
});

test('com o histórico, a projeção corrige o "Flávio à frente no início" que vai desaparecer', () => {
  // Em todos os estados os primeiros votos contados são 3 pp mais Flávio do que os que faltam; resultado final = ponto de partida.
  const d = 0.03;
  const at = (pct) =>
    regions.map((r) => {
      const counted = Math.round(r.prior.valid * pct);
      const a = Math.round(counted * (r.prior.share + (1 - pct) * d));
      return { ...r, parsed: { pctSections: 100 * pct, final: false, cands: [{ votes: a }, { votes: counted - a }] } };
    });
  const histories = {};
  for (const r of regions) {
    histories[r.uf] = [0.2, 0.3, 0.4, 0.5].map((pct) => {
      const counted = Math.round(r.prior.valid * pct);
      const a = Math.round(counted * (r.prior.share + (1 - pct) * d));
      return [pct, a, counted - a];
    });
  }
  const now = at(0.6);
  const without = project(now);
  const withHistory = project(now, histories);
  assert.ok(without.flavio > national() + 1, `sem histórico ${without.flavio}`);
  // a tendência só entra a partir de 20% apurado e com peso moderado: corrige grande parte do desvio, não todo
  assert.ok(Math.abs(withHistory.flavio - national()) < Math.abs(without.flavio - national()) / 2, `com histórico ${withHistory.flavio} vs ${national()}`);
  assert.ok(withHistory.trend > 1.5 && withHistory.trend < 3.5, String(withHistory.trend));
});

test('quase tudo contado: incerteza pequena e projeção ≈ resultado', () => {
  const p = project(scenario(() => 99, () => 0.02));
  assert.ok(p.sd < 0.5, String(p.sd));
  assert.ok(p.probFlavio > 0.99);
  assert.equal(projectionVerdict(p).text, 'O Flávio vai ganhar');
  const done = project(scenario(() => 100, () => 0.02, true));
  assert.equal(done.remaining, 0);
});

test('"onde faltam votos" e probabilidade por estado', () => {
  const p = project(scenario((r) => (r.uf === 'SP' ? 10 : 90)));
  const sp = p.perRegion.find((r) => r.uf === 'SP');
  const ba = p.perRegion.find((r) => r.uf === 'BA');
  assert.ok(sp.remaining > ba.remaining);
  assert.ok(sp.netFlavio > 0, 'SP deve dar votos ao Flávio');
  assert.ok(ba.netFlavio < 0, 'BA deve dar votos ao Lula');
  assert.ok(sp.prob > 0.9 && ba.prob < 0.1, `${sp.prob} ${ba.prob}`);
});

test('calibração em noites simuladas: o intervalo de 95% acerta perto de 95% e o erro cai com a contagem', () => {
  const r = evaluate(project, { nights: 150, moments: [0.1, 0.4, 0.8], seed: 9 });
  for (const m of r) assert.ok(m.cobertura95 > 0.88 && m.cobertura95 <= 1, `cobertura ${m.cobertura95} aos ${m.moment}`);
  assert.ok(r[0].erroMedio < 1.4 && r[1].erroMedio < 0.6 && r[2].erroMedio < 0.2, JSON.stringify(r));
  assert.ok(r.every((m) => m.excessoConfianca < 0.02));
});

test('projeção guardada: só é recalculada quando chega um ficheiro novo', async () => {
  const db = database();
  const store = new D1Store(db);
  let p = await refreshProjection(store, 1000);
  assert.ok(p.flavio > 0);
  const first = await store.projection();
  // sem ficheiros novos: usa a guardada
  await refreshProjection(store, 2000);
  assert.equal((await store.projection()).at, first.at);
  // ficheiro novo no histórico: recalcula
  db.raw.prepare('INSERT INTO timeline(key, generated_at, at, pct_sections, votes_a, votes_b) VALUES(?,?,?,?,?,?)').run(regions[0].key, 1, 3000, 10, 100, 90);
  p = await refreshProjection(store, 4000);
  assert.equal((await store.projection()).at, 4000);
});

test('contagem desequilibrada (estados do Flávio contados primeiro): mais incerteza e frações por grupo', async () => {
  const { AJUSTE } = await import('../lib/projecao.mjs');
  const flavioState = (r) => r.finalists[0].r1Votes >= r.finalists[1].r1Votes;
  const now = scenario((r) => (r.uf === 'ZZ' ? 0 : flavioState(r) ? 90 : 5));
  const p = project(now);
  assert.ok(p.blocs.flavio > 0.85 && p.blocs.lula < 0.1, JSON.stringify(p.blocs));
  const without = project(now, {}, { ...AJUSTE, bloco: 0 });
  assert.ok(p.sd > without.sd, `${p.sd} vs ${without.sd}`);
  // contagem equilibrada: o termo quase não pesa (muito menos do que no caso desequilibrado)
  const even = scenario(() => 50);
  const extraEven = project(even).sd / project(even, {}, { ...AJUSTE, bloco: 0 }).sd - 1;
  assert.ok(extraEven < 0.01 && extraEven < p.sd / without.sd - 1, String(extraEven));
});

test('noite real (2.ª volta de 2022, estado a estado): resultado sempre dentro do intervalo e nunca confiante no lado errado', async () => {
  const { at2022, moments2022, truth2022 } = await import('../scripts/backtest-2022.mjs');
  const truth = truth2022(); // Bolsonaro 49,10%: ganhou o Lula
  for (const m of moments2022()) {
    const { regions, histories } = at2022(m.t);
    const p = project(regions, histories);
    assert.ok(truth >= p.low && truth <= p.high, `${m.target}: ${p.low}–${p.high} não contém ${truth}`);
    assert.ok(Math.abs(p.flavio - truth) < 1, `${m.target}: erro ${p.flavio - truth}`);
    assert.ok(p.probFlavio < 0.5, `${m.target}: deu o Bolsonaro como favorito (${p.probFlavio})`);
  }
});
