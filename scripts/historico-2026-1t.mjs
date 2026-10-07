// Converte a exportação das revisões gravadas pelo site na noite da 1.ª volta de 2026 (tabela `revisions` da
// base de produção, exportada pelo Codex) num ficheiro compacto: data/historico/2026-1t.json.
// Por estado: [instante (ms), fração de secções apuradas (0–1), votos Flávio, votos Lula], por ordem.
//
//   node --max-old-space-size=4096 scripts/historico-2026-1t.mjs ../arquivo/revisoes-1a-volta.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const file = process.argv[2] ?? '../arquivo/revisoes-1a-volta.json';
const rows = JSON.parse(readFileSync(file, 'utf8'));
const out = { source: 'Ficheiros do TSE gravados pelo site na noite de 4/10/2026 (1.ª volta)', serie: {} };

for (const r of rows) {
  const m = /^2026:1:([A-Z]{2}):1$/.exec(r.key); // Presidente, por estado (e BR)
  if (!m) continue;
  const p = typeof r.parsed === 'string' ? JSON.parse(r.parsed) : r.parsed;
  const f = p.candidates?.find((c) => c.number === '22')?.votes ?? 0;
  const l = p.candidates?.find((c) => c.number === '13')?.votes ?? 0;
  if (!f && !l) continue;
  // o site da 1.ª volta guardava pctSections já como fração (0–1)
  (out.serie[m[1]] ??= []).push([r.at, p.pctSections, f, l]);
}
for (const s of Object.values(out.serie)) s.sort((a, b) => a[0] - b[0]);

mkdirSync(new URL('../data/historico/', import.meta.url), { recursive: true });
writeFileSync(new URL('../data/historico/2026-1t.json', import.meta.url), JSON.stringify(out));
console.log(Object.entries(out.serie).map(([uf, s]) => `${uf}:${s.length}`).join(' '));
