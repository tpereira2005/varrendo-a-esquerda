// Pré-visualização da atualização da véspera (sem mudar nada): o que a projeção daria antes de haver votos
// com data/vespera.json ligado e os valores de data/sondagens.json. Ver docs/plano-vespera.md.
//
//   node scripts/vespera.mjs
import { readFileSync } from 'node:fs';
import { RACES } from '../lib/rounds.mjs';
import { UFS } from '../lib/tse.mjs';
import { priorOf, ancorarSondagens, project, probText } from '../lib/projecao.mjs';

const json = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const turno1 = json('../data/turno1.json');
const vespera = json('../data/vespera.json');
const sond = json('../data/sondagens.json');
const regions = RACES.filter((r) => r.cargo === 1 && (UFS.includes(r.uf) || r.uf === 'ZZ'));

const linha = (nome, rs) => {
  const p = project(rs.map((r) => ({ ...r, parsed: null })));
  console.log(`${nome.padEnd(46)} Flávio ${p.flavio.toFixed(2)}% · intervalo ${p.low.toFixed(1)}–${p.high.toFixed(1)} · vitória ${probText(p.probFlavio)} · estados ${p.statesFlavio}/${p.statesLula}`);
};
console.log(`Sondagens (${sond.periodo}, ${sond.institutos} institutos): média ${sond.media}% · mediana ${sond.mediana}% · lidas ${sond.lido.slice(0, 16)}`);
console.log(`vespera.json: ativo=${vespera.ativo}\n`);

// ponto de partida "puro" (sem véspera), mesmo que o ficheiro já esteja ligado
const puro = regions.map((r) => ({ ...r, prior: priorOf(turno1.president[r.uf].candidates, '22', '13') }));
linha('Atual (transferências do modelo)', puro);
const medidas = regions.map((r) => ({ ...r, prior: priorOf(turno1.president[r.uf].candidates, '22', '13', vespera.transferencias) }));
linha('Com transferências medidas (Datafolha)', medidas);
const s = { flavio: sond.media, incerteza: vespera.sondagens.incerteza };
const anc = ancorarSondagens(medidas.map((r) => r.prior), s);
linha(`+ âncora das sondagens (${s.flavio}%, ±${s.incerteza} pp)`, medidas.map((r, i) => ({ ...r, prior: anc.priors[i] })));
console.log(`\nPara ligar: em data/vespera.json, "ativo": true e "sondagens.flavio": ${sond.media} (+ institutos/período).`);
