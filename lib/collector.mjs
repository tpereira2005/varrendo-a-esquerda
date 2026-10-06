// Recolha dos ficheiros oficiais da 2.ª volta e montagem do estado apresentado na página.
import { ROUND, RACES, FLAVIO, LULA, jobsFor, round2FromConfig } from './rounds.mjs';
import { parseRunoff, toFlip, moodFor, leaderOf } from './runoff.mjs';
import { TSE_BASE, CONFIG_PATH, UFS } from './tse.mjs';
import { CITIES, PORTUGAL, abUrl, cityUrl, parseAb, parseCity, byCountry } from './exterior.mjs';
import exteriorR1 from '../data/exterior-turno1.json' with { type: 'json' };

/**
 * Ritmo da recolha:
 * - nacional a cada 10 s (pedido condicional: se nada mudou, o TSE responde 304 sem conteúdo);
 * - quando o ficheiro nacional muda (nova geração do TSE), todos os outros ficam logo pendentes;
 * - sem mudanças, o estado escolhido é verificado a cada 20 s e os restantes a cada 60 s;
 * - um ficheiro com totalização final continua a ser verificado a cada 10 min, para receber correções.
 */

/** Fim da janela de recolha: 3 dias depois do fecho das urnas (depois disso, só com COLLECTION_FORCE). */
export const WINDOW_END = ROUND.pollsCloseAt + 3 * 86_400_000;
export const INTERVALS = { national: 10_000, priority: 20_000, normal: 60_000, exterior: 30_000, final: 600_000, config: 600_000 };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Até quando parar tudo depois de um 403/429 do TSE (pelo menos 10 minutos, ou o Retry-After). */
function blockedUntil(e, now) {
  if (e.status !== 403 && e.status !== 429) return 0;
  const h = e.retryAfter;
  const requested = /^\d+$/.test(h ?? '') ? Number(h) * 1000 : Math.max(0, Date.parse(h ?? '') - now);
  return now + Math.max(600_000, requested || 0);
}

/**
 * Estrangeiro por cidade: lê o resumo (1 pedido, no máximo a cada 45 s) e só pede os ficheiros
 * das cidades com votos novos — Portugal primeiro.
 */
export async function collectExterior(store, { fetchImpl, now, base, ids, timeoutMs, limit = 8, nationalChangedAt = 0, deadline = Infinity }) {
  const ele = ids.federal;
  const turn = ROUND.turn;
  const cycle = ROUND.cycle;
  let processed = 0;
  let error = null;
  let pause = 0;
  const call = async (url) => {
    const r = await fetchImpl(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) {
      await r.body?.cancel();
      const e = new Error('TSE: HTTP ' + r.status);
      e.status = r.status;
      e.retryAfter = r.headers.get('retry-after');
      throw e;
    }
    return r.json();
  };
  // Cada série de pedidos só começa se houver tempo para acabar antes do fim do lote (ver collectStep).
  if (now() > deadline) return { processed, error, pause };
  let rows = await store.exteriorRows();
  const ab = rows.find((r) => r.cd === 'ab');
  if (!ab || now() - ab.checked_at >= INTERVALS.exterior || ab.checked_at < nationalChangedAt) {
    processed++;
    try {
      const stamps = parseAb(await call(abUrl({ base, cycle, ele })), { ele, turn });
      // Cidades ainda sem secções apuradas não têm nada para ler.
      const counted = Object.fromEntries(Object.entries(stamps).filter(([, s]) => s.pctSections > 0));
      await store.exteriorSummary(counted, now());
      rows = await store.exteriorRows();
    } catch (e) {
      pause = blockedUntil(e, now());
      await store.exteriorFailure('ab', e.message, now());
      return { processed, error: 'Estrangeiro: ' + e.message, pause };
    }
  }
  const pt = (r) => Number(CITIES[r.cd]?.pais === PORTUGAL);
  const pending = rows
    .filter((r) => r.cd !== 'ab' && r.want && r.want !== r.stamp && (!r.error || now() - r.checked_at >= 60_000))
    .sort((a, b) => pt(b) - pt(a))
    .slice(0, limit);
  for (let i = 0; i < pending.length && !pause && now() <= deadline; i += 4) {
    await Promise.all(
      pending.slice(i, i + 4).map(async (r) => {
        processed++;
        try {
          const parsed = parseCity(await call(cityUrl({ base, cycle, ele, cd: r.cd })), { ele, turn, cd: r.cd });
          await store.exteriorCity(r.cd, r.want, parsed, now());
        } catch (e) {
          error = `Estrangeiro ${CITIES[r.cd]?.cidade ?? r.cd}: ${e.message}`;
          pause = Math.max(pause, blockedUntil(e, now()));
          await store.exteriorFailure(r.cd, e.message, now());
        }
      }),
    );
  }
  return { processed, error, pause };
}

/** Identificadores em uso: os confirmados na base, ou os esperados até haver confirmação. */
export async function currentIds(store) {
  const row = await store.round();
  return row ? { federal: row.federal, estadual: row.estadual, confirmedAt: row.confirmed_at } : { ...ROUND.expected, confirmedAt: null };
}

/**
 * A recolha corre desde as 16h30 de Brasília do dia da eleição até 3 dias depois do fecho das urnas.
 * Depois da totalização final o ritmo é lento (correções do TSE); para parar de vez, usar COLLECTION_PAUSED.
 */
export function isActive(now, rows, force = false) {
  if (force) return true;
  return now >= ROUND.opensAt && now < WINDOW_END;
}

/** `nationalChangedAt`: quando foi detetada a última mudança do ficheiro nacional. */
export function collectionPlan(jobs, rows, now, nationalChangedAt = 0) {
  const stored = new Map(rows.map((r) => [r.key, r]));
  const plan = jobs.map((job, index) => {
    const row = stored.get(job.key);
    const final = row?.parsed ? JSON.parse(row.parsed).final : false;
    const national = job.uf === 'BR';
    const priority = national || row?.priority_until > now;
    const interval = final ? INTERVALS.final : national ? INTERVALS.national : priority ? INTERVALS.priority : INTERVALS.normal;
    // Nova geração nacional (também uma correção depois da totalização): o ficheiro provavelmente também mudou.
    const stale = !national && row?.checked_at && row.checked_at < nationalChangedAt;
    const nextAt = Math.max(stale ? 0 : row?.checked_at ? row.checked_at + interval : 0, row?.retry_at ?? 0);
    return { job, index, priority, nextAt };
  });
  const due = plan
    .filter((p) => p.nextAt <= now)
    .sort((a, b) => Number(b.priority) - Number(a.priority) || a.nextAt - b.nextAt || a.index - b.index);
  return { due, nextAt: Math.min(...plan.map((p) => p.nextAt)) };
}

/**
 * Confirma na configuração do TSE os identificadores da 2.ª volta (no máximo a cada 10 minutos).
 * Devolve até quando parar tudo se o TSE responder 403/429 (0 sem bloqueio).
 * Qualquer tentativa, mesmo falhada, fica registada para não se repetir a cada lote.
 */
async function refreshConfig(store, { fetchImpl, now, base, timeoutMs }) {
  const row = await store.round();
  if (row && now() - row.checked_at < INTERVALS.config) return 0;
  const attempted = () => (row ? store.roundChecked(now()) : store.saveRound({ ...ROUND.expected, confirmed: false }, now()));
  try {
    const r = await fetchImpl(base + CONFIG_PATH, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) {
      await r.body?.cancel();
      const e = new Error('HTTP ' + r.status);
      e.status = r.status;
      e.retryAfter = r.headers.get('retry-after');
      throw e;
    }
    const found = round2FromConfig(await r.json());
    if (found) await store.saveRound({ federal: found.federal, estadual: found.estadual, confirmed: found.published }, now());
    else await attempted();
    return 0;
  } catch (e) {
    console.error('Configuração TSE:', e.message);
    await attempted();
    return blockedUntil(e, now());
  }
}

export async function collectStep(
  store,
  {
    fetchImpl = fetch,
    now = Date.now,
    sleep = wait,
    limit = 8,
    foreground = false,
    budgetMs = 20_000,
    timeoutMs = 8_000,
    paused = false,
    force = false,
    base = TSE_BASE,
  } = {},
) {
  if (paused) return { paused: true, processed: 0 };
  const owner = crypto.randomUUID();
  const started = now();
  if (!isActive(started, await store.queue(), force)) return { inactive: true, processed: 0 };
  if (!(await store.lock(owner, started, 30_000, foreground))) return { busy: true, ...(await store.state()) };

  const state = await store.state();
  let processed = 0;
  let pause = 0;
  let lastError = null;
  // Uma série de pedidos só começa se ainda puder acabar dentro do orçamento (um tempo limite de folga):
  // o lote termina sempre antes de a concessão de 30 s expirar e dentro do tempo permitido ao waitUntil.
  const deadline = started + budgetMs - timeoutMs;
  try {
    pause = await refreshConfig(store, { fetchImpl, now, base, timeoutMs });
    if (pause) lastError = 'Configuração TSE: bloqueio (403/429)';
    const ids = await currentIds(store);
    const jobs = jobsFor(ids, base);
    let nationalChangedAt = await store.lastChange(jobs[0].key);
    const targets = pause ? [] : collectionPlan(jobs, await store.queue(), started, nationalChangedAt).due.slice(0, limit).map((p) => p.job);

    async function collect(job) {
      const old = await store.get(job.key);
      processed++;
      try {
        const headers = { accept: 'application/json' };
        // Os cabeçalhos condicionais só valem para o mesmo endereço (os IDs podem mudar).
        if (old?.url === job.url && old?.etag) headers['if-none-match'] = old.etag;
        if (old?.url === job.url && old?.modified) headers['if-modified-since'] = old.modified;
        const response = await fetchImpl(job.url, { headers, signal: AbortSignal.timeout(timeoutMs) });
        if (response.status === 304 && old?.parsed) {
          await store.unchanged(job, now());
          return;
        }
        if (!response.ok) {
          await response.body?.cancel();
          const err = new Error('TSE: HTTP ' + response.status);
          err.status = response.status;
          err.retryAfter = response.headers.get('retry-after');
          throw err;
        }
        const json = await response.json();
        const parsed = parseRunoff(json, job);
        if (old?.generated_at && parsed.generatedAt && parsed.generatedAt < old.generated_at) {
          throw new Error('Revisão oficial anterior à última guardada');
        }
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(json)));
        const hash = Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, '0')).join('');
        await store.success(job, old, json, parsed, hash, response.headers, now());
      } catch (e) {
        lastError = `${job.uf}/${job.cargo}: ${e.message}`;
        // Ficheiro ainda não publicado: tentar de novo ao ritmo normal, sem castigo exponencial.
        const notYet = e.status === 404;
        const backoff = notYet ? INTERVALS.normal : Math.min(600_000, 60_000 * 2 ** Math.min(old?.failures ?? 0, 4));
        let retry = now() + backoff;
        const blocked = blockedUntil(e, now());
        if (blocked) {
          pause = Math.max(pause, blocked);
          retry = pause;
        }
        await store.failure(job, old, e.message, now(), retry);
      }
    }

    // O ficheiro nacional serve de sonda: um bloqueio pára o lote antes de pedidos em paralelo.
    // Se trouxer uma geração nova, os outros ficheiros entram já neste lote.
    if (targets[0]?.uf === 'BR' && now() <= deadline) {
      await collect(targets.shift());
      const changed = await store.lastChange(jobs[0].key);
      if (changed > nationalChangedAt) {
        nationalChangedAt = changed;
        const queued = new Set(targets.map((j) => j.key));
        for (const p of collectionPlan(jobs, await store.queue(), now(), nationalChangedAt).due) {
          if (p.job.uf !== 'BR' && !queued.has(p.job.key) && targets.length + 1 < limit) targets.push(p.job); // +1: o nacional já pedido
        }
      }
    }
    while (targets.length && !pause && now() <= deadline) {
      if (processed) await sleep(150);
      await Promise.all(targets.splice(0, 4).map(collect));
    }

    // Estrangeiro por cidade, com o tempo que sobrar e se o TSE não tiver pedido pausa.
    if (!pause && now() <= deadline) {
      const ext = await collectExterior(store, { fetchImpl, now, base, ids, timeoutMs, limit: 8, nationalChangedAt, deadline });
      processed += ext.processed;
      if (ext.error) lastError = ext.error;
      if (ext.pause) pause = Math.max(pause, ext.pause);
    }

    const plan = collectionPlan(jobs, await store.queue(), now(), nationalChangedAt);
    const done = plan.due.length === 0;
    if (done && processed) await store.cleanup(now());
    await store.release(owner, {
      cursor: done ? 0 : jobs.length - plan.due.length,
      cycle_started_at: state.cursor ? state.cycle_started_at : started,
      cycle_finished_at: done ? now() : state.cycle_finished_at || 0,
      next_at: Math.max(plan.nextAt, pause),
      pause_until: pause,
      last_error: lastError,
    });
    return { processed, complete: done, ...(await store.state()) };
  } catch (e) {
    await store.release(owner, { last_error: e.message, next_at: now() + 60_000 });
    throw e;
  }
}

/** Estado completo da noite, pronto para a página. */
export async function snapshot(store, now = Date.now(), { paused = false, force = false } = {}) {
  const [rows, notices, collector, ids, cityRows] = await Promise.all([
    store.rows(),
    store.notices(),
    store.state(),
    currentIds(store),
    store.exteriorRows(),
  ]);
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const active = isActive(now, rows, force);

  const races = RACES.map((race) => {
    const row = byKey.get(race.key);
    let parsed = null;
    try {
      if (row?.parsed) parsed = JSON.parse(row.parsed);
    } catch {}
    const stale = !!row?.error || (!parsed?.final && active && !paused && (!row?.success_at || now - row.success_at > 180_000));
    return {
      key: race.key,
      uf: race.uf,
      cargo: race.cargo,
      internal: race.internal,
      finalists: race.finalists,
      r1: race.r1,
      parsed,
      meta: {
        generatedAt: row?.generated_at ?? null,
        checkedAt: row?.checked_at ?? null,
        successAt: row?.success_at ?? null,
        error: row?.error ?? null,
        stale,
      },
    };
  });

  const national = races[0];
  const states = races.filter((r) => r.cargo === 1 && UFS.includes(r.uf));
  const abroad = races.find((r) => r.uf === 'ZZ');
  const governors = races.filter((r) => r.cargo === 3);
  const p = national.parsed;

  const score = { flavio: 0, lula: 0, pending: 0 };
  for (const s of states) {
    const sp = s.parsed;
    if (sp && (sp.final || sp.pctSections >= 100)) {
      const lead = leaderOf(sp.cands[0].votes, sp.cands[1].votes);
      if (lead === 0) score.flavio++;
      else if (lead === 1) score.lula++;
      else score.pending++;
    } else score.pending++;
  }

  const flip = toFlip(p, [...states, abroad], national.r1.validos ?? 0);
  const anyVotes = races.some((r) => r.parsed && r.parsed.cands[0].votes + r.parsed.cands[1].votes > 0);
  const phase = p?.winner != null || p?.final ? 'encerrado' : anyVotes || now >= ROUND.pollsCloseAt ? 'apuramento' : 'antes';

  return {
    serverNow: now,
    phase,
    active,
    paused,
    ids,
    opensAt: ROUND.opensAt,
    pollsCloseAt: ROUND.pollsCloseAt,
    national,
    states,
    governors,
    exterior: exteriorView(abroad, cityRows),
    score,
    toFlip: flip,
    mood: moodFor(p, flip),
    timeline: await store.timeline(national.key),
    events: notices.filter((n) => n.active).map((n) => ({ ...JSON.parse(n.payload), noticedAt: n.at })),
    corrections: notices
      .filter((n) => !n.active && n.corrected_at)
      .map((n) => ({ ...JSON.parse(n.payload), noticedAt: n.corrected_at })),
    collector: {
      refreshedAt: collector.cycle_finished_at || 0,
      pauseUntil: collector.pause_until || 0,
      lastError: collector.last_error ?? null,
    },
  };
}

const R1_COUNTRIES = new Map(exteriorR1.countries.map((c) => [c.pais, c]));

/** Estrangeiro: total oficial (ficheiro ZZ) e detalhe por país e cidade, com a 1.ª volta para comparar. */
function exteriorView(race, cityRows) {
  const cities = {};
  let checkedAt = 0;
  for (const r of cityRows) {
    if (r.cd === 'ab') checkedAt = r.checked_at;
    else if (r.parsed) {
      try {
        cities[r.cd] = JSON.parse(r.parsed);
      } catch {}
    }
  }
  const countries = byCountry(cities, [FLAVIO, LULA]).map((c) => {
    const r1 = R1_COUNTRIES.get(c.pais);
    return {
      pais: c.pais,
      flavio: c.votes[FLAVIO],
      lula: c.votes[LULA],
      sections: c.sections,
      counted: c.counted,
      r1: r1 ? { flavio: r1.votes[FLAVIO] ?? 0, lula: r1.votes[LULA] ?? 0 } : null,
      cidades: c.cidades.map((x) => ({ cidade: x.cidade, flavio: x.votes[FLAVIO], lula: x.votes[LULA], pctSections: x.pctSections, has: x.has })),
    };
  });
  // Portugal primeiro; depois por votos já contados e, enquanto não houver, pela dimensão na 1.ª volta.
  const size = (c) => [c.flavio + c.lula, c.r1 ? c.r1.flavio + c.r1.lula : 0];
  countries.sort((x, y) => {
    const [vx, rx] = size(x);
    const [vy, ry] = size(y);
    return Number(y.pais === PORTUGAL) - Number(x.pais === PORTUGAL) || vy - vx || ry - rx;
  });
  return { race, countries, checkedAt };
}
