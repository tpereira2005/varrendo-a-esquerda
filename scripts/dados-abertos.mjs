// Converte uma exportação das revisões gravadas pelo site (tabela `revisions` da base de produção) em dados
// abertos: um CSV simples com a evolução da contagem, versão a versão, de Presidente, Governador e Senado
// (e das cidades do estrangeiro, a partir da 2.ª volta de 2026). Ver dados-abertos/README.md.
//
//   node --max-old-space-size=4096 scripts/dados-abertos.mjs ../arquivo/revisoes-2a-volta.json 2026 2
//   node scripts/dados-abertos.mjs 2022 2022 2      (2.ª volta de 2022, de data/historico/2022.json)
//
// A exportação é o resultado de `SELECT key, at, parsed FROM revisions WHERE turn = <volta> ORDER BY at`.
// Os deputados (cargos 6, 7 e 8) ficam de fora: têm mais de mil candidatos por estado em cada versão.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const [file, ano, turno] = process.argv.slice(2);
if (!file || !ano || !turno) {
  console.error('Uso: node scripts/dados-abertos.mjs <exportação.json> <ano> <volta>');
  process.exit(1);
}
const CARGOS = { 1: 'presidente', 3: 'governador', 5: 'senador' };
const COLS = [
  'ano', 'turno', 'cargo', 'uf', 'cidade_codigo', 'gravado_em_utc', 'gerado_tse_utc', 'fracao_secoes_apuradas',
  'numero', 'nome', 'partido', 'votos', 'eleitores', 'comparecimento', 'abstencao', 'brancos', 'nulos',
];
const iso = (t) => (t ? new Date(t).toISOString() : '');
const cell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Modo especial "2022": a 2.ª volta de 2022 a partir de data/historico/2022.json (gravações de github.com/wcota).
const rows =
  file === '2022'
    ? Object.entries(JSON.parse(readFileSync(new URL('../data/historico/2022.json', import.meta.url), 'utf8')).segunda).flatMap(([uf, serie]) =>
        serie.map(([at, frac, b, l]) => ({
          key: `2022:2:${uf}:1`,
          at,
          parsed: { pctSections: 100 * frac, cands: [{ number: '22', name: 'JAIR BOLSONARO', party: 'PL', votes: b }, { number: '13', name: 'LULA', party: 'PT', votes: l }] },
        })),
      )
    : JSON.parse(readFileSync(file, 'utf8'));
const lines = [COLS.join(',')];
const disputas = new Set();
let first = Infinity;
let last = 0;

for (const r of rows) {
  // chaves: <ano>:<volta>:<UF>:<cargo>  ou  <ano>:<volta>:ZZ-cidade:<código da cidade>
  const [, , area, extra] = r.key.split(':');
  const city = area === 'ZZ-cidade';
  const cargo = city ? 1 : Number(extra);
  if (!CARGOS[cargo]) continue;
  const p = typeof r.parsed === 'string' ? JSON.parse(r.parsed) : r.parsed;
  let frac;
  let cands;
  if (city) {
    frac = (p.pctSections ?? 0) / 100;
    cands = Object.entries(p.votes ?? {}).map(([number, votes]) => ({ number, votes }));
  } else if (p.cands) {
    // formato da 2.ª volta (lib/runoff.mjs): pctSections de 0 a 100
    frac = (p.pctSections ?? 0) / 100;
    cands = p.cands;
  } else {
    // formato do site na 1.ª volta: pctSections já como fração (0–1)
    frac = p.pctSections ?? 0;
    cands = p.candidates ?? [];
  }
  const t = p.turnout ?? {};
  const base = [ano, turno, CARGOS[cargo], city ? 'ZZ' : area, city ? extra : '', iso(r.at), iso(p.generatedAt), +frac.toFixed(6)];
  for (const c of cands) {
    lines.push(
      [...base, c.number, c.name ?? '', c.party ?? '', c.votes ?? '', t.eleitores ?? '', t.comparecimento ?? '', t.abstencao ?? '', t.brancos ?? '', t.nulos ?? '']
        .map(cell)
        .join(','),
    );
  }
  disputas.add(r.key);
  first = Math.min(first, r.at);
  last = Math.max(last, r.at);
}

const dir = new URL(`../dados-abertos/${ano}-${turno}t/`, import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL('evolucao.csv', dir), lines.join('\n') + '\n');
writeFileSync(
  new URL('resumo.json', dir),
  JSON.stringify({ ano: Number(ano), turno: Number(turno), linhas: lines.length - 1, disputas: disputas.size, primeiro: iso(first), ultimo: iso(last) }, null, 2) + '\n',
);
console.log(`dados-abertos/${ano}-${turno}t/evolucao.csv: ${lines.length - 1} linhas, ${disputas.size} disputas, ${iso(first)} → ${iso(last)}`);
