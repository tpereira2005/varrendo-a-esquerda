'use client';
import type { Snapshot } from '@/lib/types';
import { UF_NAMES } from '@/lib/tse.mjs';
import { projectionVerdict, probText } from '@/lib/projecao.mjs';
import { Numero } from './numero';
import { compact, pct } from './format';
import vespera from '@/data/vespera.json';
import fontes from '@/data/sondagens-verificadas.json';

// Sondagens da véspera (data/vespera.json), só quando a atualização estiver ligada.
const sondagens =
  vespera.ativo && vespera.sondagens.flavio != null
    ? { ...vespera.sondagens, flavio: vespera.sondagens.flavio as number }
    : null;

/** Deslocação a favor de quem ganha terreno: "+1,2 pp Flávio" ou "+3,0 pp Lula" (nunca "−3 pp Lula"). */
const sinal = (v: number) => `+${pct(Math.abs(v), 1).replace('%', ' pp')} ${v >= 0 ? 'Flávio' : 'Lula'}`;
const ufName = (uf: string) => UF_NAMES[uf as keyof typeof UF_NAMES];
const cenario = vespera.ativo && vespera.cenario?.ativo ? vespera.cenario : null;

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
        <span className="tag">{cenario ? 'cenário manual' : 'estimativa'} · não oficial</span>
      </div>

      <div className={`projecao-veredito ${verdict.who ? `c-${verdict.who}` : ''}`}>
        <strong>{verdict.text}</strong>
        <span>{counted ? verdict.strength : cenario ? 'antes dos votos · cenário assumido' : sondagens ? 'antes dos votos · 1.ª volta e sondagens' : 'antes dos votos · com base na 1.ª volta'}</span>
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

      {sondagens && (
        <div className="mercado-comparar">
          <span className="hint">Média das sondagens</span>
          <span><b className="c-flavio">Flávio {pct(sondagens.flavio, 1)}</b> · <b className="c-lula">Lula {pct(100 - sondagens.flavio, 1)}</b></span>
          <span className="hint">
            {sondagens.institutos} institutos · {sondagens.periodo.replace(/\d{4}-(\d{2})-(\d{2})/g, '$2/$1').replace(' a ', '–')} · votos válidos
          </span>
        </div>
      )}

      <details className="detalhes-pequenos">
        <summary>Como é calculada?</summary>
        <ul className="hint mt-1 lista-como">
          {sondagens && <li>Média simples da sondagem mais recente de cada instituto, com campo terminado nos últimos sete dias. Fontes originais ou reportagens com ficha técnica; preferência por votos válidos publicados. Em {vespera.sondagens.convertidas} sondagens, os válidos foram calculados a partir dos totais arredondados.</li>}
          {cenario && <li>Cenário inicial manual: Flávio {pct(cenario.flavio, 2)}, acompanhando o <a href={cenario.fonte} target="_blank" rel="noreferrer">mapa do Global Election Simulator</a> consultado em 25/10. É distinto da média das sondagens e da combinação calculada pelo GES (51,52%). As probabilidades são do nosso modelo, condicionais a este cenário, e corrigidas pelos votos apurados.</li>}
          {sondagens && <li>Atualização: {vespera.atualizado}. O mercado não entra no cálculo do nosso modelo. Fontes: {fontes.map((s, i) => <span key={s.registro}>{i > 0 ? ' · ' : ''}<a href={s.fonte} target="_blank" rel="noreferrer">{s.instituto} ({s.periodo})</a></span>)}. Incerteza das sondagens: desvio-padrão de {vespera.sondagens.incerteza} pp, incluindo risco de erro comum; não é a margem de erro de uma sondagem.</li>}
          {sondagens && <li>A média usa a amostra geral de cada instituto. O modelo de eleitor provável da Nexus (52,4% Flávio / 47,6% Lula) é um recorte diferente e não entra como outra sondagem.</li>}
          <li>
            <b>Ponto de partida:</b> 1.ª volta com os votos dos eliminados redistribuídos
            {sondagens ? ' (como medido pelo Datafolha), combinada com a média das sondagens' : ' (Caiado e Zema sobretudo para o Flávio)'}{cenario ? ', seguida do ajuste manual do cenário' : ''} · Flávio{' '}
            {pct(p.prior, 1)}.
          </li>
          <li>
            <b>Deslocação:</b> o que já se contou face a esse ponto de partida, estado a estado; um estado com pouco contado usa a da sua região e
            do país{counted && <> (país: {sinal(p.nationalSwing)})</>}.
          </li>
          <li>
            <b>Tendência da contagem:</b> como a quota muda à medida que se conta em cada estado; os votos que faltam seguem-na
            {counted && Math.abs(p.trend) >= 0.3 && (
              <> (agora, os que faltam são {pct(Math.abs(p.trend), 1).replace('%', ' pp')} mais {p.trend > 0 ? 'Lula' : 'Flávio'})</>
            )}
            .
          </li>
          <li>
            <b>Incerteza:</b> com uma parte comum ao país e às regiões; calibrada em noites simuladas.
          </li>
        </ul>
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
