// Projeção do resultado final (estimativa estatística, NÃO oficial).
//
// 1. Ponto de partida (antes de haver votos): em cada estado, a 1.ª volta com os votos dos candidatos
//    eliminados redistribuídos (transferências estimadas por candidato; parte não volta a votar).
// 2. Deslocação: diferença entre o que já se contou e esse ponto de partida. É estimada em três níveis:
//    estado → região → país. Um estado com pouco contado "empresta" a deslocação da sua região, e uma região
//    com pouco contado a do país. Assim a ordem de contagem entre estados não engana a projeção.
// 3. Tendência da contagem: com o histórico da noite, mede-se em cada estado como a quota muda à medida que se
//    conta (por exemplo, o Lula a subir com os votos do interior). Os votos que faltam seguem essa tendência.
//    Também em três níveis (estado → região → país), porque um estado sozinho tem pouco histórico.
// 4. Votos por apurar: votos válidos esperados (ponto de partida corrigido pela afluência já observada).
// 5. Incerteza com correlação: o erro nos votos por apurar tem uma parte comum ao país, outra à região e
//    outra ao estado. A parte comum não se anula entre estados, por isso conta muito mais do que somar
//    erros independentes. Antes de haver votos pesa a incerteza do ponto de partida; depois pesa a ordem de
//    contagem dentro dos estados (os votos que faltam podem não ser como os já contados).
//
// O resultado oficial continua a ser só o do TSE: quando o TSE declara um vencedor, a projeção desaparece.
// Calibração verificada em noites simuladas: test/projecao.test.mjs e scripts/avaliar-projecao.mjs.

/** Regiões do Brasil (e o estrangeiro à parte), para partilhar a deslocação entre estados vizinhos. */
export const REGIAO = {
  AC: 'N', AP: 'N', AM: 'N', PA: 'N', RO: 'N', RR: 'N', TO: 'N',
  AL: 'NE', BA: 'NE', CE: 'NE', MA: 'NE', PB: 'NE', PE: 'NE', PI: 'NE', RN: 'NE', SE: 'NE',
  DF: 'CO', GO: 'CO', MT: 'CO', MS: 'CO',
  ES: 'SE', MG: 'SE', RJ: 'SE', SP: 'SE',
  PR: 'S', RS: 'S', SC: 'S',
  ZZ: 'EX',
};

/**
 * Transferências estimadas dos eleitores dos candidatos eliminados na 1.ª volta: [fração que vota Flávio,
 * fração que vota Lula]; o resto não volta a votar ou vota branco/nulo. São hipóteses: a deslocação
 * observada durante a contagem corrige-as depressa.
 */
export const TRANSFERENCIAS = {
  55: [0.72, 0.1], // Ronaldo Caiado (PSD)
  30: [0.75, 0.08], // Zema (Novo)
  14: [0.55, 0.15], // Renan Santos (Missão)
  70: [0.42, 0.3], // Augusto Cury (Avante)
  27: [0.6, 0.15], // DC
  35: [0.5, 0.2], // Democrata
  80: [0.05, 0.65], // UP
  16: [0.05, 0.55], // PSTU
  21: [0.05, 0.65], // PCB
  29: [0.05, 0.6], // PCO
};
const TRANSFERENCIA_PADRAO = [0.4, 0.35];
/** Fração dos eleitores de cada finalista que volta a votar nele (alguns faltam na 2.ª volta). */
const RETENCAO = 0.97;

/**
 * Ponto de partida de um estado a partir dos votos da 1.ª volta de todos os candidatos.
 * @returns {{ share: number, valid: number }} quota do Flávio entre os dois (0–1) e votos válidos esperados
 */
export function priorOf(candidates, flavio = '22', lula = '13') {
  let f = 0;
  let l = 0;
  for (const c of candidates) {
    if (c.number === flavio) f += RETENCAO * c.votes;
    else if (c.number === lula) l += RETENCAO * c.votes;
    else {
      const [tf, tl] = TRANSFERENCIAS[c.number] ?? TRANSFERENCIA_PADRAO;
      f += tf * c.votes;
      l += tl * c.votes;
    }
  }
  return { share: f + l ? f / (f + l) : 0.5, valid: f + l };
}

/**
 * Parâmetros do modelo. Os de incerteza foram afinados em noites simuladas (scripts/avaliar-projecao.mjs),
 * para que o intervalo de 95% contenha o resultado final perto de 95% das vezes, durante toda a noite.
 */
export const AJUSTE = {
  // Incerteza (pp na quota dos votos por apurar), por nível: [antes de haver votos, ordem de contagem].
  // Antes de votos: quanto o ponto de partida pode falhar. Com votos: quanto os votos que faltam podem diferir
  // dos já contados. Cada nível passa de um para o outro à medida que se conta.
  incerteza: { pais: [3.0, 1.6], regiao: [2.0, 0.3], estado: [2.5, 9.5] },
  // Fração contada a partir da qual os dados de um nível pesam metade (o resto vem do nível acima).
  metade: { pais: 0.02, regiao: 0.05, estado: 0.08, afluencia: 0.1 },
  // Tendência: "quantidade de histórico" (fração contada × amplitude observada) a partir da qual pesa metade.
  metadeTendencia: { pais: 0.01, regiao: 0.025, estado: 0.012 },
  // Parte da incerteza da ordem de contagem que fica mesmo com a tendência medida (não é uma reta perfeita).
  residuoTendencia: 0.18,
  // No fim da contagem, os últimos votos de um estado podem ser muito diferentes (zonas remotas, por exemplo).
  fim: 0.95,
  // Incerteza relativa nos votos por apurar (afluência), antes e depois de observada.
  afluencia: [0.05, 0.01],
  // Margem de segurança: alarga a incerteza 15% para continuar fiável numa noite mais imprevisível do que a
  // simulada (o aviso "vai ganhar", a 99%, quase nunca falha mesmo com desvios 50% maiores).
  seguranca: 1.15,
};

/**
 * Tendência da contagem num estado. A quota acumulada do Flávio com uma fração p contada é, aproximadamente,
 * c(p) = F + (1 − p)·d, em que F é o resultado final e d a diferença entre os votos contados primeiro e os que
 * faltam. Ajusta-se a reta aos pontos da noite (mínimos quadrados em 1 − p).
 * @param points [[p (0–1), votos Flávio, votos Lula], ...]
 * @returns {{ d: number, span: number } | null}
 */
export function trendOf(points) {
  const pts = points.filter(([p, a, b]) => p >= 0.03 && a + b > 0).map(([p, a, b]) => [1 - p, a / (a + b)]);
  if (pts.length < 3) return null;
  const xs = pts.map((q) => q[0]);
  const span = Math.max(...xs) - Math.min(...xs);
  if (span < 0.05) return null;
  const mx = xs.reduce((n, x) => n + x, 0) / pts.length;
  const my = pts.reduce((n, q) => n + q[1], 0) / pts.length;
  let sxy = 0;
  let sxx = 0;
  for (const [x, y] of pts) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
  }
  return sxx ? { d: clamp(sxy / sxx, -0.3, 0.3), span } : null;
}

const weight = (frac, half) => (frac > 0 ? frac / (frac + half) : 0);
const mix = ([before, after], w) => (1 - w) ** 2 * before ** 2 + w ** 2 * after ** 2;

/** Função de distribuição normal (aproximação de Abramowitz-Stegun). */
export function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

/**
 * @param regions disputas de Presidente por estado e no estrangeiro: { uf, finalists, r1, prior?, parsed }.
 *   A ordem dos candidatos é a da disputa: [0] = Flávio, [1] = Lula.
 * @param histories histórico da noite por estado: { [uf]: [[p (0–1), votos Flávio, votos Lula], ...] } (opcional)
 */
export function project(regions, histories = {}, k = AJUSTE) {
  const rows = regions.map((r) => {
    const f1 = r.finalists[0].r1Votes;
    const l1 = r.finalists[1].r1Votes;
    // Sem ponto de partida calculado: a 1.ª volta entre os dois.
    const prior = r.prior ?? { share: f1 + l1 ? f1 / (f1 + l1) : 0.5, valid: r.r1?.validos ?? f1 + l1 };
    const a = r.parsed?.cands?.[0]?.votes ?? 0;
    const b = r.parsed?.cands?.[1]?.votes ?? 0;
    const counted = a + b;
    const pct = clamp(r.parsed?.pctSections ?? 0, 0, 100) / 100;
    return {
      uf: r.uf,
      region: REGIAO[r.uf] ?? 'EX',
      prior,
      a,
      b,
      counted,
      pct: counted ? pct : 0,
      final: !!r.parsed?.final,
      observed: counted ? a / counted : null,
    };
  });

  // ---- tendência da contagem: estado → região → país ----
  for (const x of rows) {
    const hist = histories[x.uf] ?? [];
    x.trend = x.counted && !x.final ? trendOf([...hist, [x.pct, x.a, x.b]]) : null;
  }
  const trendLevel = (list) => {
    let num = 0;
    let den = 0;
    let amount = 0;
    let all = 0;
    for (const x of list) {
      all += x.prior.valid;
      if (!x.trend) continue;
      const k = x.counted * x.trend.span;
      num += x.trend.d * k;
      den += k;
      amount += k;
    }
    return { d: den ? num / den : 0, amount: all ? amount / all : 0 };
  };
  const tNat = trendLevel(rows);
  const wdNat = weight(tNat.amount, k.metadeTendencia.pais);
  const driftNat = wdNat * tNat.d;
  const driftReg = {};
  for (const g of new Set(rows.map((x) => x.region))) {
    const t = trendLevel(rows.filter((x) => x.region === g));
    const w = weight(t.amount, k.metadeTendencia.regiao);
    driftReg[g] = { w, d: w * t.d + (1 - w) * driftNat };
  }
  for (const x of rows) {
    const g = driftReg[x.region];
    x.wd = x.trend ? weight(x.trend.span * x.pct, k.metadeTendencia.estado) : 0;
    x.drift = x.wd * (x.trend?.d ?? 0) + (1 - x.wd) * g.d;
    x.wdRegion = g.w;
    // resultado final estimado só com os votos deste estado, já sem o efeito da ordem de contagem
    x.debiased = x.observed == null ? null : clamp(x.observed - (1 - x.pct) * x.drift, 0.01, 0.99);
  }

  // ---- afluência: votos válidos face ao ponto de partida, nas secções já apuradas ----
  let cNum = 0;
  let cDen = 0;
  for (const x of rows) {
    if (!x.pct) continue;
    cNum += x.counted;
    cDen += x.pct * x.prior.valid;
  }
  const priorTotal = rows.reduce((n, x) => n + x.prior.valid, 0);
  const wTurnoutNat = weight(cDen / Math.max(1, priorTotal), k.metade.pais);
  const turnoutNat = wTurnoutNat * (cDen ? cNum / cDen : 1) + (1 - wTurnoutNat);
  for (const x of rows) {
    x.wTurnout = weight(x.pct, k.metade.afluencia);
    const own = x.pct ? x.counted / (x.pct * x.prior.valid) : turnoutNat;
    const ratio = x.wTurnout * own + (1 - x.wTurnout) * turnoutNat;
    x.expected = x.final ? x.counted : Math.max(x.counted, ratio * x.prior.valid);
    x.remaining = x.expected - x.counted;
  }
  const totalExpected = rows.reduce((n, x) => n + x.expected, 0);

  // ---- deslocação face ao ponto de partida: país → região → estado ----
  const swingOf = (list) => {
    let num = 0;
    let den = 0;
    for (const x of list) {
      if (x.debiased == null) continue;
      num += (x.debiased - x.prior.share) * x.counted;
      den += x.counted;
    }
    const expected = list.reduce((n, x) => n + x.expected, 0);
    return { swing: den ? num / den : 0, frac: expected ? den / expected : 0 };
  };
  const nat = swingOf(rows);
  const wNat = weight(nat.frac, k.metade.pais);
  const nationalSwing = wNat * nat.swing; // sem votos, 0: fica o ponto de partida
  const regions_ = {};
  for (const g of new Set(rows.map((x) => x.region))) {
    const r = swingOf(rows.filter((x) => x.region === g));
    const w = weight(r.frac, k.metade.regiao);
    regions_[g] = { w, swing: w * r.swing + (1 - w) * nationalSwing };
  }

  // A incerteza da ordem de contagem diminui onde a tendência já foi medida.
  const ord = ([before, after], wd) => [before, after * Math.sqrt((1 - wd) ** 2 + (wd * k.residuoTendencia) ** 2)];
  const varNat = mix(ord(k.incerteza.pais, wdNat), wNat);
  let projA = 0;
  let projB = 0;
  let totalRemaining = 0;
  let priorA = 0;
  for (const x of rows) {
    const g = regions_[x.region];
    x.w = weight(x.pct, k.metade.estado);
    // Votos que faltam = resultado final do estado − a parte que já foi contada "a mais" (pct·tendência).
    const fromState = x.observed == null ? null : x.observed - x.drift;
    const fromRegion = x.prior.share + g.swing - x.pct * x.drift;
    x.shareRemaining = clamp(fromState == null ? fromRegion : x.w * fromState + (1 - x.w) * fromRegion, 0.02, 0.98);
    x.finalA = x.a + x.remaining * x.shareRemaining;
    x.finalB = x.b + x.remaining * (1 - x.shareRemaining);
    x.varRegion = mix(ord(k.incerteza.regiao, x.wdRegion), g.w);
    x.varState = mix(ord(k.incerteza.estado, x.wd), x.w) * (1 + (k.fim * x.pct) / (1 - x.pct + 0.05));
    projA += x.finalA;
    projB += x.finalB;
    totalRemaining += x.remaining;
    priorA += x.prior.share * x.prior.valid;
  }
  const total = Math.max(1, projA + projB);
  const share = (100 * projA) / total;

  // ---- incerteza nacional, com a parte comum ao país e às regiões ----
  const v = rows.map((x) => x.remaining / total); // peso de cada estado no resultado nacional
  const sumV = v.reduce((n, y) => n + y, 0);
  let variance = varNat * sumV ** 2;
  const byRegion = {};
  rows.forEach((x, i) => {
    byRegion[x.region] ??= { v: 0, var: x.varRegion };
    byRegion[x.region].v += v[i];
    variance += v[i] ** 2 * x.varState;
    // afluência: mais ou menos votos por apurar num estado mexem no total conforme a sua quota
    const tau = (1 - x.wTurnout) * k.afluencia[0] + x.wTurnout * k.afluencia[1];
    variance += (v[i] * tau * 100 * (x.shareRemaining - share / 100)) ** 2;
  });
  for (const g of Object.values(byRegion)) variance += g.v ** 2 * g.var;
  const sd = Math.max(0.03, (k.seguranca ?? 1) * Math.sqrt(variance));
  const probFlavio = normalCdf((share - 50) / sd);

  const perRegion = rows.map((x) => {
    const finalShare = (100 * x.finalA) / Math.max(1, x.finalA + x.finalB);
    const left = x.remaining / Math.max(1, x.expected);
    const sdState = Math.max(0.03, left * Math.sqrt(varNat + x.varRegion + x.varState));
    return {
      uf: x.uf,
      remaining: Math.round(x.remaining),
      pctSections: x.pct * 100,
      shareNow: x.observed == null ? null : x.observed * 100,
      shareRemaining: x.shareRemaining * 100,
      finalShare,
      prob: normalCdf((finalShare - 50) / sdState),
      // Votos líquidos que os votos por apurar devem dar ao Flávio (negativo = ao Lula).
      netFlavio: Math.round(x.remaining * (2 * x.shareRemaining - 1)),
    };
  });
  const states = perRegion.filter((r) => r.uf !== 'ZZ');

  return {
    flavio: share,
    lula: 100 - share,
    low: Math.max(0, share - 1.96 * sd),
    high: Math.min(100, share + 1.96 * sd),
    sd,
    probFlavio,
    margin: Math.round(projA - projB),
    remaining: Math.round(totalRemaining),
    remainingFraction: totalExpected ? totalRemaining / totalExpected : 1,
    prior: (100 * priorA) / Math.max(1, priorTotal),
    nationalSwing: nationalSwing * 100,
    /** Tendência nacional da contagem: votos contados primeiro − por contar (pp, + = Flávio). */
    trend: driftNat * 100,
    turnout: turnoutNat,
    statesFlavio: states.filter((r) => r.finalShare > 50).length,
    statesLula: states.filter((r) => r.finalShare < 50).length,
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
