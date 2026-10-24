import test from 'node:test';
import assert from 'node:assert/strict';
import { recentesPorInstituto } from '../lib/sondagens.mjs';

test('institutos com acentos e grafias diferentes contam uma vez; datas futuras e antigas ficam fora', () => {
  const p = (instituto, fim, quota) => ({ instituto, fim, quota });
  const out = recentesPorInstituto([p('Veritá', '2026-10-19', 52), p('Verita', '2026-10-22', 51), p('DataTrends', '2026-10-20', 50), p('Datatrends', '2026-10-21', 51), p('Antiga', '2026-10-10', 50), p('Futura', '2026-10-25', 50)], 7, Date.parse('2026-10-24T12:00Z'));
  assert.equal(out.length, 2);
  assert.equal(out[0].quota, 51);
  assert.throws(() => recentesPorInstituto([], 7));
});
