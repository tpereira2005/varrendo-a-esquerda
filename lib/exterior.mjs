// Voto no estrangeiro: o TSE publica um ficheiro por cidade com posto consular (186 cidades)
// e um ficheiro de resumo (abrangências) com o progresso de todas de uma vez. O país vem de lib/exterior.json.
import CITIES from './exterior.json' with { type: 'json' };
import { TSE_BASE, candidatesOf, officialTime, int, pct } from './tse.mjs';

export { CITIES };
export const PORTUGAL = 'Portugal';

const e6 = (ele) => String(ele).padStart(6, '0');

export const abUrl = ({ base = TSE_BASE, cycle, ele }) => `${base}/oficial/${cycle}/${ele}/dados/zz/zz-e${e6(ele)}-ab.json`;
export const cityUrl = ({ base = TSE_BASE, cycle, ele, cd }) =>
  `${base}/oficial/${cycle}/${ele}/dados/zz/zz${cd}-c0001-e${e6(ele)}-u.json`;

/** Resumo de todas as cidades: identificador de versão de cada uma (muda quando há votos novos). */
export function parseAb(json, { ele, turn }) {
  if (Number(json?.ele) !== ele || Number(json?.t) !== turn) throw new Error('Resumo do estrangeiro de outra eleição');
  const out = {};
  for (const a of json.abr ?? []) {
    if (a.tpabr !== 'mun' || !CITIES[a.cdabr]) continue;
    out[a.cdabr] = { stamp: `${a.dt ?? ''} ${a.ht ?? ''} ${a.s?.st ?? ''}`.trim(), pctSections: pct(a.s?.pst) ?? 0 };
  }
  return out;
}

/** Resultado de uma cidade: votos de cada candidato válido e secções. */
export function parseCity(json, { ele, turn, cd }) {
  if (Number(json?.ele) !== ele || Number(json?.t) !== turn) throw new Error('Ficheiro de cidade de outra eleição');
  if (String(json.cdabr) !== String(cd)) throw new Error('Cidade incompatível');
  const cands = candidatesOf(json, 1);
  if (!cands || cands.some((c) => c.votes == null)) throw new Error('Votação inválida');
  const votes = {};
  for (const c of cands) if (c.valid) votes[c.number] = c.votes;
  return {
    cd,
    generatedAt: officialTime(json.dg, json.hg),
    pctSections: pct(json.s?.pst) ?? 0,
    sections: int(json.s?.ts) ?? 0,
    counted: int(json.s?.st) ?? 0,
    votes,
  };
}

/** Portugal primeiro; depois por número de votos (ou pela ordem alfabética, enquanto não houver votos). */
export function sortCountries(list, size) {
  return list.sort(
    (a, b) => Number(b.pais === PORTUGAL) - Number(a.pais === PORTUGAL) || size(b) - size(a) || a.pais.localeCompare(b.pais, 'pt'),
  );
}

/** Agrega as cidades por país. `cities`: {cd: parseCity(...)}. */
export function byCountry(cities, numbers) {
  const countries = new Map();
  for (const [cd, info] of Object.entries(CITIES)) {
    const c = cities[cd];
    let k = countries.get(info.pais);
    if (!k) countries.set(info.pais, (k = { pais: info.pais, votes: Object.fromEntries(numbers.map((n) => [n, 0])), sections: 0, counted: 0, cidades: [] }));
    const votes = Object.fromEntries(numbers.map((n) => [n, c?.votes?.[n] ?? 0]));
    for (const n of numbers) k.votes[n] += votes[n];
    k.sections += c?.sections ?? 0;
    k.counted += c?.counted ?? 0;
    k.cidades.push({ cd, cidade: info.cidade, votes, pctSections: c?.pctSections ?? 0, has: !!c });
  }
  const total = (x) => numbers.reduce((n, k) => n + x.votes[k], 0);
  for (const k of countries.values()) k.cidades.sort((a, b) => total(b) - total(a) || a.cidade.localeCompare(b.cidade, 'pt'));
  return sortCountries([...countries.values()], total);
}
