// Gera data/turno1.json a partir dos ficheiros finais da 1.ª volta descarregados do TSE.
// Uso: node scripts/build-turno1.mjs <pasta-com-os-ficheiros-tse>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { UFS, candidatesOf, turnoutOf, officialTime, pct } from '../lib/tse.mjs';

const dir = process.argv[2] ?? '../../outputs/backup-turno1/tse';
const GOVERNOR_RUNOFF = ['AC', 'AM', 'DF', 'ES', 'RJ', 'RN', 'TO'];

function read(uf, cargo, ele) {
  const u = uf.toLowerCase();
  const file = join(dir, `${u}-c${String(cargo).padStart(4, '0')}-e${String(ele).padStart(6, '0')}-u.json`);
  const json = JSON.parse(readFileSync(file, 'utf8'));
  if (json.tf !== 's' || json.and !== 'f') throw new Error(`${file}: totalização não final`);
  const candidates = candidatesOf(json, cargo)
    .filter((c) => c.valid)
    .sort((a, b) => b.votes - a.votes)
    .map(({ valid, ...c }) => c);
  return {
    generatedAt: officialTime(json.dg, json.hg),
    pctSections: pct(json.s?.pst),
    turnout: turnoutOf(json),
    candidates,
  };
}

const president = { BR: read('BR', 1, 6257) };
for (const uf of UFS) president[uf] = read(uf, 1, 6257);

const governor = {};
for (const uf of GOVERNOR_RUNOFF) {
  const race = read(uf, 3, 6259);
  const finalists = race.candidates.filter((c) => /2[º°o]?\s*turno/i.test(c.st));
  if (finalists.length !== 2) throw new Error(`${uf}: esperava 2 finalistas, encontrei ${finalists.length}`);
  governor[uf] = race;
}

const finalistsBR = president.BR.candidates.filter((c) => /2[º°o]?\s*turno/i.test(c.st)).map((c) => c.number);
if (finalistsBR.sort().join() !== '13,22') throw new Error(`Finalistas inesperados: ${finalistsBR}`);

mkdirSync('data', { recursive: true });
writeFileSync(
  'data/turno1.json',
  JSON.stringify({ source: 'TSE, totalização final da 1.ª volta (eleições 6257 e 6259)', president, governor }),
);
console.log('data/turno1.json:', Object.keys(president).length, 'presidência;', Object.keys(governor).length, 'governadores');
