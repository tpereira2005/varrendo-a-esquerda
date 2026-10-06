'use client';
import type { Snapshot } from '@/lib/types';
import { pp, pct } from './format';
import { useLargura } from './largura';

const PAD = { l: 38, r: 10, t: 12, b: 26 };

/**
 * Diferença Flávio − Lula (pontos percentuais) ao longo do apuramento.
 * Desenhado à largura real do ecrã (1 unidade = 1 px), para o texto ficar sempre legível.
 */
export function Evolucao({ data }: { data: Snapshot }) {
  const [ref, W] = useLargura<HTMLElement>(600);
  const H = Math.round(Math.max(180, Math.min(280, W * 0.4)));
  const points = data.timeline
    .filter((p) => p.votesA + p.votesB > 0)
    .map((p) => ({ x: p.pctSections, y: (100 * (p.votesA - p.votesB)) / (p.votesA + p.votesB), at: p.generatedAt }));
  if (points.length < 2) {
    return (
      <figure ref={ref}>
        <p className="hint">O gráfico aparece com o segundo ficheiro oficial da noite.</p>
      </figure>
    );
  }
  // A escala ignora os primeiros 5% (diferenças enormes e sem significado com poucos votos); esses pontos ficam no limite.
  const settled = points.filter((p) => p.x >= 5);
  const maxAbs = Math.max(2, ...(settled.length >= 2 ? settled : points).map((p) => Math.abs(p.y)));
  const lim = Math.ceil(maxAbs / 2) * 2;
  const clamp = (y: number) => Math.max(-lim, Math.min(lim, y));
  const sx = (x: number) => PAD.l + (x / 100) * (W - PAD.l - PAD.r);
  const sy = (y: number) => PAD.t + ((lim - clamp(y)) / (2 * lim)) * (H - PAD.t - PAD.b);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');
  const area = `${line}L${sx(points.at(-1)!.x).toFixed(1)},${sy(0)}L${sx(points[0].x).toFixed(1)},${sy(0)}Z`;
  const last = points.at(-1)!;
  const turns = data.events.filter((e) => e.kind === 'virada' && e.key === data.national.key);

  return (
    <figure ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
        aria-label={`Diferença atual ${pp(last.y)} com ${pct(last.x)} das secções`}>
        <defs>
          <clipPath id="pos"><rect x="0" y="0" width={W} height={sy(0)} /></clipPath>
          <clipPath id="neg"><rect x="0" y={sy(0)} width={W} height={H} /></clipPath>
        </defs>
        {[lim, lim / 2, 0, -lim / 2, -lim].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} stroke="color-mix(in srgb, var(--muted) 30%, transparent)" strokeWidth={v === 0 ? 1.6 : 1} />
            <text x={PAD.l - 6} y={sy(v) + 4} textAnchor="end" fontSize="12" fill="var(--muted)">
              {v > 0 ? `+${v}` : v}
            </text>
          </g>
        ))}
        {[0, 25, 50, 75, 100].map((x) => (
          <text key={x} x={sx(x)} y={H - 6} textAnchor={x === 0 ? 'start' : x === 100 ? 'end' : 'middle'} fontSize="12" fill="var(--muted)">{x}%</text>
        ))}
        <path d={area} fill="var(--flavio)" opacity="0.18" clipPath="url(#pos)" />
        <path d={area} fill="var(--lula)" opacity="0.18" clipPath="url(#neg)" />
        <path d={line} fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" className="linha-evolucao" pathLength={1} />
        {turns.map((t) => {
          const p = points.find((q) => q.at === t.at);
          return p ? <circle key={t.id} cx={sx(p.x)} cy={sy(p.y)} r="5" fill="var(--gold)" stroke="var(--ink)" /> : null;
        })}
        <circle cx={sx(last.x)} cy={sy(last.y)} r="4.5" fill={last.y >= 0 ? 'var(--flavio)' : 'var(--lula)'} />
      </svg>
      <figcaption className="hint mt-1">
        Acima de zero, o Flávio vai à frente; abaixo, o Lula. Eixo horizontal: secções apuradas. ● dourado = virada.
      </figcaption>
    </figure>
  );
}
