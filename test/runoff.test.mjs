import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RACES, jobsFor, round2FromConfig, ROUND } from '../lib/rounds.mjs';
import { parseRunoff, eventsFor, toFlip, moodFor } from '../lib/runoff.mjs';
import { candidatesOf, isElected, UFS } from '../lib/tse.mjs';
import { round2File } from './round2-files.mjs';

const jobs = jobsFor();
const job = (uf, cargo = 1) => jobs.find((j) => j.uf === uf && j.cargo === cargo);
const BR = job('BR');
const fixture = (n) => JSON.parse(readFileSync(new URL(`fixtures/${n}.json`, import.meta.url), 'utf8'));

test('disputas: Presidente no BR, nos 27 estados e no estrangeiro, Governador em 7 estados, Flávio sempre primeiro', () => {
  assert.equal(RACES.length, 36);
  assert.equal(job('ZZ').url, 'https://resultados.tse.jus.br/oficial/ele2026/6258/dados/zz/zz-c0001-e006258-u.json');
  assert.deepEqual(RACES.filter((r) => r.cargo === 3).map((r) => r.uf), ['AC', 'AM', 'DF', 'ES', 'RJ', 'RN', 'TO']);
  for (const r of RACES.filter((r) => r.cargo === 1)) assert.deepEqual(r.finalists.map((f) => f.number), ['22', '13']);
  assert.equal(BR.url, 'https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json');
  assert.equal(job('RJ', 3).url.endsWith('/6260/dados/rj/rj-c0003-e006260-u.json'), true);
  const internal = RACES.filter((r) => r.internal).map((r) => r.uf);
  assert.deepEqual(internal, ['DF', 'RN', 'TO']);
  assert.equal(job('RJ', 3).finalists[0].name, 'DOUGLAS RUAS');
});

test('1.ª volta: o TSE marca e="s" nos finalistas, mas isso não é "eleito"', () => {
  const flavio = candidatesOf(fixture('t1-BR-1'), 1).find((c) => c.number === '22');
  assert.equal(flavio.st, '2º turno');
  assert.equal(isElected(flavio.st), false);
  assert.equal(isElected('Eleito'), true);
  assert.equal(isElected('Não eleito'), false);
});

test('configuração oficial: cdt2 da 1.ª volta indica a 2.ª; só publicada quando existir com t=2', () => {
  assert.deepEqual(round2FromConfig(fixture('config-2026-10-06')), { federal: 6258, estadual: 6260, published: false });
  const cfg = fixture('config-2026-10-06');
  const plea = cfg.pl.find((p) => p.c === 'ele2026');
  plea.e.push({ cd: '6258', t: '2' }, { cd: '6260', t: '2' });
  assert.deepEqual(round2FromConfig(cfg), { federal: 6258, estadual: 6260, published: true });
  assert.equal(round2FromConfig({ pl: [] }), null);
});

test('ficheiro válido: ordem Flávio–Lula, percentagens, comparação com a 1.ª volta', () => {
  const p = parseRunoff(round2File('BR', 1, { pct: 40, a: 30_000_000, b: 29_000_000 }), BR);
  assert.deepEqual(p.cands.map((c) => c.number), ['22', '13']);
  assert.equal(p.pctSections, 40);
  assert.equal(p.cands[0].r1Votes, 56104503);
  assert.equal(p.winner, null);
  assert.equal(p.final, false);
  assert.deepEqual(p.warnings, []);
});

test('rejeita 1.ª volta, outra eleição, outra abrangência e mais de dois candidatos', () => {
  assert.throws(() => parseRunoff(round2File('BR', 1, { t: 1 }), BR), /1\.ª volta/);
  assert.throws(() => parseRunoff(round2File('BR', 1, { ele: 6257 }), BR), /Eleição/);
  assert.throws(() => parseRunoff(round2File('SP', 1), BR), /Abrangência/);
  assert.throws(() => parseRunoff(round2File('BR', 1, { extra: true }), BR), /2 candidatos/);
  const bad = round2File('BR', 1);
  bad.s.pst = '101,00';
  assert.throws(() => parseRunoff(bad, BR), /secções/);
});

test('vitória só com indicação oficial; 100% sem totalização final não chega', () => {
  let p = parseRunoff(round2File('BR', 1, { pct: 100, a: 60, b: 40 }), BR);
  assert.equal(p.winner, null);
  p = parseRunoff(round2File('BR', 1, { pct: 100, a: 60, b: 40, st: ['Eleito', 'Não eleito'] }), BR);
  assert.equal(p.winner, 0);
  p = parseRunoff(round2File('BR', 1, { pct: 100, a: 40, b: 60, final: true }), BR);
  assert.equal(p.winner, 1);
  // Um estado na Presidência nunca elege ninguém, mesmo com totalização final.
  p = parseRunoff(round2File('SP', 1, { pct: 100, a: 60, b: 40, final: true, st: ['Eleito', 'Não eleito'] }), job('SP'));
  assert.equal(p.winner, null);
  assert.equal(eventsFor(RACES.find((r) => r.uf === 'SP'), p, []).some((e) => e.kind === 'eleito'), false);
});

test('finalista substituído pelo TSE é aceite com aviso', () => {
  const p = parseRunoff(round2File('BR', 1, { a: 10, b: 5, numbers: ['22', '55'] }), BR);
  assert.equal(p.cands[1].number, '55');
  assert.match(p.warnings[0], /Finalista alterado/);
});

const pts = (...list) => list.map(([pct, a, b], i) => ({ generatedAt: 1000 + i, pctSections: pct, votesA: a, votesB: b }));

test('viradas: só depois de 20% e confirmadas por duas gerações seguidas', () => {
  const br = RACES[0];
  // Lula à frente aos 25%, Flávio passa aos 40% e confirma aos 45%; oscilação isolada aos 60% é ignorada.
  const p = pts([10, 5, 9], [25, 10, 12], [40, 20, 19], [45, 25, 23], [60, 29, 30], [70, 35, 32]);
  const viradas = eventsFor(br, null, p).filter((e) => e.kind === 'virada');
  assert.equal(viradas.length, 1);
  assert.equal(viradas[0].title, 'Flávio passou à frente!');
  assert.equal(viradas[0].tone, 'good');
  assert.equal(viradas[0].id, '2026:2:BR:1:virada:1002');
  // Estados não geram viradas (seria ruído); governadores sim.
  assert.equal(eventsFor(RACES.find((r) => r.uf === 'SP'), null, p).length, 0);
});

test('marcos nacionais sem repetição; marcos ultrapassados de uma vez não geram aviso', () => {
  const ev = eventsFor(RACES[0], null, pts([26, 10, 12], [30, 11, 12], [55, 30, 25], [80, 40, 30], [99.5, 60, 50]));
  assert.deepEqual(ev.filter((e) => e.kind === 'marco').map((e) => e.id.split(':').pop()), ['25', '50', '75', '99']);
  assert.match(ev.find((e) => e.id.endsWith('marco:25')).title, /Lula à frente/);
  assert.equal(ev.find((e) => e.id.endsWith('marco:50')).tone, 'good');
});

test('estado apurado: vencedor e virada face à 1.ª volta', () => {
  const sp = RACES.find((r) => r.uf === 'SP' && r.cargo === 1);
  const r1Lead = sp.finalists[0].r1Votes > sp.finalists[1].r1Votes ? 0 : 1;
  const votes = r1Lead === 0 ? { a: 100, b: 200 } : { a: 200, b: 100 };
  const p = parseRunoff(round2File('SP', 1, { pct: 100, ...votes }), job('SP'));
  const [e] = eventsFor(sp, p, []);
  assert.equal(e.kind, 'estado-virou');
  assert.match(e.title, /São Paulo virou para o/);
});

test('resultado oficial: celebração para o Flávio, mensagem sóbria para o Lula; governador interno é neutro', () => {
  const win = parseRunoff(round2File('BR', 1, { pct: 100, a: 60, b: 40, st: ['Eleito', 'Não eleito'] }), BR);
  const e = eventsFor(RACES[0], win, []).find((x) => x.kind === 'eleito');
  assert.equal(e.title, 'FLÁVIO BOLSONARO ELEITO PRESIDENTE!');
  assert.equal(e.tone, 'good');
  const loss = parseRunoff(round2File('BR', 1, { pct: 100, a: 40, b: 60, st: ['Não eleito', 'Eleito'] }), BR);
  const l = eventsFor(RACES[0], loss, []).find((x) => x.kind === 'eleito');
  assert.equal(l.title, 'Lula eleito Presidente pelo TSE');
  assert.equal(l.tone, 'bad');
  const rj = parseRunoff(round2File('RJ', 3, { pct: 100, a: 60, b: 40, st: ['Eleito', 'Não eleito'] }), job('RJ', 3));
  assert.equal(eventsFor(job('RJ', 3), rj, []).find((x) => x.kind === 'eleito').title, 'Douglas Ruas (PL) vence no Rio de Janeiro');
  const df = RACES.find((r) => r.uf === 'DF' && r.cargo === 3);
  assert.equal(eventsFor(df, { ...rj, cands: rj.cands, winner: 0 }, [])[0].tone, 'neutral');
});

test('"para virar": estimativa com os votos válidos da 1.ª volta nas secções por apurar', () => {
  const states = RACES.filter((r) => r.cargo === 1 && UFS.includes(r.uf)).map((r) => ({ ...r, parsed: { pctSections: 50 } }));
  const statesValid = states.reduce((n, s) => n + s.r1.validos, 0);
  const abroad = RACES[0].r1.validos - statesValid;
  assert.ok(abroad > 100_000 && abroad < 2_000_000, `votos do estrangeiro: ${abroad}`);
  const remaining = Math.round(statesValid * 0.5 + abroad * 0.5);
  const national = parseRunoff(round2File('BR', 1, { pct: 50, a: 30_000_000, b: 31_000_000 }), BR);
  const f = toFlip(national, states, RACES[0].r1.validos);
  assert.equal(f.trailing, 0);
  assert.equal(f.remaining, remaining);
  assert.ok(Math.abs(f.needPct - (100 * (1_000_000 + remaining)) / (2 * remaining)) < 1e-9);
  assert.equal(f.impossible, false);
  const done = states.map((s) => ({ ...s, parsed: { pctSections: 100 } }));
  assert.equal(toFlip(national, done).impossible, true);
  // Estados todos contados mas o estrangeiro ainda não: ainda há votos por apurar.
  assert.ok(toFlip(national, done, RACES[0].r1.validos).remaining > 0);
});

test('boneco: reage ao que o candidato atrás precisaria para virar (diferença + o que falta contar)', () => {
  const states = (done) => RACES.filter((r) => r.cargo === 1 && UFS.includes(r.uf)).map((r) => ({ ...r, parsed: { pctSections: done } }));
  const valid = states(0).reduce((n, s) => n + s.r1.validos, 0);
  // Flávio 2 pontos à frente durante toda a noite (mesmos exemplos da proposta).
  const at = (done, lead = 0.02, st) => {
    const counted = Math.round(valid * (done / 100));
    const a = Math.round(counted * (0.5 + lead / 2));
    const n = parseRunoff(round2File('BR', 1, { pct: done, a, b: counted - a, st }), BR);
    return moodFor(n, toFlip(n, states(done), RACES[0].r1.validos)).label;
  };
  assert.equal(moodFor(null, null).label, 'A aguardar');
  assert.equal(at(10), 'Esperança');
  assert.equal(at(50), 'Confiante');
  assert.equal(at(80), 'Barba cheia');
  assert.equal(at(95), 'Giga Chad');
  // Lula 2 pontos à frente: o espelho.
  assert.equal(at(10, -0.02), 'Tensão');
  assert.equal(at(50, -0.02), 'Abalado');
  assert.equal(at(80, -0.02), 'Lágrimas');
  assert.equal(at(95, -0.02), 'Desespero');
  // Muito à frente cedo não chega para euforia; pouco à frente quase no fim já é "Chad" ou mais.
  assert.equal(at(5, 0.1), 'Esperança');
  assert.equal(at(90, 0.005), 'Barba cheia');
  // Resultado oficial manda sempre.
  assert.equal(at(100, -0.1, ['Eleito', 'Não eleito']), 'Giga Chad');
  assert.equal(at(100, 0.1, ['Não eleito', 'Eleito']), 'Desespero');
});

test('janela da noite eleitoral começa às 16h30 de Brasília', () => {
  assert.equal(new Date(ROUND.opensAt).toISOString(), '2026-10-25T19:30:00.000Z');
  assert.equal(new Date(ROUND.pollsCloseAt).toISOString(), '2026-10-25T20:00:00.000Z');
});

test('finalista substituído: nomes e resultado oficial usam o candidato real, nunca "Lula" por omissão', () => {
  const p = parseRunoff(round2File('BR', 1, { pct: 100, a: 60, b: 40, numbers: ['70', '13'], st: ['Eleito', 'Não eleito'] }), BR);
  assert.equal(p.cands[0].number, '70');
  const e = eventsFor(RACES[0], p, []).find((x) => x.kind === 'eleito');
  assert.match(e.title, /Augusto Cury/i);
  assert.doesNotMatch(e.title, /Lula/);
  assert.equal(moodFor(p, null).label, 'Desespero'); // o Flávio não foi eleito
});
