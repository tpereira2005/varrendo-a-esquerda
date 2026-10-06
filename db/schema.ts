import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';

export const results = sqliteTable('results', {
  key: text('key').primaryKey(),
  uf: text('uf').notNull(),
  cargo: integer('cargo').notNull(),
  url: text('url').notNull(),
  body: text('body'),
  parsed: text('parsed'),
  summary: text('summary'),
  hash: text('hash'),
  etag: text('etag'),
  modified: text('modified'),
  generatedAt: integer('generated_at'),
  checkedAt: integer('checked_at').notNull().default(0),
  successAt: integer('success_at').notNull().default(0),
  error: text('error'),
  failures: integer('failures').notNull().default(0),
  retryAt: integer('retry_at').notNull().default(0),
  priorityUntil: integer('priority_until').notNull().default(0),
  turn: integer('turn').notNull().default(1),
});

export const revisions = sqliteTable('revisions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull(),
  hash: text('hash').notNull(),
  parsed: text('parsed').notNull(),
  at: integer('at').notNull(),
  turn: integer('turn').notNull().default(1),
});

export const notices = sqliteTable('notices', {
  id: text('id').primaryKey(),
  key: text('key').notNull(),
  payload: text('payload').notNull(),
  active: integer('active').notNull().default(1),
  at: integer('at').notNull(),
  correctedAt: integer('corrected_at'),
  turn: integer('turn').notNull().default(1),
});

export const collector = sqliteTable('collector', {
  id: integer('id').primaryKey(),
  owner: text('owner'),
  leaseUntil: integer('lease_until').notNull().default(0),
  cursor: integer('cursor').notNull().default(0),
  cycleStartedAt: integer('cycle_started_at').notNull().default(0),
  cycleFinishedAt: integer('cycle_finished_at').notNull().default(0),
  nextAt: integer('next_at').notNull().default(0),
  pauseUntil: integer('pause_until').notNull().default(0),
  lastError: text('last_error'),
});

/** Identificadores oficiais de cada volta, confirmados pela configuração do TSE. */
export const rounds = sqliteTable('rounds', {
  turn: integer('turn').primaryKey(),
  federal: integer('federal').notNull(),
  estadual: integer('estadual').notNull(),
  confirmedAt: integer('confirmed_at'),
  checkedAt: integer('checked_at').notNull().default(0),
});

/** Um ponto por cada nova geração oficial de um ficheiro: alimenta o gráfico e os avisos. */
export const timeline = sqliteTable(
  'timeline',
  {
    key: text('key').notNull(),
    generatedAt: integer('generated_at').notNull(),
    at: integer('at').notNull(),
    pctSections: real('pct_sections').notNull(),
    votesA: integer('votes_a').notNull(),
    votesB: integer('votes_b').notNull(),
  },
  (t) => [primaryKey({ columns: [t.key, t.generatedAt] })],
);
