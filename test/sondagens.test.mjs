import test from 'node:test';
import assert from 'node:assert/strict';
import { recentesPorInstituto } from '../lib/sondagens.mjs';
import { readFileSync } from 'node:fs';

test('institutos com acentos e grafias diferentes contam uma vez; datas futuras e antigas ficam fora', () => {
  const p = (instituto, fim, quota) => ({ instituto, fim, quota });
  const out = recentesPorInstituto([p('Veritá', '2026-10-19', 52), p('Verita', '2026-10-22', 51), p('DataTrends', '2026-10-20', 50), p('Datatrends', '2026-10-21', 51), p('Antiga', '2026-10-10', 50), p('Futura', '2026-10-25', 50)], 7, Date.parse('2026-10-24T12:00Z'));
  assert.equal(out.length, 2);
  assert.equal(out[0].quota, 51);
  assert.throws(() => recentesPorInstituto([], 7));
});

test('base conferida: um instituto por entrada, ficha e fontes completas; conversões explícitas corretas', () => {
  const polls = JSON.parse(readFileSync(new URL('../data/sondagens-verificadas.json', import.meta.url)));
  const selected = recentesPorInstituto(polls, 7, Date.parse('2026-10-24T12:00Z'));
  assert.equal(selected.length, polls.length);
  for (const p of selected) {
    assert.match(p.fonte, /^https:\/\//);
    assert.match(p.registro, /^BR-\d{5}\/2026$/);
    assert.ok(p.amostra > 0 && p.periodo && p.publicado && p.tipoFonte);
    assert.ok(Math.abs(p.quota + p.lula - 100) < 1e-8);
    if (p.base === 'convertidos-de-totais') {
      assert.ok(Math.abs(p.quota - 100 * p.totais.flavio / (p.totais.flavio + p.totais.lula)) < 1e-8);
      assert.ok(p.nota);
    }
  }
});
