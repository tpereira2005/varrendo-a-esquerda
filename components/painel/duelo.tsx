'use client';
import type { Race } from '@/lib/types';
import { Numero } from './numero';
import { compact, int, pct, pp, shortName, titleCase } from './format';

/** Duelo compacto (estado ou governador): o 1.º finalista fica sempre à esquerda. */
export function Duelo({ race }: { race: Race }) {
  const p = race.parsed;
  const [fa, fb] = race.finalists;
  const a = p?.cands[0] ?? { ...fa, votes: 0, pct: 0 };
  const b = p?.cands[1] ?? { ...fb, votes: 0, pct: 0 };
  const total = a.votes + b.votes;
  // Sem votos: a barra mostra a 1.ª volta entre os dois finalistas, esbatida e tracejada.
  const share = total ? (100 * a.votes) / total : (100 * fa.r1Votes) / (fa.r1Votes + fb.r1Votes);
  // Duelo interno (mesmo agrupamento): cores neutras, sem "lado" a torcer.
  const colorA = race.internal ? 'navy' : 'flavio';
  const colorB = race.internal ? 'neutral' : 'lula';
  const diff = a.votes - b.votes;
  const lead = diff > 0 ? a : diff < 0 ? b : null;

  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-2 gap-3">
        {[a, b].map((c, i) => (
          <div key={c.number} className={i ? 'text-right' : ''}>
            <div className="font-semibold leading-tight">{race.cargo === 1 && c.number === '22' ? 'Flávio Bolsonaro' : race.cargo === 1 && c.number === '13' ? 'Lula' : titleCase(c.name)}</div>
            <div className="hint">
              {c.party} · {c.number}
              {race.cargo === 3 && <span className="tag ml-1">{c.group}</span>}
            </div>
            <div className="pct-medio" style={{ color: `var(--${i ? colorB === 'neutral' ? 'muted' : colorB : colorA})` }}>
              {p && total ? <Numero value={c.pct} format={(v) => pct(v, 1)} /> : <span className="fantasma" title="1.ª volta">{pct(c.r1Pct, 1)}</span>}
            </div>
            <div className="hint">{p && total ? <><Numero value={c.votes} format={(v) => int(Math.round(v))} /> votos</> : '1.ª volta (todos os candidatos)'}</div>
          </div>
        ))}
      </div>

      <div className={`barra-duelo fina ${total ? '' : 'referencia'}`} role="img" aria-label={`${shortName(a, race.cargo)} ${pct(share)} · ${shortName(b, race.cargo)} ${pct(100 - share)}`}>
        <span style={{ width: `${share}%`, background: `var(--${colorA})` }} />
        <span style={{ width: `${100 - share}%`, background: `var(--${colorB})` }} />
        <i className="meta-50" aria-hidden="true" />
      </div>

      {p && total > 0 ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
          <strong className={lead ? (lead === a ? `c-${colorA}` : `c-${colorB === 'neutral' ? 'muted' : colorB}`) : ''}>
            {p.winner != null
              ? `${shortName(p.cands[p.winner], race.cargo)} eleito pelo TSE`
              : p.final && lead
                ? `${shortName(lead, race.cargo)} venceu neste estado (${pp(Math.abs(a.pct - b.pct))})`
                : lead
                  ? `${shortName(lead, race.cargo)} à frente por ${compact(Math.abs(diff))} votos (${pp(Math.abs(a.pct - b.pct))})`
                  : 'Empate'}
          </strong>
          <span className="hint">{pct(p.pctSections, 2)} das secções</span>
        </div>
      ) : (
        <div className="hint">A aguardar os primeiros votos do TSE · barra: 1.ª volta entre os dois</div>
      )}
      {p?.warnings.map((w) => (
        <div key={w} className="hint">⚠ {w}</div>
      ))}
    </div>
  );
}
