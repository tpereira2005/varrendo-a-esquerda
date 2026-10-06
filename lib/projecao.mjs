// Projeção do resultado final (estimativa estatística, NÃO oficial).
//
// Ideia: em cada estado (e no estrangeiro) já se conhece uma parte dos votos. Os votos que faltam
// são estimados com os votos válidos esperados (1.ª volta, ou o ritmo já observado na 2.ª) e
// repartidos segundo a quota do Flávio na 1.ª volta entre os dois, corrigida pela deslocação já
// observada nesse estado. Com poucos votos contados num estado, a deslocação desse estado é pouco
// fiável e "encolhe" para a deslocação média do país. A incerteza diminui à medida que se conta.
//
// O resultado oficial continua a ser só o do TSE: quando o TSE declara um vencedor, a projeção desaparece.

const SHRINK = 0.08; // fração contada a partir da qual a deslocação do próprio estado pesa metade
// Incerteza (desvio-padrão, pontos percentuais): ~3,75 pp antes de qualquer voto, ~2,2 pp com 40% contado,
// ~0,8 pp com 80%, ~0,3 pp perto do fim. Vem sobretudo da ordem de contagem dentro de cada estado
// (capital antes do interior, por exemplo), que pesa tanto mais quanto mais falta contar.
const SD_MAX = 3.75;
const SD_MIN = 0.25;

/** Função de distribuição normal (aproximação de Abramowitz-Stegun). */
export function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/** Incerteza (pp) em função da fração de votos ainda por contar. */
export function sdFor(remainingFraction) {
  const r = Math.max(0, Math.min(1, remainingFraction));
  return SD_MIN + (SD_MAX - SD_MIN) * Math.pow(r, 1.2);
}

/**
 * @param regions disputas de Presidente por estado e no estrangeiro: { uf, finalists, r1, parsed }.
 *   A ordem dos candidatos é a da disputa: [0] = Flávio, [1] = Lula.
 * @returns null sem dados de 1.ª volta; caso contrário a projeção nacional e por região.
 */
export function project(regions) {
  const rows = regions.map((r) => {
    const f1 = r.finalists[0].r1Votes;
    const l1 = r.finalists[1].r1Votes;
    const r1Share = f1 + l1 ? f1 / (f1 + l1) : 0.5;
    const a = r.parsed?.cands?.[0]?.votes ?? 0;
    const b = r.parsed?.cands?.[1]?.votes ?? 0;
    const counted = a + b;
    const pct = Math.max(0, Math.min(100, r.parsed?.pctSections ?? 0)) / 100;
    // Votos válidos esperados: com pelo menos 5% das secções, o ritmo observado; antes disso, a 1.ª volta.
    const expectedR1 = r.r1?.validos ?? counted;
    const fromPace = pct >= 0.05 ? counted / pct : expectedR1;
    const w = Math.min(1, pct / 0.3); // a partir de 30% contado, confia só no ritmo observado
    const expected = Math.max(counted, w * fromPace + (1 - w) * expectedR1);
    const remaining = r.parsed?.final ? 0 : Math.max(0, expected - counted);
    const observed = counted ? a / counted : null;
    return { uf: r.uf, r1Share, a, b, counted, pct, expected, remaining, observed };
  });

  // Deslocação média do país, pesada pelos votos já contados (só estados com votos).
  let num = 0;
  let den = 0;
  for (const x of rows) {
    if (x.observed == null) continue;
    num += (x.observed - x.r1Share) * x.counted;
    den += x.counted;
  }
  const nationalSwing = den ? num / den : 0;

  let projA = 0;
  let projB = 0;
  let totalExpected = 0;
  let totalRemaining = 0;
  const perRegion = rows.map((x) => {
    const weight = x.pct / (x.pct + SHRINK);
    const swing = x.observed == null ? nationalSwing : weight * (x.observed - x.r1Share) + (1 - weight) * nationalSwing;
    const shareRemaining = Math.max(0.02, Math.min(0.98, x.r1Share + swing));
    const finalA = x.a + x.remaining * shareRemaining;
    const finalB = x.b + x.remaining * (1 - shareRemaining);
    projA += finalA;
    projB += finalB;
    totalExpected += x.expected;
    totalRemaining += x.remaining;
    return {
      uf: x.uf,
      remaining: Math.round(x.remaining),
      pctSections: x.pct * 100,
      shareNow: x.observed == null ? null : x.observed * 100,
      shareRemaining: shareRemaining * 100,
      finalShare: (100 * finalA) / Math.max(1, finalA + finalB),
      // Votos líquidos que os votos por apurar devem dar ao Flávio (negativo = ao Lula).
      netFlavio: Math.round(x.remaining * (2 * shareRemaining - 1)),
    };
  });

  const share = (100 * projA) / Math.max(1, projA + projB);
  const remainingFraction = totalExpected ? totalRemaining / totalExpected : 1;
  const sd = sdFor(remainingFraction);
  const probFlavio = normalCdf((share - 50) / sd);
  return {
    flavio: share,
    lula: 100 - share,
    low: Math.max(0, share - 1.96 * sd),
    high: Math.min(100, share + 1.96 * sd),
    sd,
    probFlavio,
    margin: Math.round(projA - projB),
    remaining: Math.round(totalRemaining),
    remainingFraction,
    nationalSwing: nationalSwing * 100,
    statesFlavio: perRegion.filter((r) => r.uf !== 'ZZ' && r.finalShare > 50).length,
    statesLula: perRegion.filter((r) => r.uf !== 'ZZ' && r.finalShare < 50).length,
    perRegion,
  };
}

/** Probabilidade em texto, sem nunca mostrar certezas: ">99%" e "<1%" nos extremos. */
export function probText(prob) {
  const v = 100 * prob;
  if (v > 99) return '>99%';
  if (v < 1) return '<1%';
  return `${Math.round(v)}%`;
}

/** Frase curta para a projeção, do ponto de vista de quem torce pelo Flávio. */
export function projectionVerdict(p) {
  const prob = p.probFlavio;
  if (prob >= 0.99) return { who: 'flavio', text: 'O Flávio vai ganhar', strength: 'muito provável' };
  if (prob >= 0.9) return { who: 'flavio', text: 'O Flávio deve ganhar', strength: 'provável' };
  if (prob >= 0.65) return { who: 'flavio', text: 'O Flávio está em vantagem', strength: 'tendência' };
  if (prob > 0.35) return { who: null, text: 'Empate técnico', strength: 'tudo em aberto' };
  if (prob > 0.1) return { who: 'lula', text: 'O Lula está em vantagem', strength: 'tendência' };
  if (prob > 0.01) return { who: 'lula', text: 'O Lula deve ganhar', strength: 'provável' };
  return { who: 'lula', text: 'O Lula vai ganhar', strength: 'muito provável' };
}
