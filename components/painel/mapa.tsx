import MAP from '@/lib/brazil-map.json';
import type { Race } from '@/lib/types';
import { pct } from './format';

type Shape = { n: string; d: string; c: number[] };
const SHAPES: Record<string, Shape> = MAP.s;
// Estados pequenos do litoral: rótulo menor para não se sobreporem.
const SMALL = new Set(['AL', 'SE', 'PB', 'RN', 'PE', 'ES', 'RJ', 'DF']);

/** Quem vai à frente em cada estado; contorno dourado quando o estado mudou de lado face à 1.ª volta. */
export function stateView(r: Race) {
  const p = r.parsed;
  const r1Lead = r.finalists[0].r1Votes > r.finalists[1].r1Votes ? 0 : 1;
  if (!p || p.cands[0].votes + p.cands[1].votes === 0) return { lead: null, margin: 0, flipped: false, r1Lead, counted: 0 };
  const [a, b] = p.cands;
  const lead = a.votes === b.votes ? null : a.votes > b.votes ? 0 : 1;
  return { lead, margin: Math.abs(a.pct - b.pct), flipped: lead != null && lead !== r1Lead, r1Lead, counted: p.pctSections };
}

/**
 * Camadas: (1) cores dos estados, (2) fronteiras finas iguais para todos, (3) contornos de destaque
 * desenhados só por dentro de cada estado (recortados pela própria forma), (4) siglas.
 * Assim um contorno nunca fica tapado pelo estado vizinho e tem sempre a mesma espessura.
 */
export function Mapa({ states, selected, onSelect }: { states: Race[]; selected: string; onSelect: (uf: string) => void }) {
  const views = states.map((r) => ({ r, s: SHAPES[r.uf], v: stateView(r) }));
  return (
    <figure>
      <svg viewBox="0 0 1000 971" className="mapa w-full h-auto max-h-[520px]" role="group" aria-label="Mapa: quem vai à frente em cada estado">
        <defs>
          {views.map(({ r, s }) => (
            <clipPath key={r.uf} id={`mapa-${r.uf}`}>
              <path d={s.d} />
            </clipPath>
          ))}
        </defs>
        {views.map(({ r, s, v }) => {
          // Mistura com o cinzento: a cor só fica plena com diferença grande (25 pp) E boa parte contada (40%).
          // Um estado com 2% apurado fica claro, mesmo com uma diferença enorme.
          const strength = Math.round(25 + 75 * Math.min(1, v.margin / 25) * Math.min(1, v.counted / 40));
          const base = v.lead === 0 ? 'var(--flavio)' : 'var(--lula)';
          const fill = v.lead == null ? 'var(--neutral)' : `color-mix(in srgb, ${base} ${strength}%, var(--neutral))`;
          const label = `${s.n}: ${v.lead == null ? 'sem votos' : `${v.lead === 0 ? 'Flávio' : 'Lula'} à frente por ${pct(v.margin)} pontos`}${v.flipped ? ', virou face à 1.ª volta' : ''}`;
          return (
            <g key={r.uf} role="button" tabIndex={0} aria-label={label} aria-pressed={selected === r.uf} className="estado"
              onClick={() => onSelect(r.uf)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(r.uf)}>
              <title>{label}</title>
              <path d={s.d} style={{ fill, transition: 'fill 0.8s ease' }} />
            </g>
          );
        })}
        <g className="fronteiras" aria-hidden="true">
          {views.map(({ r, s }) => (
            <path key={r.uf} d={s.d} />
          ))}
        </g>
        <g aria-hidden="true" pointerEvents="none">
          {views.map(({ r, s, v }) => (
            <g key={r.uf} clipPath={`url(#mapa-${r.uf})`}>
              {/* escolhido: faixa larga por dentro; virou: dourado junto à fronteira, por cima */}
              {selected === r.uf && <path d={s.d} className="contorno-escolhido" />}
              {v.flipped && <path d={s.d} className="contorno-virou" />}
            </g>
          ))}
          {views.map(({ r, s, v }) => (
            <text key={r.uf} x={s.c[0]} y={s.c[1]} textAnchor="middle" fontSize={SMALL.has(r.uf) ? 15 : 22} className="sigla">
              {r.uf}
              {v.lead === 0 ? ' ▲' : v.lead === 1 ? ' ●' : ''}
            </text>
          ))}
        </g>
      </svg>
      <figcaption className="hint flex flex-wrap gap-x-4 gap-y-1">
        <span><b className="c-flavio">▲</b> Flávio à frente</span>
        <span><b className="c-lula">●</b> Lula à frente</span>
        <span>Cor mais forte = maior diferença e mais votos contados</span>
        <span><b style={{ color: 'var(--gold)' }}>▢</b> virou face à 1.ª volta</span>
        <span><b>▢</b> estado escolhido</span>
      </figcaption>
    </figure>
  );
}
