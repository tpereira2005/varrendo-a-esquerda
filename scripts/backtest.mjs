// Teste da projeção com noites eleitorais reais, estado a estado. Em cada momento a projeção só vê o que se
// sabia nessa altura (os ficheiros já publicados) e compara-se com o resultado final.
//
//   - 2022-2t: 2.ª volta de 2022 (Bolsonaro × Lula). Ponto de partida: 1.ª volta de 2022 com transferências.
//   - 2026-1t: 1.ª volta de 2026 (Flávio × Lula, só os dois). Ponto de partida: 2.ª volta de 2022 por estado.
//
//   node scripts/backtest.mjs [outro-modelo.mjs]
//
// Dados: data/historico/2022.json (scripts/historico-2022.mjs) e data/historico/2026-1t.json
// (scripts/historico-2026-1t.mjs, a partir das revisões gravadas pelo site na noite de 4/10/2026).
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const load = (name) => JSON.parse(readFileSync(new URL(`../data/historico/${name}`, import.meta.url), 'utf8'));
const H22 = load('2022.json');
const H26 = load('2026-1t.json');
const T1 = JSON.parse(readFileSync(new URL('../data/turno1.json', import.meta.url), 'utf8'));
const RETENCAO = 0.97;
// Transferências para [Bolsonaro, Lula] na 2.ª volta de 2022, fixadas com o que se sabia antes: Tebet apoiou o
// Lula; "Outros" é sobretudo Ciro Gomes (PDT, cerca de 72%) mais candidatos de direita (Soraya, d'Ávila, Kelmon).
const TRANSF_2022 = { Tebet: [0.33, 0.42], Outros: [0.38, 0.35] };

/** Uma noite: disputas no formato da projeção ([0] = candidato da direita), séries por estado e resultado final. */
function night({ name, label, base, series, finals }) {
  const regions = () => base.map((r) => ({ ...r }));
  const truth = () => {
    let a = 0;
    let b = 0;
    for (const [x, y] of Object.values(finals)) {
      a += x;
      b += y;
    }
    return (100 * a) / (a + b);
  };
  /** O que se sabia no instante t: último ficheiro de cada estado e o histórico até aí. */
  const at = (t) => {
    const histories = {};
    const out = regions().map((r) => {
      const s = (series[r.uf] ?? []).filter((x) => x[0] <= t);
      histories[r.uf] = s.slice(0, -1).map(([, p, a, b]) => [p, a, b]);
      const last = s.at(-1);
      return { ...r, parsed: last ? { pctSections: 100 * last[1], final: last[1] >= 1, cands: [{ votes: last[2] }, { votes: last[3] }] } : null };
    });
    return { regions: out, histories };
  };
  /** Momentos em que o país chegou a cada fração apurada (pesada pelos votos esperados de cada estado). */
  const moments = (targets = [0.02, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95]) => {
    const total = base.reduce((n, r) => n + r.prior.valid, 0);
    const times = [...new Set(Object.values(series).flatMap((s) => s.map((x) => x[0])))].sort((a, b) => a - b);
    const progress = (t) => base.reduce((n, r) => n + ((series[r.uf] ?? []).filter((x) => x[0] <= t).at(-1)?.[1] ?? 0) * r.prior.valid, 0) / total;
    return targets.map((target) => ({ target, t: times.find((t) => progress(t) >= target) })).filter((m) => m.t);
  };
  return { name, label, regions, at, truth, moments };
}

/** 2.ª volta de 2022 (Bolsonaro × Lula). */
export const noite2022 = night({
  name: '2022-2t',
  label: '2.ª volta de 2022 (Bolsonaro × Lula)',
  base: Object.entries(H22.primeira).map(([uf, v]) => {
    let b = RETENCAO * v.Bolsonaro;
    let l = RETENCAO * v.Lula;
    for (const [k, [tb, tl]] of Object.entries(TRANSF_2022)) {
      b += tb * v[k];
      l += tl * v[k];
    }
    return {
      uf,
      key: `2022:${uf}`,
      finalists: [{ r1Votes: v.Bolsonaro }, { r1Votes: v.Lula }],
      r1: { validos: v.Lula + v.Bolsonaro + v.Tebet + v.Outros },
      prior: { share: b / (b + l), valid: b + l },
    };
  }),
  series: H22.segunda,
  finals: Object.fromEntries(Object.entries(H22.segunda).map(([uf, s]) => [uf, [s.at(-1)[2], s.at(-1)[3]]])),
});

/** 1.ª volta de 2026 (Flávio × Lula, só os dois): ponto de partida = 2.ª volta de 2022 no mesmo estado. */
export const noite2026 = night({
  name: '2026-1t',
  label: '1.ª volta de 2026 (Flávio × Lula, só os dois)',
  base: Object.entries(H22.segunda).map(([uf, s]) => {
    const [, , b, l] = s.at(-1);
    return { uf, key: `2026:${uf}`, finalists: [{ r1Votes: b }, { r1Votes: l }], r1: { validos: b + l }, prior: { share: b / (b + l), valid: b + l } };
  }),
  series: Object.fromEntries(Object.entries(H26.serie).filter(([uf]) => uf !== 'BR')),
  // resultado oficial final (data/turno1.json)
  finals: Object.fromEntries(
    Object.keys(H22.segunda).map((uf) => {
      const c = T1.president[uf].candidates;
      return [uf, [c.find((x) => x.number === '22').votes, c.find((x) => x.number === '13').votes]];
    }),
  ),
});

export const NOITES = [noite2022, noite2026];

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const models = [['atual', '../lib/projecao.mjs']];
  if (process.argv[2]) models.push(['outro', pathToFileURL(process.argv[2]).href]);
  const hora = new Intl.DateTimeFormat('pt-PT', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  for (const n of NOITES) {
    const truth = n.truth();
    console.log(`\n=== ${n.label} · resultado final nos estados: direita ${truth.toFixed(2)}% ===`);
    for (const [name, path] of models) {
      const { project } = await import(path);
      console.log(`${name}: apurado | hora (Brasília) | contagem bruta | projeção [intervalo 95%] | P(direita) | erro | dentro?`);
      for (const m of n.moments()) {
        const { regions, histories } = n.at(m.t);
        const p = project(regions, histories);
        const a = regions.reduce((s, r) => s + (r.parsed?.cands[0].votes ?? 0), 0);
        const c = regions.reduce((s, r) => s + (r.parsed ? r.parsed.cands[0].votes + r.parsed.cands[1].votes : 0), 0);
        const err = p.flavio - truth;
        console.log(
          `  ${String(Math.round(m.target * 100)).padStart(3)}% | ${hora.format(m.t)} | ${((100 * a) / c).toFixed(2)}% | ${p.flavio.toFixed(2)}% [${p.low.toFixed(1)}–${p.high.toFixed(1)}] | ${(100 * p.probFlavio).toFixed(1)}% | ${(err >= 0 ? '+' : '') + err.toFixed(2)} | ${truth >= p.low && truth <= p.high ? 'sim' : 'NÃO'}`,
        );
      }
    }
  }
}
