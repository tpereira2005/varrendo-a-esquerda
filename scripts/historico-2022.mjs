// Descarrega o apuramento real das eleições de 2022, estado a estado, e grava data/historico/2022.json:
//   - 1.ª volta (resultado final por estado, com os votos dos eliminados) → ponto de partida;
//   - 2.ª volta (evolução da noite: secções apuradas e votos de Bolsonaro e Lula) → teste da projeção.
// Fontes: 2.ª volta gravada do Divulga TSE durante a noite por Wesley Cota (github.com/wcota/br_eleicoes_2022_2T);
// 1.ª volta (resultado final por estado, dados do TSE) da tabela da Wikipédia "Resultados da eleição presidencial
// no Brasil em 2022" (o "Outros" inclui Ciro Gomes, ~72% desse grupo).
//
//   node scripts/historico-2022.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const UFS = 'ac al am ap ba ce df es go ma mg ms mt pa pb pe pi pr rj rn ro rr rs sc se sp to'.split(' ');
const RAW = (uf) => `https://raw.githubusercontent.com/wcota/br_eleicoes_2022_2T/main/${uf}.csv`;

async function csv(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  const [head, ...lines] = (await r.text()).trim().split('\n');
  const cols = head.split(',');
  return lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v.trim()])));
}

/** 1.ª volta por estado: Lula, Bolsonaro, Tebet, Outros (votos), da tabela da Wikipédia. */
async function primeiraVolta() {
  const url = 'https://pt.wikipedia.org/w/api.php?action=parse&page=Resultados_da_elei%C3%A7%C3%A3o_presidencial_no_Brasil_em_2022&prop=wikitext&format=json&formatversion=2';
  const w = (await (await fetch(url)).json()).parse.wikitext;
  const table = w.slice(w.indexOf('{|'), w.indexOf('|}', w.indexOf('{|')));
  const out = {};
  for (const row of table.split('|-').slice(1)) {
    const uf = row.match(/\{\{BR-([A-Z]{2})\}\}/)?.[1];
    if (!uf) continue;
    const n = [...row.matchAll(/\{\{Fmtn\|(\d+)\}\}/g)].map((m) => Number(m[1]));
    // eleitorado, abstenção, Lula, Bolsonaro, Tebet, Outros, brancos, nulos
    out[uf] = { Lula: n[2], Bolsonaro: n[3], Tebet: n[4], Outros: n[5] };
  }
  return out;
}

const out = {
  source: '2.ª volta: Divulga TSE gravado por github.com/wcota/br_eleicoes_2022_2T; 1.ª volta: Wikipédia (dados TSE)',
  // 1.ª volta: votos finais por estado (os "Outros" vêm somados)
  primeira: {},
  // 2.ª volta: [instante (ms), fração de secções apuradas (0–1), votos Bolsonaro, votos Lula] por estado
  segunda: {},
};

out.primeira = await primeiraVolta();
for (const uf of UFS) {
  const votes = out.primeira[uf.toUpperCase()];
  if (!votes?.Lula) throw new Error(`1.ª volta em falta: ${uf}`);

  const t2 = await csv(RAW(uf));
  const byTime = new Map();
  for (const r of t2) {
    if (!r.date_totalizacao) continue;
    const k = r.date;
    const row = byTime.get(k) ?? [Date.parse(r.date.replace(' ', 'T') + '-03:00'), Number(r.porcentagem_secoes_totalizadas) / 100, 0, 0];
    if (r.cand === 'Bolsonaro') row[2] = Number(r.votos);
    if (r.cand === 'Lula') row[3] = Number(r.votos);
    byTime.set(k, row);
  }
  out.segunda[uf.toUpperCase()] = [...byTime.values()].filter((x) => x[2] + x[3] > 0).sort((a, b) => a[0] - b[0]);
  console.log(uf, Object.keys(votes).join('/'), out.segunda[uf.toUpperCase()].length, 'momentos');
}

mkdirSync(new URL('../data/historico/', import.meta.url), { recursive: true });
writeFileSync(new URL('../data/historico/2022.json', import.meta.url), JSON.stringify(out));
console.log('gravado data/historico/2022.json');
