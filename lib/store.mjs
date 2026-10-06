// Acesso à base D1 da 2.ª volta. Os dados da 1.ª volta (turn = 1) ficam intocados.
import { ROUND, raceByKey } from './rounds.mjs';
import { eventsFor } from './runoff.mjs';

const TURN = ROUND.turn;
const NOTICE_RETENTION_MS = 90 * 86_400_000;

export class D1Store {
  constructor(db) {
    this.db = db;
  }

  // ---- concessão (uma recolha de cada vez) ----

  async state() {
    const row = await this.db.prepare('SELECT * FROM collector WHERE id=1').first();
    return row ?? { cursor: 0, next_at: 0, pause_until: 0, lease_until: 0, cycle_finished_at: 0, last_error: null };
  }

  async lock(owner, now, leaseMs = 30_000, foreground = false) {
    await this.db.prepare('INSERT OR IGNORE INTO collector(id) VALUES(1)').run();
    const r = await this.db
      .prepare(
        'UPDATE collector SET owner=?, lease_until=? WHERE id=1 AND lease_until<=? AND pause_until<=? AND (?=1 OR next_at<=?)',
      )
      .bind(owner, now + leaseMs, now, now, foreground ? 1 : 0, now)
      .run();
    return r.meta.changes === 1;
  }

  async release(owner, values) {
    const names = Object.keys(values);
    await this.db
      .prepare(`UPDATE collector SET ${names.map((n) => `${n}=?`).join(', ')}, owner=NULL, lease_until=0 WHERE id=1 AND owner=?`)
      .bind(...names.map((n) => values[n]), owner)
      .run();
  }

  // ---- identificadores oficiais da volta ----

  async round() {
    return this.db.prepare('SELECT * FROM rounds WHERE turn=?').bind(TURN).first();
  }

  async saveRound({ federal, estadual, confirmed }, now) {
    await this.db
      .prepare(
        `INSERT INTO rounds(turn, federal, estadual, confirmed_at, checked_at) VALUES(?,?,?,?,?)
         ON CONFLICT(turn) DO UPDATE SET federal=excluded.federal, estadual=excluded.estadual,
           confirmed_at=COALESCE(rounds.confirmed_at, excluded.confirmed_at), checked_at=excluded.checked_at`,
      )
      .bind(TURN, federal, estadual, confirmed ? now : null, now)
      .run();
  }

  async roundChecked(now) {
    await this.db.prepare('UPDATE rounds SET checked_at=? WHERE turn=?').bind(now, TURN).run();
  }

  // ---- resultados ----

  async get(key) {
    return this.db.prepare('SELECT * FROM results WHERE key=?').bind(key).first();
  }

  async queue() {
    const r = await this.db
      .prepare('SELECT key, checked_at, retry_at, priority_until, parsed FROM results WHERE turn=?')
      .bind(TURN)
      .all();
    return r.results;
  }

  /** A disputa vista por um visitante é verificada mais vezes durante um minuto. */
  async prioritize(jobs, uf, now) {
    const wanted = jobs.filter((j) => j.uf === 'BR' || j.uf === uf);
    if (!wanted.some((j) => j.uf === uf) && uf !== 'BR') throw new Error('Estado inválido');
    await this.db.batch(
      wanted.map((j) =>
        this.db
          .prepare(
            `INSERT INTO results(key, uf, cargo, url, turn, priority_until) VALUES(?,?,?,?,?,?)
             ON CONFLICT(key) DO UPDATE SET priority_until=excluded.priority_until WHERE results.priority_until<?`,
          )
          .bind(j.key, j.uf, j.cargo, j.url, TURN, now + 60_000, now + 30_000),
      ),
    );
  }

  async failure(job, old, error, now, retryAt) {
    await this.db
      .prepare(
        `INSERT INTO results(key, uf, cargo, url, turn, checked_at, error, failures, retry_at) VALUES(?,?,?,?,?,?,?,?,?)
         ON CONFLICT(key) DO UPDATE SET url=excluded.url, checked_at=excluded.checked_at, error=excluded.error,
           failures=excluded.failures, retry_at=excluded.retry_at`,
      )
      .bind(job.key, job.uf, job.cargo, job.url, TURN, now, error, (old?.failures ?? 0) + 1, retryAt)
      .run();
  }

  async unchanged(job, now) {
    await this.db
      .prepare('UPDATE results SET checked_at=?, success_at=?, error=NULL, failures=0, retry_at=0 WHERE key=?')
      .bind(now, now, job.key)
      .run();
  }

  async success(job, old, json, parsed, hash, headers, now) {
    const body = JSON.stringify(json);
    const value = JSON.stringify(parsed);
    const changed = old?.hash !== hash;
    const statements = [
      this.db
        .prepare(
          `INSERT INTO results(key, uf, cargo, url, turn, body, parsed, hash, etag, modified, generated_at,
             checked_at, success_at, error, failures, retry_at)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,0,0)
           ON CONFLICT(key) DO UPDATE SET url=excluded.url, body=excluded.body, parsed=excluded.parsed,
             hash=excluded.hash, etag=excluded.etag, modified=excluded.modified, generated_at=excluded.generated_at,
             checked_at=excluded.checked_at, success_at=excluded.success_at, error=NULL, failures=0, retry_at=0`,
        )
        .bind(job.key, job.uf, job.cargo, job.url, TURN, body.length < 900_000 ? body : null, value, hash,
          headers.get('etag'), headers.get('last-modified'), parsed.generatedAt, now, now),
    ];
    if (changed) {
      statements.push(
        this.db.prepare('INSERT INTO revisions(key, hash, parsed, at, turn) VALUES(?,?,?,?,?)').bind(job.key, hash, value, now, TURN),
      );
      if (parsed.generatedAt != null) {
        const [a, b] = parsed.cands;
        statements.push(
          this.db
            .prepare(
              `INSERT INTO timeline(key, generated_at, at, pct_sections, votes_a, votes_b) VALUES(?,?,?,?,?,?)
               ON CONFLICT(key, generated_at) DO UPDATE SET at=excluded.at, pct_sections=excluded.pct_sections,
                 votes_a=excluded.votes_a, votes_b=excluded.votes_b`,
            )
            .bind(job.key, parsed.generatedAt, now, parsed.pctSections, a.votes, b.votes),
        );
      }
    }
    await this.db.batch(statements);
    if (changed) await this.refreshNotices(job.key, parsed, now);
  }

  /** Recalcula os avisos da disputa; os que deixarem de existir ficam registados como correções. */
  async refreshNotices(key, parsed, now) {
    const race = raceByKey.get(key);
    const events = eventsFor(race, parsed, await this.timeline(key));
    const ids = events.map((e) => e.id);
    const statements = [
      this.db
        .prepare(
          `UPDATE notices SET active=0, corrected_at=? WHERE key=? AND turn=? AND active=1${
            ids.length ? ` AND id NOT IN (${ids.map(() => '?').join(',')})` : ''
          }`,
        )
        .bind(now, key, TURN, ...ids),
    ];
    for (const e of events) {
      statements.push(
        this.db
          .prepare(
            `INSERT INTO notices(id, key, payload, active, at, corrected_at, turn) VALUES(?,?,?,1,?,NULL,?)
             ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, active=1,
               at=CASE WHEN notices.active=0 THEN excluded.at ELSE notices.at END, corrected_at=NULL`,
          )
          .bind(e.id, key, JSON.stringify(e), now, TURN),
      );
    }
    await this.db.batch(statements);
  }

  /** Quando foi detetada a última mudança de um ficheiro (0 se nunca). */
  async lastChange(key) {
    const r = await this.db.prepare('SELECT MAX(at) AS at FROM timeline WHERE key=?').bind(key).first();
    return r?.at ?? 0;
  }

  async timeline(key) {
    const r = await this.db
      .prepare(
        'SELECT generated_at AS generatedAt, pct_sections AS pctSections, votes_a AS votesA, votes_b AS votesB FROM timeline WHERE key=? ORDER BY generated_at',
      )
      .bind(key)
      .all();
    return r.results;
  }

  /** Só os avisos inativos antigos são apagados; revisões e linha temporal ficam guardadas. */
  async cleanup(now) {
    await this.db.prepare('DELETE FROM notices WHERE active=0 AND corrected_at<?').bind(now - NOTICE_RETENTION_MS).run();
  }

  async rows() {
    const r = await this.db
      .prepare(
        'SELECT key, uf, cargo, parsed, generated_at, checked_at, success_at, error, retry_at, priority_until FROM results WHERE turn=?',
      )
      .bind(TURN)
      .all();
    return r.results;
  }

  // ---- estrangeiro, por cidade ----

  async exteriorRows() {
    const r = await this.db.prepare('SELECT cd, want, stamp, parsed, checked_at, error FROM exterior WHERE turn=?').bind(TURN).all();
    return r.results;
  }

  /** Guarda a leitura do resumo: cada cidade com versão nova fica marcada para recolher (`want`). */
  async exteriorSummary(stamps, now) {
    const statements = [
      this.db
        .prepare(`INSERT INTO exterior(turn, cd, checked_at) VALUES(?, 'ab', ?) ON CONFLICT(turn, cd) DO UPDATE SET checked_at=excluded.checked_at, error=NULL`)
        .bind(TURN, now),
    ];
    for (const [cd, s] of Object.entries(stamps)) {
      statements.push(
        this.db
          .prepare('INSERT INTO exterior(turn, cd, want) VALUES(?,?,?) ON CONFLICT(turn, cd) DO UPDATE SET want=excluded.want')
          .bind(TURN, cd, s.stamp),
      );
    }
    await this.db.batch(statements);
  }

  async exteriorCity(cd, stamp, parsed, now) {
    await this.db
      .prepare('UPDATE exterior SET stamp=?, parsed=?, checked_at=?, error=NULL WHERE turn=? AND cd=?')
      .bind(stamp, JSON.stringify(parsed), now, TURN, cd)
      .run();
  }

  async exteriorFailure(cd, error, now) {
    await this.db
      .prepare(`INSERT INTO exterior(turn, cd, checked_at, error) VALUES(?,?,?,?) ON CONFLICT(turn, cd) DO UPDATE SET checked_at=excluded.checked_at, error=excluded.error`)
      .bind(TURN, cd, now, error)
      .run();
  }

  // ---- avisos da projeção (chave própria: nunca são "corrigidos" pelos ficheiros oficiais) ----

  async addNotice(event, now) {
    await this.db
      .prepare('INSERT OR IGNORE INTO notices(id, key, payload, active, at, corrected_at, turn) VALUES(?,?,?,1,?,NULL,?)')
      .bind(event.id, event.key, JSON.stringify(event), now, TURN)
      .run();
  }

  // ---- notificações (Web Push) ----

  async pushSubscribe(sub, now) {
    const count = await this.db.prepare('SELECT COUNT(*) AS n FROM push_subs').first();
    if ((count?.n ?? 0) >= 2000) throw new Error('Demasiadas subscrições');
    await this.db
      .prepare(
        `INSERT INTO push_subs(endpoint, p256dh, auth, created_at) VALUES(?,?,?,?)
         ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh, auth=excluded.auth, failures=0`,
      )
      .bind(sub.endpoint, sub.keys.p256dh, sub.keys.auth, now)
      .run();
  }

  async pushUnsubscribe(endpoint) {
    await this.db.prepare('DELETE FROM push_subs WHERE endpoint=?').bind(endpoint).run();
  }

  async pushSubs() {
    return (await this.db.prepare('SELECT endpoint, p256dh, auth, failures FROM push_subs').all()).results;
  }

  async pushResult(endpoint, ok, now) {
    if (ok) await this.db.prepare('UPDATE push_subs SET last_ok=?, failures=0 WHERE endpoint=?').bind(now, endpoint).run();
    else await this.db.prepare('UPDATE push_subs SET failures=failures+1 WHERE endpoint=?').bind(endpoint).run();
  }

  async pushLastOk(endpoint) {
    return (await this.db.prepare('SELECT last_ok FROM push_subs WHERE endpoint=?').bind(endpoint).first())?.last_ok ?? 0;
  }

  async pushCursor() {
    return (await this.db.prepare('SELECT last_at FROM push_state WHERE id=1').first())?.last_at ?? 0;
  }

  async setPushCursor(at) {
    await this.db
      .prepare('INSERT INTO push_state(id, last_at) VALUES(1, ?) ON CONFLICT(id) DO UPDATE SET last_at=excluded.last_at')
      .bind(at)
      .run();
  }

  /** Avisos ativos registados depois de `since`, do mais antigo para o mais recente. */
  async noticesSince(since) {
    const r = await this.db
      .prepare('SELECT payload, at FROM notices WHERE turn=? AND active=1 AND at>? ORDER BY at')
      .bind(TURN, since)
      .all();
    return r.results.map((n) => ({ ...JSON.parse(n.payload), noticedAt: n.at }));
  }

  async notices() {
    const r = await this.db
      .prepare('SELECT payload, at, corrected_at, active FROM notices WHERE turn=? ORDER BY at DESC LIMIT 300')
      .bind(TURN)
      .all();
    return r.results;
  }
}
