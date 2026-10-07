// Mercado de previsões (Polymarket): probabilidade de vitória segundo as apostas. Nunca é resultado oficial.
// Dados públicos, sem chave: o evento na API Gamma e o histórico de preços na API CLOB.
import { ROUND } from './rounds.mjs';

export const EVENT_SLUG = 'brazil-presidential-election';
export const EVENT_URL = `https://gamma-api.polymarket.com/events?slug=${EVENT_SLUG}`;
const HISTORY_URL = 'https://clob.polymarket.com/prices-history';

/** Ritmo das leituras: na noite eleitoral o mercado mexe depressa; fora dela, chega de 10 em 10 minutos. */
export const MARKET_INTERVALS = { active: 60_000, idle: 600_000, campaign: 6 * 3_600_000 };

const num = (v) => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};
const list = (v) => {
  if (Array.isArray(v)) return v;
  try {
    return JSON.parse(v);
  } catch {
    return [];
  }
};

/**
 * Preço mostrado pelo próprio Polymarket: o meio entre a melhor compra e a melhor venda;
 * se essa diferença for grande (mais de 10 cêntimos), o preço da última transação.
 */
export function priceOf(m) {
  const bid = num(m.bestBid);
  const ask = num(m.bestAsk);
  if (bid != null && ask != null && ask >= bid && ask - bid <= 0.1) return (bid + ask) / 2;
  const last = num(m.lastTradePrice);
  if (last != null && last > 0) return last;
  return num(list(m.outcomePrices)[0]);
}

const FLAVIO_RE = /fl[aá]vio/i;
const LULA_RE = /lula/i;

/** Lê o evento da eleição presidencial e devolve as probabilidades do Flávio e do Lula (0–100). */
export function parseEvent(json) {
  const event = Array.isArray(json) ? json[0] : json;
  if (!event?.markets?.length) throw new Error('Polymarket: evento sem mercados');
  const find = (re) => event.markets.find((m) => re.test(m.groupItemTitle ?? '') || re.test(m.question ?? ''));
  const f = find(FLAVIO_RE);
  const l = find(LULA_RE);
  if (!f || !l) throw new Error('Polymarket: mercados do Flávio e do Lula não encontrados');
  const pf = priceOf(f);
  const pl = priceOf(l);
  if (pf == null || pl == null || pf < 0 || pf > 1 || pl < 0 || pl > 1) throw new Error('Polymarket: preços inválidos');
  return {
    flavio: 100 * pf,
    lula: 100 * pl,
    change24h: 100 * (num(f.oneDayPriceChange) ?? 0),
    volume: num(event.volume) ?? 0,
    closed: !!event.closed || (!!f.closed && !!l.closed),
    token: list(f.clobTokenIds)[0] ?? null,
  };
}

/** Histórico de preços do CLOB: pares [instante em ms, percentagem]. */
export function parseHistory(json) {
  const h = json?.history;
  if (!Array.isArray(h)) throw new Error('Polymarket: histórico inválido');
  return h
    .map((p) => [num(p.t) * 1000, 100 * num(p.p)])
    .filter(([t, p]) => Number.isFinite(t) && Number.isFinite(p) && p >= 0 && p <= 100)
    .sort((a, b) => a[0] - b[0]);
}

export const historyUrl = (token, interval, fidelity) =>
  `${HISTORY_URL}?market=${encodeURIComponent(token)}&interval=${interval}&fidelity=${fidelity}`;

/** Reduz uma série a no máximo `max` pontos (mantendo sempre o primeiro e o último), para a página ficar leve. */
export function thin(points, max) {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}

async function getJson(url, fetchImpl, timeoutMs) {
  const r = await fetchImpl(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) {
    await r.body?.cancel();
    throw new Error('Polymarket: HTTP ' + r.status);
  }
  return r.json();
}

/**
 * Atualiza o mercado guardado, se já for altura. Só um pedido de cada vez (a reserva é feita na base).
 * Falhas não apagam a última leitura boa: a página continua a mostrá-la, com a hora.
 */
export async function refreshMarket(store, { fetchImpl = fetch, now = Date.now, active = false, timeoutMs = 6_000 } = {}) {
  const interval = active ? MARKET_INTERVALS.active : MARKET_INTERVALS.idle;
  const t = now();
  if (!(await store.claimMarket(t, interval))) return { skipped: true };
  const row = await store.market();
  try {
    const current = parseEvent(await getJson(EVENT_URL, fetchImpl, timeoutMs));
    // Últimas 24 h: de 2 em 2 minutos na noite eleitoral, de 10 em 10 fora dela.
    let recent = [];
    let campaign = null;
    if (current.token) {
      recent = parseHistory(await getJson(historyUrl(current.token, '1d', active ? 2 : 10), fetchImpl, timeoutMs));
      if (!row?.campaign || t - (row.campaign_at ?? 0) >= MARKET_INTERVALS.campaign) {
        campaign = parseHistory(await getJson(historyUrl(current.token, 'max', 1440), fetchImpl, timeoutMs));
      }
    }
    await store.saveMarket({ current, recent, campaign }, now());
    return { ok: true };
  } catch (e) {
    await store.marketFailure(e.message);
    return { error: e.message };
  }
}

/** Fecho das urnas da 1.ª volta (4/10/2026, 17h de Brasília). */
export const ROUND1_CLOSE = Date.parse('2026-10-04T17:00:00-03:00');
/** A vista "Noite" começa duas horas antes do fecho das urnas da 2.ª volta. */
export const NIGHT_START = ROUND.pollsCloseAt - 2 * 3_600_000;

const before = (points, t) => {
  let found = null;
  for (const p of points) if (p[0] <= t) found = p;
  return found;
};

/** Marcos da campanha para comparar com o preço de agora (calculados sobre a série completa, antes de reduzida). */
export function marksOf(campaign, at) {
  const out = [];
  if (at > ROUND1_CLOSE) {
    const r1 = before(campaign, ROUND1_CLOSE);
    if (r1) out.push({ label: 'Antes da 1.ª volta', t: r1[0], p: r1[1] });
  }
  const week = before(campaign, at - 7 * 86_400_000);
  if (week) out.push({ label: 'Há 7 dias', t: week[0], p: week[1] });
  if (campaign.length) {
    const max = campaign.reduce((a, b) => (b[1] >= a[1] ? b : a));
    out.push({ label: 'Máximo', t: max[0], p: max[1] });
  }
  return out;
}

/** O que a página recebe: a última leitura boa, com as séries já reduzidas. */
export function marketView(row, now, active) {
  if (!row?.payload) return null;
  let current, recent, campaign;
  try {
    current = JSON.parse(row.payload);
    recent = row.recent ? JSON.parse(row.recent) : [];
    campaign = row.campaign ? JSON.parse(row.campaign) : [];
  } catch {
    return null;
  }
  const at = row.success_at ?? 0;
  // A linha da campanha acaba no preço atual (o último ponto diário pode ter horas).
  const tail = [at, current.flavio];
  const camp = campaign.length ? [...campaign.filter(([t]) => t < at), tail] : [];
  const day = [...recent.filter(([t]) => t < at), tail];
  const night = at > NIGHT_START ? day.filter(([t]) => t >= NIGHT_START) : [];
  return {
    flavio: current.flavio,
    lula: current.lula,
    change24h: current.change24h,
    volume: current.volume,
    closed: current.closed,
    at,
    stale: now - at > (active ? 10 * 60_000 : 3 * 3_600_000),
    error: row.error ?? null,
    recent: thin(day, 180),
    night: night.length >= 2 ? thin(night, 180) : [],
    campaign: thin(camp, 160),
    marks: marksOf(camp, at),
    nightStart: NIGHT_START,
  };
}
