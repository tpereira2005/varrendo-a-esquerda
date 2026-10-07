// Teste da projeção com uma noite eleitoral real: a 2.ª volta de 2022 (Bolsonaro × Lula), estado a estado.
// Em cada momento da noite, a projeção só vê o que se sabia nessa altura (os ficheiros já publicados) e
// compara-se com o resultado final. Ponto de partida: 1.ª volta de 2022 com transferências estimadas.
//
//   node scripts/backtest-2022.mjs [outro-modelo.mjs]
//
// Dados: data/historico/2022.json (scripts/historico-2022.mjs).
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const H = JSON.parse(readFileSync(new URL('../data/historico/2022.json', import.meta.url), 'utf8'));
const RETENCAO = 0.97;
// Transferências para [Bolsonaro, Lula], fixadas a priori com o que se sabia antes da 2.ª volta: Tebet apoiou o
// Lula; "Outros" é sobretudo Ciro Gomes (PDT, cerca de 72%) mais candidatos de direita (Soraya, d'Ávila, Kelmon).
const TRANSF = { Tebet: [0.33, 0.42], Outros: [0.38, 0.35] };

/** Disputas no formato que a projeção espera ([0] = candidato da direita, como o Flávio em 2026). */
export function regions2022() {
  return Object.entries(H.primeira).map(([uf, v]) => {
    let b = RETENCAO * v.Bolsonaro;
    let l = RETENCAO * v.Lula;
    for (const [k, [tb, tl]] of Object.entries(TRANSF)) {
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
  });
}

/** O que se sabia no instante t: último ficheiro de cada estado e o histórico até aí. */
export function at2022(t, base = regions2022()) {
  const histories = {};
  const regions = base.map((r) => {
    const series = H.segunda[r.uf].filter((x) => x[0] <= t);
    histories[r.uf] = series.slice(0, -1).map(([, p, a, b]) => [p, a, b]);
    const last = series.at(-1);
    return {
      ...r,
      parsed: last ? { pctSections: 100 * last[1], final: last[1] >= 1, cands: [{ votes: last[2] }, { votes: last[3] }] } : null,
    };
  });
  return { regions, histories };
}

/** Resultado final (estados): % do Bolsonaro entre os dois. */
export function truth2022() {
  let a = 0;
  let b = 0;
  for (const s of Object.values(H.segunda)) {
    a += s.at(-1)[2];
    b += s.at(-1)[3];
  }
  return (100 * a) / (a + b);
}

/** Momentos da noite em que o país chegou a cada fração de secções apuradas (pesada pelos votos esperados). */
export function moments2022(targets = [0.02, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95]) {
  const base = regions2022();
  const times = [...new Set(Object.values(H.segunda).flatMap((s) => s.map((x) => x[0])))].sort((a, b) => a - b);
  const total = base.reduce((n, r) => n + r.prior.valid, 0);
  const progress = (t) =>
    base.reduce((n, r) => {
      const last = H.segunda[r.uf].filter((x) => x[0] <= t).at(-1);
      return n + (last ? last[1] : 0) * r.prior.valid;
    }, 0) / total;
  return targets.map((target) => ({ target, t: times.find((t) => progress(t) >= target) })).filter((m) => m.t);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const truth = truth2022();
  const models = [['atual', '../lib/projecao.mjs']];
  if (process.argv[2]) models.push(['outro', pathToFileURL(process.argv[2]).href]);
  const hora = new Intl.DateTimeFormat('pt-PT', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  console.log(`2.ª volta de 2022 · resultado final nos estados: Bolsonaro ${truth.toFixed(2)}% (Lula ganhou)\n`);
  for (const [name, path] of models) {
    const { project } = await import(path);
    console.log(`${name}: apurado | hora (Brasília) | contagem bruta | projeção [intervalo 95%] | P(Bolsonaro) | erro | acerta?`);
    for (const m of moments2022()) {
      const { regions, histories } = at2022(m.t);
      const p = project(regions, histories);
      const a = regions.reduce((n, r) => n + (r.parsed?.cands[0].votes ?? 0), 0);
      const c = regions.reduce((n, r) => n + (r.parsed ? r.parsed.cands[0].votes + r.parsed.cands[1].votes : 0), 0);
      const inside = truth >= p.low && truth <= p.high;
      console.log(
        `  ${String(Math.round(m.target * 100)).padStart(3)}% | ${hora.format(m.t)} | ${((100 * a) / c).toFixed(2)}% | ${p.flavio.toFixed(2)}% [${p.low.toFixed(1)}–${p.high.toFixed(1)}] | ${(100 * p.probFlavio).toFixed(1)}% | ${(p.flavio - truth >= 0 ? '+' : '') + (p.flavio - truth).toFixed(2)} | ${inside ? 'sim' : 'NÃO'}`,
      );
    }
    console.log();
  }
}
