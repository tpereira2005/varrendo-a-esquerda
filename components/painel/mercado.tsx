'use client';
import { useState } from 'react';
import type { Snapshot } from '@/lib/types';
import { probText } from '@/lib/projecao.mjs';
import { Numero } from './numero';
import { ago, compact, pct, pp } from './format';
import { useLargura } from './largura';

const PAD = { l: 42, r: 14, t: 14, b: 26 };
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: 'numeric', day: 'numeric' });
/** Data curta em Lisboa: "19 nov", ou "19 nov 2025" com o ano. */
function dia(t: number, ano = false) {
  const p = Object.fromEntries(partes.formatToParts(t).map((x) => [x.type, x.value]));
  return `${Number(p.day)} ${MESES[Number(p.month) - 1]}${ano ? ` ${p.year}` : ''}`;
}
const mes = (t: number) => dia(t).split(' ')[1];
const hora = new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit' });

type Vista = 'campanha' | 'dia';

/** Probabilidade de vitória segundo o mercado de apostas Polymarket. Informação à parte: nunca é resultado oficial. */
export function Mercado({ data, now }: { data: Snapshot; now: number }) {
  const m = data.market!;
  const [vista, setVista] = useState<Vista>(data.phase === 'antes' ? 'campanha' : 'dia');
  const series = vista === 'campanha' && m.campaign.length >= 2 ? m.campaign : m.recent;
  const shown: Vista = series === m.campaign ? 'campanha' : 'dia';
  const ahead = m.flavio >= m.lula ? 'flavio' : 'lula';
  const prob = Math.round(m.flavio);
  const site = data.projection ? 100 * data.projection.probFlavio : null;

  return (
    <section className="card grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2>Mercado de apostas</h2>
        <span className="tag">{m.stale ? 'desatualizado · não oficial' : 'não oficial'}</span>
      </div>

      {/* PC: números à esquerda, gráfico à direita. Telemóvel: tudo numa coluna. */}
      <div className="mercado-corpo">
        <div className="grid gap-3 content-start">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="hint">Flávio ganha</div>
              <div className="pct-medio c-flavio">
                <Numero value={m.flavio} format={(v) => pct(v, 0)} />
              </div>
              {Math.abs(m.change24h) >= 0.05 && (
                <div className={`mercado-variacao ${m.change24h > 0 ? 'sobe' : 'desce'}`}>
                  {m.change24h > 0 ? '▲' : '▼'} {pp(m.change24h).replace(/^[+−]/, '')} em 24 h
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="hint">Lula ganha</div>
              <div className="pct-medio c-lula">
                <Numero value={m.lula} format={(v) => pct(v, 0)} />
              </div>
            </div>
          </div>

          <div className="barra-duelo fina" role="img" aria-label={`Mercado de apostas: Flávio ${pct(m.flavio, 0)}, Lula ${pct(m.lula, 0)}`}>
            <span className="bg-flavio" style={{ width: `${prob}%` }} />
            <span className="bg-lula" style={{ width: `${100 - prob}%` }} />
            <i className="meta-50" />
          </div>

          {m.campaign.length >= 2 && <Resumo pontos={m.campaign} />}

          {site != null && (
            <p className="mercado-comparar">
              <span>
                Projeção do site: <b className={site >= 50 ? 'c-flavio' : 'c-lula'}>{probText(site / 100)}</b>
              </span>
              <span>
                Mercado: <b className={`c-${ahead}`}>{pct(m.flavio, 0)}</b>
              </span>
              <span className="hint">probabilidade de o Flávio ganhar</span>
            </p>
          )}
        </div>

        {(m.campaign.length >= 2 || m.recent.length >= 2) && (
          <div className="grid gap-2 content-start">
            <div className="seletor" role="tablist" aria-label="Período do gráfico">
              {m.campaign.length >= 2 && (
                <button role="tab" aria-selected={shown === 'campanha'} onClick={() => setVista('campanha')}>
                  Campanha
                </button>
              )}
              {m.recent.length >= 2 && (
                <button role="tab" aria-selected={shown === 'dia'} onClick={() => setVista('dia')}>
                  Últimas 24 h
                </button>
              )}
            </div>
            <Grafico pontos={series} vista={shown} />
          </div>
        )}
      </div>

      <p className="hint">
        Preço das apostas no Polymarket: {Math.round(m.flavio)} cêntimos por cada dólar de prémio = {pct(m.flavio, 0)} de hipóteses, segundo quem
        aposta. Não é sondagem nem resultado oficial. {m.volume > 0 && <>{compact(Math.round(m.volume))} US$ apostados · </>}
        atualizado {ago(m.at, now)}.
      </p>
    </section>
  );
}

/** Linha do Flávio no mercado: verde acima dos 50%, vermelha abaixo. Toque ou passe o rato para ler um ponto. */
function Grafico({ pontos, vista }: { pontos: [number, number][]; vista: Vista }) {
  const [ref, W] = useLargura<HTMLElement>(560);
  const [foco, setFoco] = useState<number | null>(null);
  const H = Math.round(Math.max(170, Math.min(240, W * 0.42)));

  // Campanha: escala completa 0–100%. Últimas 24 h: ampliada à volta dos valores (pelo menos 6 pp de altura).
  let lo = 0;
  let hi = 100;
  if (vista === 'dia') {
    const ys = pontos.map((p) => p[1]);
    const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
    const half = Math.max(3, (Math.max(...ys) - Math.min(...ys)) / 2 + 1);
    lo = Math.max(0, Math.floor(mid - half));
    hi = Math.min(100, Math.ceil(mid + half));
  }
  const t0 = pontos[0][0];
  const t1 = pontos.at(-1)![0];
  const sx = (t: number) => PAD.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - PAD.l - PAD.r);
  const sy = (y: number) => PAD.t + ((hi - Math.max(lo, Math.min(hi, y))) / (hi - lo)) * (H - PAD.t - PAD.b);
  const line = pontos.map(([t, y], i) => `${i ? 'L' : 'M'}${sx(t).toFixed(1)},${sy(y).toFixed(1)}`).join('');
  const base = sy(Math.max(lo, Math.min(hi, 50)));
  const area = `${line}L${sx(t1).toFixed(1)},${base}L${sx(t0).toFixed(1)},${base}Z`;
  const ticksY = vista === 'campanha' ? [0, 25, 50, 75, 100] : niceTicks(lo, hi);
  const ticksX = Array.from({ length: 4 }, (_, i) => t0 + ((t1 - t0) * (i + 0.5)) / 4);
  const fmtX = (t: number) => (vista === 'campanha' ? mes(t) : hora.format(t));
  const last = pontos.at(-1)!;
  const sel = foco == null ? null : pontos[foco];

  const mover = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    for (let i = 1; i < pontos.length; i++) if (Math.abs(sx(pontos[i][0]) - x) < Math.abs(sx(pontos[best][0]) - x)) best = i;
    setFoco(best);
  };

  return (
    <figure ref={ref} className="mercado-grafico">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Flávio no mercado: ${pct(pontos[0][1], 0)} no início do período, ${pct(last[1], 0)} agora`}
        onPointerMove={mover}
        onPointerDown={mover}
        onPointerLeave={() => setFoco(null)}
      >
        <defs>
          <clipPath id="mercado-acima"><rect x="0" y="0" width={W} height={base} /></clipPath>
          <clipPath id="mercado-abaixo"><rect x="0" y={base} width={W} height={H} /></clipPath>
          <linearGradient id="mercado-verde" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--flavio)" stopOpacity="0.32" />
            <stop offset="1" stopColor="var(--flavio)" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="mercado-vermelho" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="var(--lula)" stopOpacity="0.32" />
            <stop offset="1" stopColor="var(--lula)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {ticksY.map((v) => (
          <g key={v}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={sy(v)}
              y2={sy(v)}
              stroke="color-mix(in srgb, var(--muted) 30%, transparent)"
              strokeWidth={v === 50 ? 1.4 : 1}
              strokeDasharray={v === 50 ? '4 4' : undefined}
            />
            <text x={PAD.l - 6} y={sy(v) + 4} textAnchor="end" fontSize="12" fill="var(--muted)">
              {v}%
            </text>
          </g>
        ))}
        {ticksX.map((t) => (
          <text key={t} x={sx(t)} y={H - 6} textAnchor="middle" fontSize="12" fill="var(--muted)">
            {fmtX(t)}
          </text>
        ))}
        <path d={area} fill="url(#mercado-verde)" clipPath="url(#mercado-acima)" />
        <path d={area} fill="url(#mercado-vermelho)" clipPath="url(#mercado-abaixo)" />
        <path d={line} fill="none" stroke="var(--flavio)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" clipPath="url(#mercado-acima)" />
        <path d={line} fill="none" stroke="var(--lula)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" clipPath="url(#mercado-abaixo)" />
        <circle cx={sx(last[0])} cy={sy(last[1])} r="9" className="mercado-pulso" fill={last[1] >= 50 ? 'var(--flavio)' : 'var(--lula)'} />
        <circle cx={sx(last[0])} cy={sy(last[1])} r="4.5" fill={last[1] >= 50 ? 'var(--flavio)' : 'var(--lula)'} stroke="var(--card)" strokeWidth="1.5" />
        {sel && (
          <g pointerEvents="none">
            <line x1={sx(sel[0])} x2={sx(sel[0])} y1={PAD.t} y2={H - PAD.b} stroke="var(--muted)" strokeWidth="1" />
            <circle cx={sx(sel[0])} cy={sy(sel[1])} r="4.5" fill="var(--card)" stroke="var(--ink)" strokeWidth="2" />
          </g>
        )}
      </svg>
      <figcaption className="hint mt-1">
        {sel ? (
          <>
            <b className={sel[1] >= 50 ? 'c-flavio' : 'c-lula'}>Flávio {pct(sel[1], 1)}</b> ·{' '}
            {vista === 'campanha' ? dia(sel[0], true) : `${hora.format(sel[0])} em Lisboa`}
          </>
        ) : (
          <>Probabilidade do Flávio segundo o mercado. Linha a tracejado: 50%.</>
        )}
      </figcaption>
    </figure>
  );
}

/** Uma frase sobre a campanha: de onde partiu o Flávio, o máximo e o mínimo. */
function Resumo({ pontos }: { pontos: [number, number][] }) {
  const first = pontos[0];
  const max = pontos.reduce((a, b) => (b[1] > a[1] ? b : a));
  const min = pontos.reduce((a, b) => (b[1] < a[1] ? b : a));
  const last = pontos.at(-1)!;
  return (
    <p className="mercado-resumo">
      <span>
        Início <b>{pct(first[1], 0)}</b> <small>{dia(first[0], true)}</small>
      </span>
      {min !== first && <span>
        Mínimo <b className="c-lula">{pct(min[1], 0)}</b> <small>{dia(min[0])}</small>
      </span>}
      <span>
        Máximo <b className="c-flavio">{pct(max[1], 0)}</b> <small>{dia(max[0])}</small>
      </span>
      <span>
        Agora <b className={last[1] >= 50 ? 'c-flavio' : 'c-lula'}>{pct(last[1], 0)}</b>
      </span>
    </p>
  );
}

function niceTicks(lo: number, hi: number) {
  const span = hi - lo;
  const step = span <= 8 ? 2 : span <= 20 ? 5 : 10;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
  return out;
}
