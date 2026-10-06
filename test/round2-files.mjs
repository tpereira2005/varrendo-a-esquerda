// Gera ficheiros da 2.ª volta com o formato real do TSE, a partir dos ficheiros finais da 1.ª volta.
// Usado pelos testes e pelo simulador local (scripts/fake-tse.mjs).
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const fixture = (name) => JSON.parse(readFileSync(new URL(`fixtures/${name}.json`, import.meta.url), 'utf8'));
const pt = (n, d = 2) => n.toFixed(d).replace('.', ',');

/**
 * @param {string} uf  'BR' ou sigla do estado
 * @param {number} cargo 1 (Presidente) ou 3 (Governador)
 * @param {{pct?:number, a?:number, b?:number, ele?:number, t?:number, final?:boolean, st?:[string,string],
 *          numbers?:[string,string], time?:Date, extra?:boolean, source?:object}} o  a = votos do 1.º finalista (Flávio), b = do 2.º
 */
export function round2File(uf, cargo, o = {}) {
  const source = o.source ?? (cargo === 3 ? fixture('t1-RJ-3') : uf === 'BR' ? fixture('t1-BR-1') : fixture('t1-SP-1'));
  const base = structuredClone(source);
  const time = o.time ?? new Date('2026-10-25T21:00:00Z');
  const brt = new Date(time.getTime() - 3 * 3_600_000);
  const dg = `${String(brt.getUTCDate()).padStart(2, '0')}/${String(brt.getUTCMonth() + 1).padStart(2, '0')}/${brt.getUTCFullYear()}`;
  const hg = brt.toISOString().slice(11, 19);
  const numbers = o.numbers ?? (cargo === 3 ? ['22', '55'] : ['22', '13']);
  const a = o.a ?? 0;
  const b = o.b ?? 0;
  const total = a + b;
  Object.assign(base, {
    ele: String(o.ele ?? (cargo === 1 ? 6258 : 6260)),
    t: String(o.t ?? 2),
    cdabr: uf.toLowerCase(),
    dg, hg, dt: dg, ht: hg,
    tf: o.final ? 's' : 'n',
    and: o.final ? 'f' : 'p',
    esae: 'n',
  });
  base.s.pst = pt(o.pct ?? 0);
  base.v.vvc = String(total);
  const node = base.carg.find((c) => Number(c.cd) === cargo);
  let extra = o.extra ? 1 : 0;
  for (const agr of node.agr) {
    for (const par of agr.par) {
      par.cand = par.cand.filter((c) => numbers.includes(String(c.n)) || (extra > 0 && extra--));
      for (const c of par.cand) {
        const i = numbers.indexOf(String(c.n));
        const v = i === 0 ? a : i === 1 ? b : 1;
        c.vap = String(v);
        c.pvap = pt(total ? (100 * v) / total : 0);
        c.st = o.st?.[i] ?? '';
        c.e = c.st === 'Eleito' ? 's' : 'n';
      }
    }
  }
  return base;
}

/** Base SQLite em memória com todas as migrações, com a mesma interface que o D1. */
export function database() {
  const db = new DatabaseSync(':memory:');
  const journal = JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
  for (const { tag } of journal.entries) {
    db.exec(readFileSync(new URL(`../drizzle/${tag}.sql`, import.meta.url), 'utf8').replaceAll('--> statement-breakpoint', ''));
  }
  const wrap = (sql, args = []) => ({
    bind: (...a) => wrap(sql, a),
    async first() {
      return db.prepare(sql).get(...args) ?? null;
    },
    async all() {
      return { results: db.prepare(sql).all(...args) };
    },
    async run() {
      return { meta: { changes: Number(db.prepare(sql).run(...args).changes) } };
    },
    runSync() {
      return { meta: { changes: Number(db.prepare(sql).run(...args).changes) } };
    },
  });
  return {
    raw: db,
    prepare: wrap,
    async batch(statements) {
      db.exec('BEGIN');
      try {
        const out = statements.map((s) => s.runSync());
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
