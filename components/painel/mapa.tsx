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
  if (!p || p.cands[0].votes + p.cands[1].votes === 0) return { lead: null, margin: 0, flipped: false, r1Lead };
  const [a, b] = p.cands;
  const lead = a.votes === b.votes ? null : a.votes > b.votes ? 0 : 1;
  return { lead, margin: Math.abs(a.pct - b.pct), flipped: lead != null && lead !== r1Lead, r1Lead };
}

export function Mapa({ states, selected, onSelect }: { states: Race[]; selected: string; onSelect: (uf: string) => void }) {
  return (
    <figure>
      <svg viewBox="0 0 1000 971" className="w-full h-auto max-h-[520px]" role="group" aria-label="Mapa: quem vai à frente em cada estado">
        {states.map((r) => {
          const s = SHAPES[r.uf];
          const v = stateView(r);
          // Mistura com o cinzento: diferença pequena = cor clara; 25 pp ou mais = cor plena (igual em tema claro e escuro).
          const strength = Math.round(35 + 65 * Math.min(1, v.margin / 25));
          const base = v.lead === 0 ? 'var(--flavio)' : 'var(--lula)';
          const fill = v.lead == null ? 'var(--neutral)' : `color-mix(in srgb, ${base} ${strength}%, var(--neutral))`;
          const label = `${s.n}: ${v.lead == null ? 'sem votos' : `${v.lead === 0 ? 'Flávio' : 'Lula'} à frente por ${pct(v.margin)} pontos`}${v.flipped ? ', virou face à 1.ª volta' : ''}`;
          return (
            <g key={r.uf} role="button" tabIndex={0} aria-label={label} onClick={() => onSelect(r.uf)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(r.uf)} className="cursor-pointer">
              <title>{label}</title>
              <path d={s.d} fill={fill}
                stroke={v.flipped ? 'var(--gold)' : selected === r.uf ? 'var(--ink)' : 'var(--card)'}
                strokeWidth={v.flipped || selected === r.uf ? 5 : 1.5} />
              <text x={s.c[0]} y={s.c[1]} textAnchor="middle" fontSize={SMALL.has(r.uf) ? 15 : 22} fontWeight="700" fill="var(--ink)"
                style={{ paintOrder: 'stroke', stroke: 'var(--card)', strokeWidth: 4 }}>
                {r.uf}
                {v.lead === 0 ? ' ▲' : v.lead === 1 ? ' ●' : ''}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="hint flex flex-wrap gap-x-4 gap-y-1">
        <span><b className="c-flavio">▲</b> Flávio à frente</span>
        <span><b className="c-lula">●</b> Lula à frente</span>
        <span>Cor mais forte = maior diferença</span>
        <span><b style={{ color: 'var(--gold)' }}>▢</b> virou face à 1.ª volta</span>
      </figcaption>
    </figure>
  );
}
