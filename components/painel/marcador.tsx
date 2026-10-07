'use client';
import type { Cand, Finalist, Snapshot } from '@/lib/types';
import { Numero } from './numero';
import { ago, compact, countdown, int, pct, pp, retrato, timeBrasilia, timeLisbon, titleCase, shortName, FLAVIO } from './format';

const LULA = '13';

type Side = 'flavio' | 'lula';

function Lado({ side, c, counted }: { side: Side; c: Finalist & Partial<Cand>; counted: boolean }) {
  const foto = retrato(c.number);
  return (
    <div className={`lado lado-${side}`}>
      <div className="lado-id">
        {foto ? (
          // Retrato com o número em selo no canto.
          <span className="retrato" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foto} alt="" width={76} height={76} decoding="async" />
            <span className="dorsal dorsal-selo">{c.number}</span>
          </span>
        ) : (
          <span className="dorsal" aria-hidden="true">{c.number}</span>
        )}
        <div>
          <div className="lado-nome">
            {/* Nomes pelo número do candidato: um finalista substituído pelo TSE aparece com o seu nome. */}
            {c.number === FLAVIO ? (
              <>
                Flávio<span className="apelido"> Bolsonaro</span>
              </>
            ) : c.number === LULA ? (
              'Lula'
            ) : (
              titleCase(c.name)
            )}
          </div>
          <div className="hint">{c.party} · {c.number}</div>
        </div>
      </div>
      <div className="lado-pct">
        {counted ? <Numero value={c.pct ?? 0} format={(v) => pct(v, 2)} /> : <span className="fantasma" title="1.ª volta">{pct(c.r1Pct, 2)}</span>}
      </div>
      <div className="lado-votos">
        {counted ? (
          <>
            <Numero value={c.votes ?? 0} format={(v) => int(Math.round(v))} /> votos
          </>
        ) : (
          <>1.ª volta: {pct(c.r1Pct, 2)}</>
        )}
      </div>
    </div>
  );
}

/** Placar principal: Flávio à esquerda, boneco ao centro, Lula à direita. */
export function Marcador({ data, now }: { data: Snapshot; now: number }) {
  const race = data.national;
  const p = race.parsed;
  const [fa, fb] = race.finalists;
  const a: Finalist & Partial<Cand> = p?.cands[0] ?? fa;
  const b: Finalist & Partial<Cand> = p?.cands[1] ?? fb;
  const total = (a.votes ?? 0) + (b.votes ?? 0);
  const counted = !!p && total > 0;
  // Sem votos: a barra mostra a 1.ª volta entre os dois finalistas, esbatida e tracejada.
  const r1Share = (100 * fa.r1Votes) / (fa.r1Votes + fb.r1Votes);
  const share = counted ? (100 * (a.votes ?? 0)) / total : r1Share;
  const diff = (a.votes ?? 0) - (b.votes ?? 0);
  const leader: Side | null = !counted || diff === 0 ? null : diff > 0 ? 'flavio' : 'lula';
  const winner: Side | null = p?.winner == null ? null : p.winner === 0 ? 'flavio' : 'lula';
  const name = (s: Side) => shortName(s === 'flavio' ? a : b, 1);

  return (
    <section className={`card hero ${winner ? `hero-${winner}` : ''}`} aria-labelledby="t-pres" id="placar">
      <div className="hero-topo">
        <h2 id="t-pres" className="eyebrow">Presidente · Brasil</h2>
        <span className="hint">
          {counted ? `Ficheiro TSE ${timeLisbon(race.meta.generatedAt, true)} (Lisboa)` : 'Flávio Bolsonaro (PL) × Lula (PT)'}
        </span>
      </div>

      <div className="hero-grelha">
        <Lado side="flavio" c={a} counted={counted} />
        <div className="hero-centro" aria-live="polite">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={data.mood.src} src={data.mood.src} alt={`Boneco: ${data.mood.label}`} width={112} height={112} className="boneco" />
          <div className="boneco-nome">{data.mood.label}</div>
          {counted && (
            <div className={`hero-diferenca c-${winner ?? leader ?? 'muted'}`}>
              {winner ? (
                <strong>{name(winner)} eleito pelo TSE</strong>
              ) : leader ? (
                <>
                  <strong>{name(leader)} à frente</strong>
                  <span>
                    por {compact(Math.abs(diff))} votos · {pp(Math.abs((a.pct ?? 0) - (b.pct ?? 0)))}
                  </span>
                </>
              ) : (
                <strong>Empate</strong>
              )}
            </div>
          )}
        </div>
        <Lado side="lula" c={b} counted={counted} />
      </div>

      <div
        className={`barra-duelo ${counted ? '' : 'referencia'}`}
        role="img"
        aria-label={`${counted ? '' : '1.ª volta: '}Flávio ${pct(share)} · Lula ${pct(100 - share)}`}
      >
        <span className="bg-flavio" style={{ width: `${share}%` }} />
        <span className="bg-lula" style={{ width: `${100 - share}%` }} />
        <i className="meta-50" aria-hidden="true" />
      </div>

      {!counted && (
        <p className="legenda-referencia">
          Barra: 1.ª volta contando só os dois · Flávio {pct(r1Share, 1)} × Lula {pct(100 - r1Share, 1)}
        </p>
      )}
      {counted ? (
        <div className="apuramento">
          <div className="apuramento-linha">
            <span>
              <Numero value={p!.pctSections} format={(v) => pct(v, 2)} /> das secções apuradas
            </span>
            <span className="hint">
              {p!.final
                ? 'Totalização final do TSE'
                : `Verificado ${ago(race.meta.successAt, now)}${race.meta.stale && race.meta.successAt ? ' · sem novos dados do TSE' : ''}`}
            </span>
          </div>
          <div className="progresso" aria-hidden="true">
            <span style={{ width: `${p!.pctSections}%` }} />
          </div>
        </div>
      ) : (
        <p className="contagem">
          {data.phase === 'antes' && now < data.pollsCloseAt ? (
            <>
              As urnas fecham às <b>{timeLisbon(data.pollsCloseAt)} em Lisboa</b> ({timeBrasilia(data.pollsCloseAt)} em Brasília), domingo,
              25 de outubro · faltam <b>{countdown(data.pollsCloseAt, now)}</b>
            </>
          ) : (
            'A aguardar os primeiros votos do TSE'
          )}
        </p>
      )}
      {p?.warnings.map((w) => (
        <p key={w} className="hint">⚠ {w}</p>
      ))}
    </section>
  );
}
