'use client';
import type { Snapshot } from '@/lib/types';
import { UF_NAMES } from '@/lib/tse.mjs';
import { projectionVerdict, probText } from '@/lib/projecao.mjs';
import { Numero } from './numero';
import { compact, pct } from './format';

const ufName = (uf: string) => UF_NAMES[uf as keyof typeof UF_NAMES];

/** Projeção do resultado final: estimativa estatística, sempre identificada como não oficial. */
export function Projecao({ data }: { data: Snapshot }) {
  const p = data.projection!;
  const verdict = projectionVerdict(p);
  const counted = (data.national.parsed?.pctSections ?? 0) > 0;
  const prob = Math.round(100 * p.probFlavio);
  return (
    <section className="card grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2>Projeção</h2>
        <span className="tag">estimativa · não oficial</span>
      </div>

      <div className={`projecao-veredito ${verdict.who ? `c-${verdict.who}` : ''}`}>
        <strong>{verdict.text}</strong>
        <span>{counted ? verdict.strength : 'antes dos votos · com base na 1.ª volta'}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="hint">Flávio · projetado</div>
          <div className="pct-medio c-flavio">
            <Numero value={p.flavio} format={(v) => pct(v, 1)} />
          </div>
        </div>
        <div className="text-right">
          <div className="hint">Lula · projetado</div>
          <div className="pct-medio c-lula">
            <Numero value={p.lula} format={(v) => pct(v, 1)} />
          </div>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-sm font-semibold">
          <span className="c-flavio">Flávio ganha: {probText(p.probFlavio)}</span>
          <span className="c-lula">Lula ganha: {probText(1 - p.probFlavio)}</span>
        </div>
        <div className="barra-duelo fina mt-1" role="img" aria-label={`Probabilidade de vitória: Flávio ${probText(p.probFlavio)}, Lula ${probText(1 - p.probFlavio)}`}>
          <span className="bg-flavio" style={{ width: `${prob}%` }} />
          <span className="bg-lula" style={{ width: `${100 - prob}%` }} />
          <i className="meta-50" />
        </div>
      </div>

      <p className="hint">
        Intervalo provável para o Flávio: {pct(p.low, 1)} a {pct(p.high, 1)} · diferença projetada {compact(Math.abs(p.margin))} votos
        {counted && <> · estados projetados: Flávio {p.statesFlavio}, Lula {p.statesLula}</>}.
      </p>

      <details className="detalhes-pequenos">
        <summary>Como é calculada?</summary>
        <p className="hint mt-1">
          Em cada estado (e no estrangeiro), os votos que faltam contar são estimados e repartidos segundo a quota do Flávio na 1.ª volta entre os
          dois, corrigida pela deslocação já observada nesse estado (com poucos votos contados, usa-se a deslocação média do país, agora{' '}
          {p.nationalSwing >= 0 ? '+' : '−'}
          {pct(Math.abs(p.nationalSwing), 1).replace('%', ' pp')} para o {p.nationalSwing >= 0 ? 'Flávio' : 'Lula'}). Assim, a ordem de contagem
          dos estados não engana a projeção. A incerteza vem sobretudo da ordem de contagem dentro de cada estado e diminui à medida que se conta. É
          uma estimativa: o resultado oficial é só o do TSE.
        </p>
      </details>
    </section>
  );
}

/** Estados (e estrangeiro) com mais votos por apurar e para quem devem ir, segundo a projeção. */
export function OndeFaltam({ data, children }: { data: Snapshot; children?: React.ReactNode }) {
  const p = data.projection!;
  const rows = [...p.perRegion].filter((r) => r.remaining > 0).sort((a, b) => b.remaining - a.remaining).slice(0, 8);
  const max = Math.max(1, ...rows.map((r) => r.remaining));
  if (!rows.length) return <>{children}</>;
  return (
    <section className="card grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2>Onde faltam votos</h2>
        <span className="tag">estimativa</span>
      </div>
      {children}
      <ol className="lista-faltam">
        {rows.map((r) => {
          const leader = r.shareNow == null ? null : r.shareNow >= 50 ? 'flavio' : 'lula';
          const gain = r.netFlavio >= 0 ? 'flavio' : 'lula';
          return (
            <li key={r.uf} className="faltam-linha">
              <span className="font-semibold">{ufName(r.uf)}</span>
              <span className="faltam-barra" aria-hidden="true">
                <span style={{ width: `${(100 * r.remaining) / max}%` }} />
              </span>
              <span className="hint text-right">~{compact(r.remaining)} por apurar · {pct(r.pctSections, 0)} contado</span>
              <span className="text-sm">
                {leader ? (
                  <>
                    Agora: <b className={`c-${leader}`}>{leader === 'flavio' ? 'Flávio' : 'Lula'} {pct(leader === 'flavio' ? r.shareNow! : 100 - r.shareNow!, 1)}</b>
                  </>
                ) : (
                  <span className="hint">Ainda sem votos</span>
                )}
              </span>
              <span className={`text-sm font-semibold text-right c-${gain}`}>
                deve dar +{compact(Math.abs(r.netFlavio))} ao {gain === 'flavio' ? 'Flávio' : 'Lula'}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="hint">
        “Deve dar”: a vantagem que os votos por apurar devem acrescentar, segundo a projeção.
      </p>
    </section>
  );
}
