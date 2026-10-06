// Interpretação dos ficheiros da 2.ª volta e avisos, do ponto de vista de quem torce pelo Flávio.
// Regras: os números são os do TSE; vitória só com indicação oficial; estimativas sempre identificadas.
import { ROUND, FLAVIO } from './rounds.mjs';
import { candidatesOf, turnoutOf, officialTime, pct, int, isElected, UF_NAMES } from './tse.mjs';

export const UF_IN = {
  BR: 'no Brasil', AC: 'no Acre', AL: 'em Alagoas', AM: 'no Amazonas', AP: 'no Amapá', BA: 'na Bahia',
  CE: 'no Ceará', DF: 'no Distrito Federal', ES: 'no Espírito Santo', GO: 'em Goiás', MA: 'no Maranhão',
  MG: 'em Minas Gerais', MS: 'em Mato Grosso do Sul', MT: 'em Mato Grosso', PA: 'no Pará', PB: 'na Paraíba',
  PE: 'em Pernambuco', PI: 'no Piauí', PR: 'no Paraná', RJ: 'no Rio de Janeiro', RN: 'no Rio Grande do Norte',
  RO: 'em Rondônia', RR: 'em Roraima', RS: 'no Rio Grande do Sul', SC: 'em Santa Catarina', SE: 'em Sergipe',
  SP: 'em São Paulo', TO: 'no Tocantins',
};

/** Nome curto usado nos títulos: "Flávio" e "Lula" na Presidência, nome do boletim nos governadores. */
export function shortName(c, cargo) {
  if (cargo === 1) return c.number === FLAVIO ? 'Flávio' : 'Lula';
  return titleCase(c.name);
}

export function titleCase(s) {
  return String(s)
    .toLowerCase()
    .replace(/(^|\s)(\p{L})/gu, (m, sp, l) => sp + l.toUpperCase())
    .replace(/\b(De|Da|Do|Dos|Das|E)\b/g, (w) => w.toLowerCase());
}

/**
 * Valida e interpreta um ficheiro oficial da 2.ª volta para uma disputa (`job` vem de jobsFor).
 * Lança erro quando o ficheiro não corresponde à eleição, volta, abrangência ou cargo esperados.
 */
export function parseRunoff(json, job) {
  if (!json || typeof json !== 'object') throw new Error('Ficheiro oficial ilegível');
  if (Number(json.ele) !== job.ele) throw new Error(`Eleição ${json.ele} inesperada (esperada ${job.ele})`);
  if (Number(json.t) !== ROUND.turn) throw new Error(`Ficheiro da ${json.t}.ª volta rejeitado`);
  if (String(json.cdabr ?? '').toUpperCase() !== job.uf) throw new Error('Abrangência incompatível');
  const all = candidatesOf(json, job.cargo);
  if (!all) throw new Error('Cargo ausente do ficheiro');
  if (all.some((c) => c.votes == null || !c.number)) throw new Error('Votação de candidato inválida');
  const valid = all.filter((c) => c.valid);
  if (valid.length !== 2) throw new Error(`Esperava 2 candidatos válidos, encontrei ${valid.length}`);
  const pctSections = pct(json.s?.pst);
  if (pctSections == null) throw new Error('Percentagem de secções inválida');

  const warnings = [];
  const expected = job.finalists.map((f) => f.number);
  if (valid.map((c) => c.number).sort().join() !== [...expected].sort().join()) {
    warnings.push('Finalista alterado pelo TSE face à 1.ª volta.');
  }
  // Mantém a ordem da disputa (Flávio primeiro); um finalista novo ocupa o lugar do que falta.
  const ordered = expected.map((n) => valid.find((c) => c.number === n));
  const extra = valid.filter((c) => !expected.includes(c.number));
  for (let i = 0; i < 2; i++) if (!ordered[i]) ordered[i] = extra.shift();

  const total = ordered[0].votes + ordered[1].votes;
  const cands = ordered.map((c, i) => {
    const ref = job.finalists.find((f) => f.number === c.number);
    return {
      number: c.number,
      name: c.name,
      party: c.party,
      group: ref?.group ?? job.finalists[i].group,
      votes: c.votes,
      pct: c.pct ?? (total > 0 ? (100 * c.votes) / total : 0),
      elected: isElected(c.st),
      st: c.st,
      r1Votes: ref?.r1Votes ?? null,
      r1Pct: ref?.r1Pct ?? null,
    };
  });

  const final = json.tf === 's' && json.and === 'f';
  const withoutWinner = json.esae === 's';
  // Só o ficheiro nacional (Presidente) e o de cada governador elegem alguém; o resultado de um estado na Presidência não.
  const elects = job.uf === 'BR' || job.cargo === 3;
  let winner = null;
  if (elects && !withoutWinner) {
    const elected = cands.findIndex((c) => c.elected);
    if (elected >= 0) winner = elected;
    else if (final && cands[0].votes !== cands[1].votes) winner = cands[0].votes > cands[1].votes ? 0 : 1;
  }
  const vvc = int(json.v?.vvc);
  if (vvc != null && vvc !== total) warnings.push('A soma dos candidatos difere do total de votos válidos do TSE.');

  return {
    key: job.key,
    uf: job.uf,
    cargo: job.cargo,
    generatedAt: officialTime(json.dg, json.hg),
    totalizedAt: officialTime(json.dt, json.ht),
    pctSections,
    final,
    withoutWinner,
    winner,
    cands,
    turnout: turnoutOf(json),
    warnings,
  };
}

/** Quem vai à frente (0, 1) ou null se empatados/sem votos. */
export function leaderOf(a, b) {
  return a === b ? null : a > b ? 0 : 1;
}

/** Tom do ponto de vista do site: bom quando ganha a direita contra a esquerda. */
function toneFor(race, idx) {
  if (idx == null) return 'neutral';
  const me = race.finalists[idx] ?? race.finalists[0];
  const other = race.finalists[1 - idx];
  if (race.internal || !me || !other) return 'neutral';
  return me.group === 'direita' ? 'good' : 'bad';
}

const fmtInt = (n) => new Intl.NumberFormat('pt-PT').format(n);
const fmtPct = (n, d = 1) => new Intl.NumberFormat('pt-PT', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);

/**
 * Avisos de uma disputa, recalculados sempre a partir do histórico completo para terem identidade estável.
 * `points`: pontos da linha temporal [{generatedAt, pctSections, votesA, votesB}] por ordem.
 */
export function eventsFor(race, parsed, points) {
  const events = [];
  const name = (i) => shortName(parsed?.cands?.[i] ?? race.finalists[i], race.cargo);
  const where = UF_IN[race.uf];
  const add = (id, kind, idx, title, detail, extra = {}) =>
    events.push({ id: `${race.key}:${id}`, key: race.key, kind, uf: race.uf, cargo: race.cargo, tone: toneFor(race, idx), title, detail, ...extra });

  const showsTurns = race.uf === 'BR' || race.cargo === 3;

  // Viradas: a partir de 20% das secções e confirmadas por duas gerações oficiais seguidas.
  if (showsTurns) {
    let current = null;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (p.pctSections < 20) continue;
      const lead = leaderOf(p.votesA, p.votesB);
      if (current == null) {
        current = lead;
        continue;
      }
      const next = points[i + 1];
      if (lead != null && lead !== current && next && leaderOf(next.votesA, next.votesB) === lead) {
        current = lead;
        const diff = Math.abs(p.votesA - p.votesB);
        const office = race.cargo === 3 ? ` ${where}` : '';
        add(`virada:${p.generatedAt}`, 'virada', lead, `${name(lead)} passou à frente${office}!`,
          `Com ${fmtPct(p.pctSections)}% das secções apuradas · diferença de ${fmtInt(diff)} votos`, { at: p.generatedAt });
      }
    }
  }

  // Marcos do apuramento nacional.
  if (race.uf === 'BR') {
    const marks = [25, 50, 75, 90, 99];
    marks.forEach((m, i) => {
      const p = points.find((x) => x.pctSections >= m);
      // Um marco ultrapassado de uma só vez (ficheiro já acima do marco seguinte) não gera aviso.
      if (!p || (marks[i + 1] != null && p.pctSections >= marks[i + 1])) return;
      const lead = leaderOf(p.votesA, p.votesB);
      const diff = Math.abs(p.votesA - p.votesB);
      add(`marco:${m}`, 'marco', lead,
        lead == null ? `${m}% apurado: empate técnico` : `${m}% apurado: ${name(lead)} à frente por ${fmtInt(diff)} votos`,
        `${name(0)} ${fmtPct((100 * p.votesA) / Math.max(1, p.votesA + p.votesB))}% · ${name(1)} ${fmtPct((100 * p.votesB) / Math.max(1, p.votesA + p.votesB))}%`,
        { at: p.generatedAt });
    });
  }

  if (!parsed) return events;
  const [a, b] = parsed.cands;
  const lead = leaderOf(a.votes, b.votes);

  // Estado com apuramento completo (Presidência): quem venceu e se virou face à 1.ª volta.
  if (race.cargo === 1 && race.uf !== 'BR' && (parsed.final || parsed.pctSections >= 100) && lead != null) {
    const r1Lead = leaderOf(race.finalists[0].r1Votes, race.finalists[1].r1Votes);
    const flipped = r1Lead != null && r1Lead !== lead;
    const margin = Math.abs(a.pct - b.pct);
    add('fim', flipped ? 'estado-virou' : 'estado', lead,
      flipped ? `${UF_NAMES[race.uf]} virou para o ${name(lead)}!` : `${name(lead)} venceu ${where}`,
      `+${fmtPct(margin)} pp · ${fmtInt(Math.abs(a.votes - b.votes))} votos de diferença`,
      { flipped, at: parsed.generatedAt });
  }

  // Resultado oficial.
  if (parsed.winner != null) {
    const w = parsed.cands[parsed.winner];
    if (race.uf === 'BR') {
      const flavio = w.number === FLAVIO;
      add(`eleito:${w.number}`, 'eleito', parsed.winner,
        flavio ? 'FLÁVIO BOLSONARO ELEITO PRESIDENTE!' : 'Lula eleito Presidente pelo TSE',
        `${fmtPct(w.pct, 2)}% dos votos válidos · ${fmtInt(w.votes)} votos`, { at: parsed.generatedAt, winner: w.number });
    } else if (race.cargo === 3) {
      add(`eleito:${w.number}`, 'eleito', parsed.winner, `${titleCase(w.name)} (${w.party}) vence ${where}`,
        `Governador · ${fmtPct(w.pct, 2)}% dos votos válidos`, { at: parsed.generatedAt, winner: w.number });
    }
  }
  return events;
}

/**
 * Estimativa (não oficial) da percentagem dos votos por apurar de que o candidato atrás precisa para virar.
 * Votos por apurar em cada estado ≈ votos válidos da 1.ª volta × secções por apurar.
 */
export function toFlip(national, states) {
  if (!national) return null;
  const [a, b] = national.cands;
  const lead = leaderOf(a.votes, b.votes);
  if (lead == null || national.winner != null) return null;
  let remaining = 0;
  for (const s of states) {
    const done = s.parsed ? s.parsed.pctSections : 0;
    remaining += (s.r1.validos ?? 0) * Math.max(0, 1 - done / 100);
  }
  remaining = Math.round(remaining);
  if (remaining <= 0) return { trailing: 1 - lead, remaining: 0, needPct: null, impossible: true };
  const gap = Math.abs(a.votes - b.votes);
  const need = (100 * (gap + remaining)) / (2 * remaining);
  return { trailing: 1 - lead, remaining, needPct: Math.min(need, 999), impossible: need > 100 };
}

/** As 10 reações originais do boneco, pela percentagem do Flávio (mesmos limiares do painel original). */
export const MOODS = [
  { min: 62, label: 'Giga Chad', src: '/emoji/humor-10.png' },
  { min: 59, label: 'Chad', src: '/emoji/humor-09.png' },
  { min: 56, label: 'Barba cheia', src: '/emoji/humor-08.png' },
  { min: 53, label: 'Confiante', src: '/emoji/humor-07.png' },
  { min: 50, label: 'Esperança', src: '/emoji/humor-06.png' },
  { min: 47, label: 'Tensão', src: '/emoji/humor-05.png' },
  { min: 44, label: 'Abalado', src: '/emoji/humor-04.png' },
  { min: 41, label: 'Lágrimas', src: '/emoji/humor-03.png' },
  { min: 38, label: 'Choro', src: '/emoji/humor-02.png' },
  { min: 0, label: 'Desespero', src: '/emoji/humor-01.png' },
];

export function moodFor(national) {
  if (!national || national.cands[0].votes + national.cands[1].votes === 0) {
    return { label: 'A aguardar', src: '/emoji/humor-06.png' };
  }
  if (national.winner != null) return national.cands[national.winner].number === FLAVIO ? MOODS[0] : MOODS[9];
  const flavio = national.cands.find((c) => c.number === FLAVIO);
  return MOODS.find((m) => flavio.pct >= m.min);
}
