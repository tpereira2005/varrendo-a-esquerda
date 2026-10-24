// Sondagens da 2.ª volta (Flávio × Lula) feitas depois da 1.ª volta, a partir da tabela da Wikipédia
// "Opinion polling for the 2026 Brazilian presidential election" (secção "October (after 1st round)").
// Calcula a quota do Flávio entre os dois em cada sondagem, a média da sondagem mais recente de cada instituto
// nos últimos dias, e a evolução por semana. Grava data/sondagens.json. Ver docs/plano-vespera.md.
//
//   node scripts/sondagens.mjs [dias=7]
import { writeFileSync, readFileSync } from 'node:fs';
import { recentesPorInstituto } from '../lib/sondagens.mjs';

const DIAS = Number(process.argv[2] ?? 7);
const PAGE = 'Opinion_polling_for_the_2026_Brazilian_presidential_election';
const URL_WIKI = `https://en.wikipedia.org/w/api.php?action=parse&page=${PAGE}&prop=wikitext&format=json&formatversion=2`;
const MESES = { Sep: 8, Oct: 9 };

const wikitext = (await (await fetch(URL_WIKI, { headers: { 'user-agent': 'varrendo-a-esquerda (sondagens)' } })).json()).parse.wikitext;
const start = wikitext.indexOf('==== October (after 1st round) ====');
if (start < 0) throw new Error('Secção "October (after 1st round)" não encontrada na Wikipédia');
const table = wikitext.slice(start, wikitext.indexOf('|}', start));

/** Valor de uma célula sem estilos nem formatação ("style=... |48.9" → 48.9). */
const cell = (s) => s.replace(/^\|/, '').split('|').pop().replace(/''/g, '').trim();

/** "19–20 Oct" ou "30 Sep–3 Oct" → data do último dia de trabalho de campo (2026). */
function fim(periodo) {
  const m = periodo.match(/(\d{1,2})\s*(Sep|Oct)?\s*$/);
  const mes = m?.[2] ?? periodo.match(/(Sep|Oct)/)?.[1];
  if (!m || !mes) return null;
  return Date.UTC(2026, MESES[mes], Number(m[1]));
}

const sondagens = [];
for (const row of table.split('\n|-').slice(1)) {
  const cells = row
    .split('\n')
    .filter((l) => l.startsWith('|') && !l.startsWith('|-') && !l.startsWith('|}'))
    .map(cell);
  if (cells.length < 4) continue;
  const [instituto, periodo, lula, flavio] = cells;
  const l = Number(lula);
  const f = Number(flavio);
  const data = fim(periodo);
  if (!instituto || !Number.isFinite(l) || !Number.isFinite(f) || !data) continue;
  sondagens.push({ instituto, periodo, fim: new Date(data).toISOString().slice(0, 10), lula: l, flavio: f, quota: (100 * f) / (f + l) });
}
if (!sondagens.length) throw new Error('Nenhuma sondagem lida: o formato da tabela mudou?');

// A compilação serve para descoberta. A âncora só usa valores válidos conferidos na publicação original.
const verificadas = JSON.parse(readFileSync(new URL('../data/sondagens-verificadas.json', import.meta.url), 'utf8'));
const lista = recentesPorInstituto(verificadas, DIAS).sort((a, b) => b.quota - a.quota);
const descoberta = recentesPorInstituto(sondagens, DIAS);
const ultimaData = Math.max(...lista.map((s) => Date.parse(s.fim)));
if (Date.now() - ultimaData > 3 * 86400000) throw new Error('Sondagens verificadas demasiado antigas');
const desde = Math.min(...lista.map((s) => Date.parse(s.fim)));
const media = lista.reduce((n, s) => n + s.quota, 0) / lista.length;
const ord = lista.map((s) => s.quota).sort((a, b) => a - b);
const mediana = ord.length % 2 ? ord[(ord.length - 1) / 2] : (ord[ord.length / 2 - 1] + ord[ord.length / 2]) / 2;

const semanas = {};
for (const s of sondagens) {
  const k = new Date(Date.parse(s.fim) - (new Date(s.fim).getUTCDay() + 6) % 7 * 86_400_000).toISOString().slice(0, 10);
  (semanas[k] ??= []).push(s.quota);
}

const resumo = {
  fonte: `https://en.wikipedia.org/wiki/${PAGE}`,
  lido: new Date().toISOString(),
  dias: DIAS,
  periodo: `${new Date(desde).toISOString().slice(0, 10)} a ${new Date(ultimaData).toISOString().slice(0, 10)}`,
  institutos: lista.length,
  metodo: 'Uma sondagem por instituto; média simples dos votos válidos publicados, conferidos nas fontes originais. Sem correção política ou mercado.',
  descoberta: { institutos: descoberta.length, media: descoberta.reduce((n, p) => n + p.quota, 0) / descoberta.length, uso: 'Contexto não usado na âncora; valores recalculados da compilação ainda não conferidos' },
  media: +media.toFixed(2),
  mediana: +mediana.toFixed(2),
  minimo: +ord[0].toFixed(2),
  maximo: +ord.at(-1).toFixed(2),
  semanas: Object.fromEntries(Object.entries(semanas).sort().map(([k, v]) => [k, { n: v.length, media: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) }])),
  recentes: lista.map((s) => ({ ...s, flavio: s.quota })),
  todas: sondagens.length,
};
writeFileSync(new URL('../data/sondagens.json', import.meta.url), JSON.stringify(resumo, null, 2) + '\n');

console.log(`Sondagens depois da 1.ª volta: ${sondagens.length} · últimos ${DIAS} dias (${resumo.periodo}): ${lista.length} institutos`);
for (const s of lista) console.log(`  ${s.instituto.padEnd(14)} ${s.periodo.padEnd(14)} Flávio ${s.quota.toFixed(1)}%`);
console.log(`Média ${resumo.media}% · mediana ${resumo.mediana}% · de ${resumo.minimo}% a ${resumo.maximo}%`);
console.log('Por semana:', Object.entries(resumo.semanas).map(([k, v]) => `${k}: ${v.media}% (${v.n})`).join(' · '));
console.log('Gravado em data/sondagens.json');
