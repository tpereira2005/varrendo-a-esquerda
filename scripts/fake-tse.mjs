// Simulador local do TSE para ensaiar a noite da 2.ª volta.
// Uso: node scripts/fake-tse.mjs [--passo=20] [--final=lula] [--com-429] [--porta=8787]
// O site local tem de ter, em .dev.vars: COLLECTION_FORCE=1 e TSE_BASE=http://127.0.0.1:8787
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { round2File } from '../test/round2-files.mjs';
import { RACES } from '../lib/rounds.mjs';
import { CITIES } from '../lib/exterior.mjs';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const STEP_S = Number(arg('passo', 20));
const PORT = Number(arg('porta', 8787));
const LULA_WINS = arg('final', 'flavio') === 'lula';
const WITH_429 = process.argv.includes('--com-429');
const DIR = arg('origem', '../../outputs/backup-turno1/tse');
const STEPS = 30;

const started = Date.now();
const step = () => Math.min(STEPS, Math.floor((Date.now() - started) / (STEP_S * 1000)));

const source = (uf, cargo) => {
  const ele = cargo === 1 ? 6257 : 6259;
  const u = uf.toLowerCase();
  return JSON.parse(readFileSync(join(DIR, `${u}-c${String(cargo).padStart(4, '0')}-e${String(ele).padStart(6, '0')}-u.json`), 'utf8'));
};
const sources = new Map(RACES.map((r) => [r.key, source(r.uf, r.cargo)]));

// Cada estado começa com as quotas da 1.ª volta entre os dois finalistas e desloca-se ao longo da noite.
// Primeiro apuram-se os estados onde o Lula foi mais forte (o Flávio começa atrás e vira a meio).
const swing = LULA_WINS ? -0.03 : 0.025;
const states = RACES.filter((r) => r.cargo === 1 && r.uf !== 'BR');
const order = [...states].sort((x, y) => x.finalists[0].r1Votes / x.finalists[1].r1Votes - y.finalists[0].r1Votes / y.finalists[1].r1Votes);

function progress(race, s) {
  const i = order.findIndex((r) => r.uf === race.uf);
  const delay = i < 0 ? 0 : (i / order.length) * 0.35;
  return Math.max(0, Math.min(1, (s / STEPS - delay) / (1 - delay * 0.6)));
}

function stateVotes(race, s) {
  const [a, b] = race.finalists;
  const base = a.r1Votes / (a.r1Votes + b.r1Votes);
  const share = Math.max(0.05, Math.min(0.95, base + swing * (0.5 + s / STEPS)));
  const total = Math.round((a.r1Votes + b.r1Votes) * 1.04 * progress(race, s));
  return { a: Math.round(total * share), b: total - Math.round(total * share), pct: 100 * progress(race, s) };
}

function file(race, s) {
  const time = new Date(Date.parse('2026-10-25T20:00:00Z') + s * 5 * 60_000);
  let v;
  if (race.uf === 'BR') {
    const all = states.map((r) => stateVotes(r, s));
    const a = all.reduce((n, x) => n + x.a, 0);
    const b = all.reduce((n, x) => n + x.b, 0);
    const done = states.reduce((n, r) => n + progress(r, s) * r.r1.validos, 0) / states.reduce((n, r) => n + r.r1.validos, 0);
    v = { a, b, pct: 100 * done };
  } else v = stateVotes(race, s);
  const final = s >= STEPS;
  const winnerA = v.a > v.b;
  const st = final && (race.uf === 'BR' || race.cargo === 3) ? (winnerA ? ['Eleito', 'Não eleito'] : ['Não eleito', 'Eleito']) : undefined;
  return round2File(race.uf, race.cargo, {
    source: sources.get(race.key),
    numbers: race.finalists.map((f) => f.number),
    a: v.a, b: v.b, pct: final ? 100 : Math.min(99.99, v.pct), final, st, time,
  });
}

const config = JSON.parse(readFileSync(join(DIR, 'ele-c.json'), 'utf8'));
config.pl.find((p) => p.c === 'ele2026').e.push({ cd: '6258', t: '2', nm: 'Simulação 2.º turno federal' }, { cd: '6260', t: '2', nm: 'Simulação 2.º turno estadual' });
// Estrangeiro: resumo (abrangências) e um ficheiro por cidade, a partir dos ficheiros da 1.ª volta.
const zz = RACES.find((r) => r.uf === 'ZZ');
const citySource = (cd) => JSON.parse(readFileSync(join(DIR, '..', 'exterior', 'cidades', `zz${cd}-c0001-e006257-u.json`), 'utf8'));
function cityVotes(cd, s) {
  const src = citySource(cd);
  const get = (n) => src.carg[0].agr.flatMap((a) => a.par.flatMap((p) => p.cand)).find((c) => c.n === n)?.vap ?? 0;
  const f = Number(get('22'));
  const l = Number(get('13'));
  const share = f + l ? Math.max(0.05, Math.min(0.95, f / (f + l) + swing)) : 0.5;
  const p = progress(zz, s);
  const total = Math.round((f + l) * 1.05 * p);
  return { src, a: Math.round(total * share), b: total - Math.round(total * share), pct: 100 * p };
}
function abFile(s) {
  const time = new Date(Date.parse('2026-10-25T20:00:00Z') + s * 5 * 60_000);
  const hh = new Date(time.getTime() - 3 * 3_600_000).toISOString().slice(11, 19);
  return {
    ele: '6258', t: '2', f: 'o', dg: '25/10/2026', hg: hh,
    abr: Object.keys(CITIES).map((cd) => ({
      tpabr: 'mun', cdabr: cd, dt: '25/10/2026', ht: hh,
      s: { st: String(Math.round(progress(zz, s) * 10)), pst: (100 * progress(zz, s)).toFixed(2).replace('.', ',') },
    })),
  };
}

let blocked = false;

createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.endsWith('/config/ele-c.json')) return send(res, config);
  if (url.pathname.endsWith('/dados/zz/zz-e006258-ab.json')) return send(res, abFile(step()));
  const c = url.pathname.match(/\/dados\/zz\/zz(\d+)-c0001-e006258-u\.json$/);
  if (c && CITIES[c[1]]) {
    const s = step();
    const v = cityVotes(c[1], s);
    const time = new Date(Date.parse('2026-10-25T20:00:00Z') + s * 5 * 60_000);
    return send(res, round2File(c[1], 1, { source: v.src, numbers: ['22', '13'], a: v.a, b: v.b, pct: s >= STEPS ? 100 : v.pct, final: s >= STEPS, time }));
  }
  const m = url.pathname.match(/^\/oficial\/ele2026\/(\d+)\/dados\/([a-z]{2})\/[a-z]{2}-c(\d{4})-e\d{6}-u\.json$/);
  const race = m && RACES.find((r) => r.uf === m[2].toUpperCase() && r.cargo === Number(m[3]));
  if (!race) return send(res, { erro: 'não encontrado' }, 404);
  const s = step();
  if (WITH_429 && !blocked && s === 5 && race.uf === 'BR') {
    blocked = true;
    res.writeHead(429, { 'retry-after': '30' });
    return res.end();
  }
  if (s === 0 && race.uf !== 'BR') return send(res, { erro: 'ainda não publicado' }, 404);
  send(res, file(race, s));
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Simulador TSE em http://127.0.0.1:${PORT} · nova geração a cada ${STEP_S}s · ${STEPS} passos · final: ${LULA_WINS ? 'Lula' : 'Flávio'}`);
});

function send(res, body, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}
