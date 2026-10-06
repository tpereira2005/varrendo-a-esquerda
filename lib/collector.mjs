// Recolha dos ficheiros oficiais da 2.ª volta e montagem do estado apresentado na página.
import { ROUND, RACES, jobsFor, round2FromConfig } from './rounds.mjs';
import { parseRunoff, toFlip, moodFor, leaderOf } from './runoff.mjs';
import { TSE_BASE, CONFIG_PATH } from './tse.mjs';

export const INTERVALS = { priority: 15_000, normal: 45_000, config: 600_000 };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Identificadores em uso: os confirmados na base, ou os esperados até haver confirmação. */
export async function currentIds(store) {
  const row = await store.round();
  return row ? { federal: row.federal, estadual: row.estadual, confirmedAt: row.confirmed_at } : { ...ROUND.expected, confirmedAt: null };
}

/** A recolha só corre a partir das 16h30 de Brasília do dia da eleição e até todas as disputas fecharem. */
export function isActive(now, rows, force = false) {
  if (force) return true;
  if (now < ROUND.opensAt) return false;
  const done = new Set(rows.filter((r) => r.parsed && JSON.parse(r.parsed).final).map((r) => r.key));
  return RACES.some((r) => !done.has(r.key));
}

export function collectionPlan(jobs, rows, now) {
  const stored = new Map(rows.map((r) => [r.key, r]));
  const plan = jobs.map((job, index) => {
    const row = stored.get(job.key);
    const final = row?.parsed ? JSON.parse(row.parsed).final : false;
    const priority = job.uf === 'BR' || row?.priority_until > now;
    const interval = final ? Infinity : priority ? INTERVALS.priority : INTERVALS.normal;
    const nextAt = Math.max(row?.checked_at ? row.checked_at + interval : 0, row?.retry_at ?? 0);
    return { job, index, priority, nextAt };
  });
  const due = plan
    .filter((p) => p.nextAt <= now)
    .sort((a, b) => Number(b.priority) - Number(a.priority) || a.nextAt - b.nextAt || a.index - b.index);
  return { due, nextAt: Math.min(...plan.map((p) => p.nextAt)) };
}

/** Confirma na configuração do TSE os identificadores da 2.ª volta (no máximo a cada 10 minutos). */
async function refreshConfig(store, { fetchImpl, now, base, timeoutMs }) {
  const row = await store.round();
  if (row && now() - row.checked_at < INTERVALS.config) return;
  try {
    const r = await fetchImpl(base + CONFIG_PATH, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const found = round2FromConfig(await r.json());
    if (found) await store.saveRound({ federal: found.federal, estadual: found.estadual, confirmed: found.published }, now());
    else if (row) await store.roundChecked(now());
    else await store.saveRound({ ...ROUND.expected, confirmed: false }, now());
  } catch (e) {
    console.error('Configuração TSE:', e.message);
    if (row) await store.roundChecked(now());
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
  try {
    await refreshConfig(store, { fetchImpl, now, base, timeoutMs });
    const jobs = jobsFor(await currentIds(store), base);
    const targets = collectionPlan(jobs, await store.queue(), started).due.slice(0, limit).map((p) => p.job);

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
        if (e.status === 403 || e.status === 429) {
          const h = e.retryAfter;
          const requested = /^\d+$/.test(h ?? '') ? Number(h) * 1000 : Math.max(0, Date.parse(h ?? '') - now());
          pause = Math.max(pause, now() + Math.max(600_000, requested || 0));
          retry = pause;
        }
        await store.failure(job, old, e.message, now(), retry);
      }
    }

    // O ficheiro nacional serve de sonda: um bloqueio pára o lote antes de pedidos em paralelo.
    if (targets[0]?.uf === 'BR') await collect(targets.shift());
    while (targets.length && !pause && now() - started <= budgetMs - timeoutMs) {
      if (processed) await sleep(150);
      await Promise.all(targets.splice(0, 4).map(collect));
    }

    const plan = collectionPlan(jobs, await store.queue(), now());
    const done = plan.due.length === 0;
    if (done && processed) await store.cleanup(now());
    await store.release(owner, {
      cursor: done ? 0 : jobs.length - plan.due.length,
      cycle_started_at: state.cursor ? state.cycle_started_at : started,
      cycle_finished_at: done ? now() : state.cycle_finished_at || 0,
      next_at: Math.max(Number.isFinite(plan.nextAt) ? plan.nextAt : now() + INTERVALS.config, pause),
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
  const [rows, notices, collector, ids] = await Promise.all([store.rows(), store.notices(), store.state(), currentIds(store)]);
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const active = isActive(now, rows, force);

  const races = RACES.map((race) => {
    const row = byKey.get(race.key);
    let parsed = null;
    try {
      if (row?.parsed) parsed = JSON.parse(row.parsed);
    } catch {}
    const stale = !!row?.error || (active && !paused && (!row?.success_at || now - row.success_at > 180_000));
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
  const states = races.filter((r) => r.cargo === 1 && r.uf !== 'BR');
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

  const flip = toFlip(p, states);
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
