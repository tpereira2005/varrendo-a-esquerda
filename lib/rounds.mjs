// Definição da 2.ª volta: disputas, finalistas e identificadores oficiais.
import turno1 from '../data/turno1.json' with { type: 'json' };
import parties from './parties.json' with { type: 'json' };
import { UFS, TSE_BASE, resultUrl } from './tse.mjs';

export const ROUND = {
  year: 2026,
  turn: 2,
  cycle: 'ele2026',
  round1: { federal: 6257, estadual: 6259 },
  // Campo cdt2 das eleições 6257 e 6259 no ele-c.json oficial (gerado a 02/10/2026).
  // O coletor volta a confirmar na configuração do TSE e guarda o resultado na tabela `rounds`.
  expected: { federal: 6258, estadual: 6260 },
  opensAt: Date.parse('2026-10-25T16:30:00-03:00'),
  pollsCloseAt: Date.parse('2026-10-25T17:00:00-03:00'),
};

export const FLAVIO = '22';
export const LULA = '13';
export const OFFICES = { 1: 'Presidente', 3: 'Governador' };

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const groups = new Map();
for (const p of parties.parties) {
  for (const name of [p.sigla, ...(p.aliases ?? [])]) groups.set(norm(name), p.lado);
}

/** Agrupamento do autor original: só os partidos marcados "direita" contam como direita. */
export function groupOf(party) {
  return groups.get(norm(party)) === 'direita' ? 'direita' : 'esquerda';
}

function finalistsOf(r1) {
  return r1.candidates
    .filter((c) => /2[º°o]?\s*turno/i.test(c.st))
    .map((c) => ({
      number: c.number,
      name: c.name,
      party: c.party,
      group: groupOf(c.party),
      r1Votes: c.votes,
      r1Pct: c.pct,
    }));
}

function presidentRace(uf) {
  const r1 = turno1.president[uf];
  const pick = (n) => {
    const c = r1.candidates.find((x) => x.number === n);
    return { number: n, name: c.name, party: c.party, group: groupOf(c.party), r1Votes: c.votes, r1Pct: c.pct };
  };
  return { uf, cargo: 1, finalists: [pick(FLAVIO), pick(LULA)], r1: r1.turnout };
}

function governorRace(uf) {
  const r1 = turno1.governor[uf];
  const f = finalistsOf(r1);
  // Ordem: quem é "direita" primeiro (fica à esquerda do ecrã); em duelo interno, o mais votado na 1.ª volta.
  f.sort((a, b) => Number(b.group === 'direita') - Number(a.group === 'direita') || b.r1Votes - a.r1Votes);
  return { uf, cargo: 3, finalists: f, r1: r1.turnout };
}

/** Todas as disputas da 2.ª volta, pela ordem de prioridade. */
export const RACES = [
  presidentRace('BR'),
  ...UFS.map(presidentRace),
  presidentRace('ZZ'),
  ...Object.keys(turno1.governor).sort().map(governorRace),
].map((r) => ({
  ...r,
  key: `${ROUND.year}:${ROUND.turn}:${r.uf}:${r.cargo}`,
  office: OFFICES[r.cargo],
  internal: r.finalists[0].group === r.finalists[1].group,
}));

export const GOVERNOR_UFS = RACES.filter((r) => r.cargo === 3).map((r) => r.uf);

export const raceByKey = new Map(RACES.map((r) => [r.key, r]));

/** Pedidos de recolha com o endereço oficial de cada ficheiro. */
export function jobsFor(ids = ROUND.expected, base = TSE_BASE) {
  return RACES.map((race) => {
    const ele = race.cargo === 1 ? ids.federal : ids.estadual;
    return { ...race, ele, url: resultUrl({ base, cycle: ROUND.cycle, ele, uf: race.uf, cargo: race.cargo }) };
  });
}

/**
 * Procura na configuração oficial (ele-c.json) as eleições da 2.ª volta ligadas às da 1.ª.
 * Devolve null enquanto o TSE não as publicar.
 */
export function round2FromConfig(config) {
  const plea = (config?.pl ?? []).find((p) => p.c === ROUND.cycle);
  if (!plea) return null;
  const byCode = new Map((plea.e ?? []).map((e) => [Number(e.cd), e]));
  const second = (firstCode) => {
    const first = byCode.get(firstCode);
    const code = Number(first?.cdt2);
    if (!code) return null;
    const entry = byCode.get(code);
    return { code, published: !!entry && Number(entry.t) === 2 };
  };
  const federal = second(ROUND.round1.federal);
  const estadual = second(ROUND.round1.estadual);
  if (!federal || !estadual) return null;
  return { federal: federal.code, estadual: estadual.code, published: federal.published && estadual.published };
}
