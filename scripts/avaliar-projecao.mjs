// Avalia a projeção em noites eleitorais simuladas: as probabilidades batem certo com o que acontece?
//
//   node scripts/avaliar-projecao.mjs [noites] [ficheiro-de-outro-modelo.mjs]
//
// Cada noite: um resultado final "verdadeiro" (ponto de partida + desvios do país, da região e do estado),
// uma afluência diferente da esperada e uma contagem em que as regiões andam a ritmos diferentes e, dentro
// de cada estado, os votos contados primeiro não são iguais aos que faltam (ordem de contagem). Essa diferença
// não segue uma reta (curvatura aleatória por estado) e cada ficheiro tem algum ruído, para a tendência
// medida pelo modelo nunca ser perfeita.
// Medidas, em vários momentos da noite:
//   - cobertura do intervalo de 95% (deve andar perto de 95%);
//   - pontuação de Brier da probabilidade de vitória (quanto menor, melhor);
//   - excesso de confiança: vezes em que o modelo dava ≥ 95% e o outro ganhou.
import { pathToFileURL } from 'node:url';
import { RACES } from '../lib/rounds.mjs';
import { UFS } from '../lib/tse.mjs';
import { REGIAO } from '../lib/projecao.mjs';

const REGIONS = RACES.filter((r) => r.cargo === 1 && (UFS.includes(r.uf) || r.uf === 'ZZ'));

/** Gerador pseudoaleatório com semente (resultados reproduzíveis). */
export function rng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
  return { next, normal };
}

/**
 * Uma noite simulada. `scale` aumenta todos os desvios (para testar um mundo mais imprevisível do que o modelo
 * supõe). Devolve o resultado final verdadeiro e uma função que dá o estado da contagem num momento (0–1).
 */
export function simulateNight(seed, { scale = 1 } = {}) {
  const R = rng(seed);
  const pp = (sd) => (R.normal() * sd * scale) / 100;
  const nat = pp(3);
  const drNat = pp(2);
  const reg = {};
  const drReg = {};
  const speed = {};
  for (const g of new Set(Object.values(REGIAO))) {
    reg[g] = pp(2);
    drReg[g] = pp(1.2);
    speed[g] = Math.exp(R.normal() * 0.5); // regiões mais rápidas ou mais lentas a contar
  }
  const turnoutNat = 1 + R.normal() * 0.03 * scale;
  const states = REGIONS.map((r) => {
    const g = REGIAO[r.uf];
    const share = Math.max(0.03, Math.min(0.97, r.prior.share + nat + reg[g] + pp(2.5)));
    const valid = Math.round(r.prior.valid * turnoutNat * (1 + R.normal() * 0.02 * scale));
    const drift = drNat + drReg[g] + pp(2.5); // contados primeiro − por contar
    const pace = speed[g] * Math.exp(R.normal() * 0.35);
    const curve = Math.exp(R.normal() * 0.35); // 1 = reta; ≠ 1 = a diferença concentra-se no início ou no fim
    return { race: r, share, valid, drift, pace, curve };
  });
  const finalA = states.reduce((n, s) => n + s.share * s.valid, 0);
  const finalTotal = states.reduce((n, s) => n + s.valid, 0);
  const truth = (100 * finalA) / finalTotal;

  const noise = {};
  /** Contagem de um estado quando o país vai em `progress` (0–1) das secções. */
  const count = (s, progress) => {
    const pct = progress >= 1 ? 1 : Math.min(1, Math.pow(progress, 1 / s.pace));
    const counted = Math.round(s.valid * pct);
    // a parte contada desvia-se do final em (1 − pct)^curva·drift; a que falta compensa
    const key = `${s.race.uf}:${progress}`;
    noise[key] ??= (R.normal() * 0.3 * scale) / 100; // ruído dos lotes de secções, que se dilui com a contagem
    const shareCounted = Math.max(0.01, Math.min(0.99, s.share + Math.pow(1 - pct, s.curve) * s.drift + (1 - pct) * noise[key]));
    return { pct, counted, a: Math.round(counted * shareCounted) };
  };
  /** Estado da contagem e histórico da noite (ficheiros anteriores) quando o país vai em `progress`. */
  const at = (progress) => {
    const regions = states.map((s) => {
      const { pct, counted, a } = count(s, progress);
      return {
        ...s.race,
        parsed: pct > 0 ? { pctSections: 100 * pct, final: pct >= 1, cands: [{ votes: a }, { votes: counted - a }] } : null,
      };
    });
    const histories = {};
    for (const s of states) {
      histories[s.race.uf] = [];
      for (let k = 1; k < 12; k++) {
        const { pct, counted, a } = count(s, (progress * k) / 12);
        if (counted) histories[s.race.uf].push([pct, a, counted - a]);
      }
    }
    return { regions, histories };
  };
  return { truth, at };
}

/** Avalia um modelo `project(regions)` em `nights` noites e nos momentos indicados. */
export function evaluate(project, { nights = 400, moments = [0, 0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 0.95], scale = 1, seed = 1 } = {}) {
  const out = moments.map((m) => ({ moment: m, n: 0, covered: 0, brier: 0, overconfident: 0, absError: 0 }));
  for (let k = 0; k < nights; k++) {
    const night = simulateNight(seed * 100_003 + k, { scale });
    const flavioWins = night.truth > 50 ? 1 : 0;
    moments.forEach((m, i) => {
      const { regions, histories } = night.at(m);
      const p = project(regions, histories);
      const o = out[i];
      o.n++;
      if (night.truth >= p.low && night.truth <= p.high) o.covered++;
      o.brier += (p.probFlavio - flavioWins) ** 2;
      if ((p.probFlavio >= 0.95 && !flavioWins) || (p.probFlavio <= 0.05 && flavioWins)) o.overconfident++;
      o.absError += Math.abs(p.flavio - night.truth);
    });
  }
  return out.map((o) => ({
    moment: o.moment,
    cobertura95: o.covered / o.n,
    brier: o.brier / o.n,
    excessoConfianca: o.overconfident / o.n,
    erroMedio: o.absError / o.n,
  }));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const nights = Number(process.argv[2] ?? 400);
  const models = [['atual', '../lib/projecao.mjs']];
  if (process.argv[3]) models.push(['outro', pathToFileURL(process.argv[3]).href]);
  for (const scale of [1, 1.5]) {
    console.log(`\n=== Mundo ${scale === 1 ? 'como o modelo supõe' : '50% mais imprevisível'} (${nights} noites) ===`);
    for (const [name, path] of models) {
      const { project } = await import(path);
      console.log(`\n${name}:  momento | cobertura 95% | Brier | ≥95% e perdeu | erro médio (pp)`);
      for (const r of evaluate(project, { nights, scale })) {
        console.log(
          `  ${String(Math.round(r.moment * 100)).padStart(3)}% | ${(100 * r.cobertura95).toFixed(1).padStart(5)}% | ${r.brier.toFixed(3)} | ${(100 * r.excessoConfianca).toFixed(1).padStart(4)}% | ${r.erroMedio.toFixed(2)}`,
        );
      }
    }
  }
}
