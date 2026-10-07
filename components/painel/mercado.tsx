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

type Vista = 'campanha' | 'dia' | 'noite';
type Marca = { t: number; label: string };
const NOMES: Record<Vista, string> = { campanha: 'Campanha', dia: 'Últimas 24 h', noite: 'Noite' };

/** Probabilidade de vitória segundo o mercado de apostas Polymarket. Informação à parte: nunca é resultado oficial. */
export function Mercado({ data, now }: { data: Snapshot; now: number }) {
  const m = data.market!;
  // Sem escolha de quem vê, o gráfico acompanha a noite: campanha antes, "Noite" assim que houver dados da noite eleitoral.
  const [escolha, setEscolha] = useState<Vista | null>(null);
  const series: Record<Vista, [number, number][]> = { campanha: m.campaign, dia: m.recent, noite: m.night };
  const available = (['noite', 'campanha', 'dia'] as Vista[]).filter((v) => series[v].length >= 2);
  const auto: Vista = data.phase !== 'antes' && m.night.length >= 2 ? 'noite' : 'campanha';
  const shown = [escolha, auto, ...available].find((v): v is Vista => !!v && available.includes(v));
  const ahead = m.flavio >= m.lula ? 'flavio' : 'lula';
  const prob = Math.round(m.flavio);
  const site = data.projection ? 100 * data.projection.probFlavio : null;

  // Vista da noite: fecho das urnas e marcos do apuramento oficial (hora do ficheiro do TSE).
  const marcas: Marca[] = [];
  if (shown === 'noite') {
    marcas.push({ t: data.pollsCloseAt, label: 'urnas fecham' });
    for (const level of [25, 50, 75, 90]) {
      const hit = data.timeline.find((p) => p.pctSections >= level);
      if (hit) marcas.push({ t: hit.generatedAt, label: `${level}% apurado` });
    }
  }

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

          {m.marks.length > 0 && <Marcos marks={m.marks} current={m.flavio} at={m.at} />}

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

        {shown && (
          <div className="grid gap-2 content-start">
            {available.length > 1 && (
              <div className="seletor" role="tablist" aria-label="Período do gráfico">
                {available.map((v) => (
                  <button key={v} role="tab" aria-selected={shown === v} onClick={() => setEscolha(v)}>
                    {NOMES[v]}
                  </button>
                ))}
              </div>
            )}
            <Grafico pontos={series[shown]} vista={shown} marcas={marcas} />
          </div>
        )}
      </div>

      <p className="hint">
        Não é sondagem nem resultado oficial. {m.volume > 0 && <>{compact(Math.round(m.volume))} US$ apostados · </>}
        atualizado {ago(m.at, now)}.
      </p>
    </section>
  );
}

/** Linha do Flávio no mercado: verde acima dos 50%, vermelha abaixo. Toque ou passe o rato para ler um ponto. */
function Grafico({ pontos, vista, marcas }: { pontos: [number, number][]; vista: Vista; marcas: Marca[] }) {
  const [ref, W] = useLargura<HTMLElement>(560);
  const [foco, setFoco] = useState<number | null>(null);
  const H = Math.round(Math.max(170, Math.min(240, W * 0.42)));

  // Campanha: escala completa 0–100%. Últimas 24 h e noite: ampliada à volta dos valores (pelo menos 6 pp de altura).
  let lo = 0;
  let hi = 100;
  if (vista !== 'campanha') {
    const ys = pontos.map((p) => p[1]);
    const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
    const half = Math.max(3, (Math.max(...ys) - Math.min(...ys)) / 2 + 1);
    lo = Math.max(0, Math.floor(mid - half));
    hi = Math.min(100, Math.ceil(mid + half));
  }
  const t0 = pontos[0][0];
  const t1 = pontos.at(-1)![0];
  const visiveis = marcas.filter((k) => k.t >= t0 && k.t <= t1);
  const top = visiveis.length ? 34 : PAD.t; // espaço para os nomes das marcas
  const sx = (t: number) => PAD.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - PAD.l - PAD.r);
  const sy = (y: number) => top + ((hi - Math.max(lo, Math.min(hi, y))) / (hi - lo)) * (H - top - PAD.b);
  const show50 = lo <= 50 && hi >= 50;
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
        {visiveis.map((k, i) => {
          const x = sx(k.t);
          return (
            <g key={k.label}>
              <line x1={x} x2={x} y1={top - 4} y2={H - PAD.b} stroke="var(--gold)" strokeWidth="1.3" strokeDasharray="3 3" />
              <text
                x={x}
                y={i % 2 ? top - 8 : 12}
                textAnchor={x > W - 70 ? 'end' : x < PAD.l + 50 ? 'start' : 'middle'}
                fontSize="11"
                fontWeight="600"
                fill="var(--muted)"
              >
                {k.label}
              </text>
            </g>
          );
        })}
        <path d={area} fill="url(#mercado-verde)" clipPath="url(#mercado-acima)" />
        <path d={area} fill="url(#mercado-vermelho)" clipPath="url(#mercado-abaixo)" />
        <path d={line} fill="none" stroke="var(--flavio)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" clipPath="url(#mercado-acima)" />
        <path d={line} fill="none" stroke="var(--lula)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" clipPath="url(#mercado-abaixo)" />
        <circle cx={sx(last[0])} cy={sy(last[1])} r="9" className="mercado-pulso" fill={last[1] >= 50 ? 'var(--flavio)' : 'var(--lula)'} />
        <circle cx={sx(last[0])} cy={sy(last[1])} r="4.5" fill={last[1] >= 50 ? 'var(--flavio)' : 'var(--lula)'} stroke="var(--card)" strokeWidth="1.5" />
        {sel && (
          <g pointerEvents="none">
            <line x1={sx(sel[0])} x2={sx(sel[0])} y1={top} y2={H - PAD.b} stroke="var(--muted)" strokeWidth="1" />
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
          <>
            Probabilidade do Flávio segundo o mercado.{show50 && ' Linha a tracejado: 50%.'}
            {visiveis.length > 0 && ' Linhas douradas: fecho das urnas e secções apuradas pelo TSE.'}
          </>
        )}
      </figcaption>
    </figure>
  );
}

/** Marcos da campanha comparados com agora: de onde vem o preço atual. */
function Marcos({ marks, current, at }: { marks: { label: string; t: number; p: number }[]; current: number; at: number }) {
  return (
    <div className="mercado-resumo">
      {marks.map((k) => {
        const d = current - k.p;
        const isNow = k.label === 'Máximo' && at - k.t < 86_400_000;
        return (
          <span key={k.label}>
            {k.label}
            <b className={k.p >= 50 ? 'c-flavio' : 'c-lula'}>{pct(k.p, 0)}</b>
            <small>
              {dia(k.t)}
              {isNow ? (
                ' · é agora'
              ) : Math.abs(d) >= 0.5 ? (
                <em className={d > 0 ? 'c-flavio' : 'c-lula'}>
                  {' · '}
                  {d > 0 ? '+' : '−'}
                  {Math.abs(d).toFixed(0)} pp até hoje
                </em>
              ) : null}
            </small>
          </span>
        );
      })}
    </div>
  );
}

function niceTicks(lo: number, hi: number) {
  const span = hi - lo;
  const step = span <= 8 ? 2 : span <= 20 ? 5 : 10;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
  return out;
}
