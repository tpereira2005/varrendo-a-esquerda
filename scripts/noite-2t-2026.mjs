// Revê a projeção da noite de 25/10/2026 (2.ª volta, Flávio × Lula) com as revisões gravadas pelo site.
// Em cada momento a projeção só vê os ficheiros do TSE já publicados, tal como na noite. Compara três pontos de
// partida: o usado no site (cenário manual), só a média das sondagens e só a 1.ª volta.
//
//   npm run dados:descarregar -- 2      (grava ../arquivo/revisoes-2a-volta.json)
//   node scripts/noite-2t-2026.mjs [caminho-das-revisoes.json]
import { readFileSync } from 'node:fs';
import { RACES, FLAVIO, LULA } from '../lib/rounds.mjs';
import { project, priorOf, ancorarSondagens } from '../lib/projecao.mjs';
import turno1 from '../data/turno1.json' with { type: 'json' };
import vespera from '../data/vespera.json' with { type: 'json' };

const file = process.argv[2] ?? new URL('../../arquivo/revisoes-2a-volta.json', import.meta.url);
const revisions = JSON.parse(readFileSync(file, 'utf8'));
const races = RACES.filter((r) => r.cargo === 1 && r.uf !== 'BR');

// Séries por estado: [instante do ficheiro, fração apurada, votos Flávio, votos Lula], sem ficheiros repetidos.
const series = {};
for (const rev of revisions) {
  const race = races.find((r) => r.key === rev.key);
  if (!race || !rev.parsed) continue;
  const p = JSON.parse(rev.parsed);
  const votes = (n) => p.cands.find((c) => c.number === n)?.votes ?? 0;
  const s = (series[race.uf] ??= []);
  if (s.some((x) => x[0] === p.generatedAt)) continue;
  s.push([p.generatedAt, p.pctSections / 100, votes(FLAVIO), votes(LULA)]);
}
for (const s of Object.values(series)) s.sort((a, b) => a[0] - b[0]);
const finals = Object.fromEntries(Object.entries(series).map(([uf, s]) => [uf, s.at(-1)]));
const fin = Object.values(finals).reduce((n, x) => [n[0] + x[2], n[1] + x[3]], [0, 0]);
const truth = (100 * fin[0]) / (fin[0] + fin[1]);

// Pontos de partida alternativos.
const r1 = (uf) => (uf === 'ZZ' ? turno1.president.ZZ : turno1.president[uf]).candidates;
const semVespera = races.map((r) => priorOf(r1(r.uf), FLAVIO, LULA));
const comTransf = races.map((r) => priorOf(r1(r.uf), FLAVIO, LULA, vespera.transferencias));
const sondagens = ancorarSondagens(comTransf, vespera.sondagens).priors;
const VARIANTES = [
  ['site (cenário manual)', races.map((r) => r.prior)],
  ['média das sondagens', sondagens],
  ['só a 1.ª volta', semVespera],
];

const nacional = (priors) => (100 * priors.reduce((n, p) => n + p.share * p.valid, 0)) / priors.reduce((n, p) => n + p.valid, 0);

function at(t, priors) {
  const histories = {};
  const regions = races.map((r, i) => {
    const s = (series[r.uf] ?? []).filter((x) => x[0] <= t);
    histories[r.uf] = s.slice(0, -1).map(([, p, a, b]) => [p, a, b]);
    const last = s.at(-1);
    const parsed = last ? { pctSections: 100 * last[1], final: last[1] >= 1, cands: [{ votes: last[2] }, { votes: last[3] }] } : null;
    return { ...r, prior: priors[i], parsed };
  });
  return { regions, histories };
}

const times = [...new Set(Object.values(series).flatMap((s) => s.map((x) => x[0])))].sort((a, b) => a - b);
const total = races.reduce((n, r) => n + r.prior.valid, 0);
const progress = (t) => races.reduce((n, r) => n + ((series[r.uf] ?? []).filter((x) => x[0] <= t).at(-1)?.[1] ?? 0) * r.prior.valid, 0) / total;
const alvos = [0, 0.01, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99];
const momentos = alvos.map((a) => ({ alvo: a, t: a === 0 ? times[0] - 1 : times.find((t) => progress(t) >= a) })).filter((m) => m.t);
const hora = new Intl.DateTimeFormat('pt-PT', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
const f2 = (n) => n.toFixed(2);

console.log(`Resultado final (estados + estrangeiro): Flávio ${f2(truth)}% · ${times.length} ficheiros do TSE`);
for (const [nome, priors] of VARIANTES) {
  console.log(`\n=== Ponto de partida: ${nome} (${f2(nacional(priors))}%) ===`);
  console.log('apurado | hora Brasília | contagem | projeção [95%] | P(Flávio) | erro | dentro?');
  for (const m of momentos) {
    const { regions, histories } = at(m.t, priors);
    const p = project(regions, histories);
    const a = regions.reduce((s, r) => s + (r.parsed?.cands[0].votes ?? 0), 0);
    const c = regions.reduce((s, r) => s + (r.parsed ? r.parsed.cands[0].votes + r.parsed.cands[1].votes : 0), 0);
    const err = p.flavio - truth;
    console.log(
      `${String(Math.round(100 * progress(m.t))).padStart(4)}% | ${m.alvo ? hora.format(m.t) : 'antes'} | ${c ? f2((100 * a) / c) + '%' : '   —  '} | ${f2(p.flavio)}% [${p.low.toFixed(1)}–${p.high.toFixed(1)}] | ${(100 * p.probFlavio).toFixed(1)}% | ${(err >= 0 ? '+' : '') + f2(err)} | ${truth >= p.low && truth <= p.high ? 'sim' : 'NÃO'}`,
    );
  }
}

// Erro do ponto de partida estado a estado (site), ordenado pelo peso em votos do desvio.
console.log('\n=== Ponto de partida do site vs resultado, por estado ===');
const linhas = races
  .map((r) => {
    const [, , a, b] = finals[r.uf] ?? [0, 0, 0, 0];
    const real = (100 * a) / (a + b);
    return { uf: r.uf, prior: 100 * r.prior.share, real, desvio: 100 * r.prior.share - real, peso: ((100 * r.prior.share - real) * (a + b)) / 100 };
  })
  .sort((x, y) => Math.abs(y.peso) - Math.abs(x.peso));
for (const l of linhas) {
  const lado = (x) => (x > 50 ? 'F' : 'L');
  console.log(`${l.uf} partida ${f2(l.prior)}% · real ${f2(l.real)}% · desvio ${(l.desvio >= 0 ? '+' : '') + f2(l.desvio)} pp · ${Math.round(l.peso).toLocaleString('pt-PT')} votos${lado(l.prior) !== lado(l.real) ? ' · VIROU' : ''}`);
}
