import type { Race } from '@/lib/types';
import { compact, int, pct, pp, shortName, titleCase, timeLisbon, ago } from './format';

/** Placar de um duelo: o 1.º finalista (Flávio na Presidência) fica sempre à esquerda. */
export function Duelo({ race, now, size = 'big' }: { race: Race; now: number; size?: 'big' | 'small' }) {
  const p = race.parsed;
  const [fa, fb] = race.finalists;
  const a = p?.cands[0] ?? { ...fa, votes: 0, pct: 0 };
  const b = p?.cands[1] ?? { ...fb, votes: 0, pct: 0 };
  const total = a.votes + b.votes;
  const share = total ? (100 * a.votes) / total : 50;
  // Duelo interno (mesmo agrupamento): cores neutras, sem "lado" a torcer.
  const colorA = race.internal ? 'navy' : 'flavio';
  const colorB = race.internal ? 'neutral' : 'lula';
  const big = size === 'big';
  const diff = a.votes - b.votes;
  const lead = diff > 0 ? a : diff < 0 ? b : null;

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        {[a, b].map((c, i) => (
          <div key={c.number} className={i ? 'text-right' : ''}>
            <div className={`font-bold ${big ? 'text-lg' : 'text-sm'} leading-tight`}>
              {race.cargo === 1 ? (i ? 'Lula' : 'Flávio Bolsonaro') : titleCase(c.name)}
            </div>
            <div className="hint">
              {c.party} · {c.number}
              {race.cargo === 3 && <span className="tag ml-1">{c.group}</span>}
            </div>
            <div
              className={big ? 'big mt-1' : 'text-2xl font-extrabold mt-1'}
              style={{ color: `var(--${i ? colorB : colorA})` }}
            >
              {p && total ? pct(c.pct, big ? 2 : 1) : '—'}
            </div>
            <div className="hint">{p ? `${int(c.votes)} votos` : `1.ª volta: ${pct(c.r1Pct, 2)}`}</div>
          </div>
        ))}
      </div>

      <div className="bar" role="img" aria-label={`${shortName(a, race.cargo)} ${pct(share)} · ${shortName(b, race.cargo)} ${pct(100 - share)}`}>
        <span style={{ width: `${share}%`, background: `var(--${colorA})` }} />
        <span style={{ width: `${100 - share}%`, background: `var(--${colorB})` }} />
      </div>

      {p && total > 0 ? (
        <div className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 ${big ? '' : 'text-sm'}`}>
          <strong className={lead ? (lead === a ? `c-${colorA}` : `c-${colorB}`) : ''}>
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
        <div className="hint">A aguardar os primeiros votos do TSE</div>
      )}

      {big && (
        <div className="hint flex flex-wrap justify-between gap-x-3">
          <span>Ficheiro TSE: {timeLisbon(race.meta.generatedAt, true)} (Lisboa)</span>
          <span>
            {p?.final
              ? 'Totalização final do TSE'
              : `Verificado ${ago(race.meta.successAt, now)}${race.meta.stale && race.meta.successAt ? ' · sem novos dados do TSE' : ''}`}
          </span>
        </div>
      )}
      {p?.warnings.map((w) => (
        <div key={w} className="hint">⚠ {w}</div>
      ))}
    </div>
  );
}
