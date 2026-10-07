'use client';
import type { Race, Snapshot, Turnout } from '@/lib/types';
import { UF_NAMES } from '@/lib/tse.mjs';
import { pct, pp } from './format';

/**
 * Taxas (%) só sobre as secções já apuradas: abstenção ÷ (abstenção + comparecimento); brancos e nulos ÷ comparecimento.
 * Dividir pelo eleitorado inteiro daria uma abstenção artificialmente baixa até ao fim da contagem.
 */
export function taxas(t: Turnout | undefined | null) {
  if (!t) return null;
  const inscritos = (t.abstencao ?? 0) + (t.comparecimento ?? 0);
  if (!inscritos || !t.comparecimento) return null;
  return {
    abstencao: (100 * (t.abstencao ?? 0)) / inscritos,
    brancos: (100 * (t.brancos ?? 0)) / t.comparecimento,
    nulos: (100 * (t.nulos ?? 0)) / t.comparecimento,
  };
}

const ufName = (uf: string) => UF_NAMES[uf as keyof typeof UF_NAMES];
/** Quem ganhou o estado na 1.ª volta, entre os dois finalistas. */
const r1Leader = (r: Race) => (r.finalists[0].r1Votes >= r.finalists[1].r1Votes ? 'flavio' : 'lula');

function Taxa({ label, r1, r2 }: { label: string; r1: number | null | undefined; r2: number | null | undefined }) {
  const d = r1 != null && r2 != null ? r2 - r1 : null;
  return (
    <div className="taxa">
      <div className="hint">{label}</div>
      <div className="taxa-valor">{r2 != null ? pct(r2, 1) : pct(r1, 1)}</div>
      <div className="taxa-nota">
        {r2 != null ? (
          <>
            1.ª volta {pct(r1, 1)}
            {d != null && Math.abs(d) >= 0.05 && <b> · {pp(d)}</b>}
          </>
        ) : (
          '1.ª volta'
        )}
      </div>
    </div>
  );
}

/** Abstenção, brancos e nulos: 1.ª volta e 2.ª volta (nas secções já apuradas), e onde a abstenção mais mudou. */
export function Abstencao({ data }: { data: Snapshot }) {
  const nat1 = taxas(data.national.r1);
  const nat2 = taxas(data.national.parsed?.turnout);
  const pctNat = data.national.parsed?.pctSections ?? 0;

  const changes = data.states
    .map((r) => {
      const t1 = taxas(r.r1);
      const t2 = taxas(r.parsed?.turnout);
      return t1 && t2 && (r.parsed?.pctSections ?? 0) >= 5 ? { r, d: t2.abstencao - t1.abstencao, now: t2.abstencao } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  const up = [...changes].filter((x) => x.d > 0).sort((a, b) => b.d - a.d).slice(0, 3);
  const down = [...changes].filter((x) => x.d < 0).sort((a, b) => a.d - b.d).slice(0, 3);
  const moved = up.length + down.length > 0;

  return (
    <section className="card grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2>Abstenção</h2>
        <span className="hint">{nat2 ? `nas secções apuradas (${pct(pctNat, 0)})` : 'aparece com a contagem'}</span>
      </div>
      <div className="abstencao-corpo">
        <div className="taxas">
          <Taxa label="Abstenção" r1={nat1?.abstencao} r2={nat2?.abstencao} />
          <Taxa label="Brancos" r1={nat1?.brancos} r2={nat2?.brancos} />
          <Taxa label="Nulos" r1={nat1?.nulos} r2={nat2?.nulos} />
        </div>
        {moved && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Lista titulo="Onde mais subiu" rows={up} />
            <Lista titulo="Onde mais desceu" rows={down} />
          </div>
        )}
      </div>
      {moved && <p className="hint">Cor do estado: quem lá ganhou na 1.ª volta. Mais abstenção num estado tira-lhe peso.</p>}
    </section>
  );
}

function Lista({ titulo, rows }: { titulo: string; rows: { r: Race; d: number; now: number }[] }) {
  return (
    <div>
      <h3 className="font-bold mb-1 text-sm">{titulo}</h3>
      {rows.length ? (
        <ol className="grid gap-1 text-sm">
          {rows.map(({ r, d, now }) => (
            <li key={r.uf} className="flex justify-between gap-2">
              <span className={`font-semibold c-${r1Leader(r)}`}>{ufName(r.uf)}</span>
              <span>
                {pct(now, 1)} <span className="hint">({pp(d)})</span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="hint">Em nenhum estado.</p>
      )}
    </div>
  );
}
