// Descarrega do site todas as versões gravadas de uma volta (endereço público /api/dados, página a página),
// guarda-as em ../arquivo/revisoes-<volta>a-volta.json e gera os dados abertos (dados-abertos/<ano>-<volta>t/).
// Não precisa de acesso à base: qualquer pessoa pode correr.
//
//   node scripts/descarregar-dados.mjs 2                 (2.ª volta de 2026, do site publicado)
//   node scripts/descarregar-dados.mjs 2 http://localhost:5173
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const turno = Number(process.argv[2] ?? 2);
const site = (process.argv[3] ?? 'https://varrendo-a-esquerda.tomaspereira.chatgpt.site').replace(/\/$/, '');
const LIMITE = 1000;

const linhas = [];
let depois = 0;
for (;;) {
  const url = `${site}/api/dados?turno=${turno}&depois=${depois}&limite=${LIMITE}`;
  let r;
  for (let tentativa = 1; ; tentativa++) {
    r = await fetch(url).catch((e) => ({ ok: false, status: e.message }));
    if (r.ok || tentativa === 5) break;
    await new Promise((ok) => setTimeout(ok, 2000 * tentativa));
  }
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  const pagina = await r.json();
  for (const { key, at, parsed } of pagina.linhas) linhas.push({ key, at, parsed });
  process.stdout.write(`\r${linhas.length} versões descarregadas…`);
  if (pagina.seguinte == null) break;
  depois = pagina.seguinte;
}
console.log();
if (!linhas.length) throw new Error('Nenhuma versão gravada para esta volta.');

const destino = new URL(`../../arquivo/revisoes-${turno}a-volta.json`, import.meta.url);
mkdirSync(new URL('./', destino), { recursive: true });
writeFileSync(destino, JSON.stringify(linhas));
console.log(`Guardado em ${fileURLToPath(destino)}`);

const ano = new Date(linhas[0].at).getUTCFullYear();
execFileSync(process.execPath, ['--max-old-space-size=4096', fileURLToPath(new URL('dados-abertos.mjs', import.meta.url)), fileURLToPath(destino), String(ano), String(turno)], {
  stdio: 'inherit',
});
