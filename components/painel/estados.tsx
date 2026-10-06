import type { Race, Snapshot, Turnout } from '@/lib/types';
import { UF_NAMES } from '@/lib/tse.mjs';
import { Duelo } from './duelo';
import { stateView } from './mapa';
import { int, pct, pp } from './format';

export function Placar({ score }: { score: Snapshot['score'] }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className="rounded-xl p-2" style={{ background: 'var(--flavio-soft)' }}>
        <div className="text-3xl font-extrabold c-flavio">{score.flavio}</div>
        <div className="hint">Flávio vence</div>
      </div>
      <div className="rounded-xl p-2" style={{ background: 'var(--lula-soft)' }}>
        <div className="text-3xl font-extrabold c-lula">{score.lula}</div>
        <div className="hint">Lula vence</div>
      </div>
      <div className="rounded-xl p-2" style={{ background: 'var(--soft)' }}>
        <div className="text-3xl font-extrabold">{score.pending}</div>
        <div className="hint">por apurar</div>
      </div>
    </div>
  );
}

type Growth = { uf: string; flavio: number; lula: number };

function Ranking({ rows, k, onSelect }: { rows: Growth[]; k: 'flavio' | 'lula'; onSelect: (uf: string) => void }) {
  return (
    <ol className="grid gap-1">
      {rows.map((r) => (
        <li key={r.uf}>
          <button className="w-full flex justify-between gap-2 text-left min-h-[36px]" onClick={() => onSelect(r.uf)}>
            <span>{UF_NAMES[r.uf as keyof typeof UF_NAMES]}</span>
            <span className={`font-semibold c-${k}`}>{pp(r[k])}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/** Variação da percentagem de cada finalista face à 1.ª volta, nos estados com votos. */
export function Crescimento({ states, onSelect }: { states: Race[]; onSelect: (uf: string) => void }) {
  const rows = states
    .filter((r) => r.parsed && r.parsed.cands[0].votes + r.parsed.cands[1].votes > 0)
    .map((r) => ({
      uf: r.uf,
      flavio: r.parsed!.cands[0].pct - r.finalists[0].r1Pct,
      lula: r.parsed!.cands[1].pct - r.finalists[1].r1Pct,
      pctSections: r.parsed!.pctSections,
    }));
  if (!rows.length) return <p className="hint">Aparece quando houver votos nos estados.</p>;
  const top = (k: 'flavio' | 'lula') => [...rows].sort((x, y) => y[k] - x[k]).slice(0, 5);
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div>
        <h3 className="font-bold c-flavio mb-1">Onde o Flávio mais cresceu</h3>
        <Ranking rows={top('flavio')} k="flavio" onSelect={onSelect} />
      </div>
      <div>
        <h3 className="font-bold c-lula mb-1">Onde o Lula mais cresceu</h3>
        <Ranking rows={top('lula')} k="lula" onSelect={onSelect} />
      </div>
      <p className="hint sm:col-span-2">
        Diferença entre a percentagem na 2.ª volta (votos válidos, apuramento em curso) e a da 1.ª volta.
      </p>
    </div>
  );
}

function TurnoutRow({ label, r1, r2, base1, base2 }: { label: string; r1: number | null; r2: number | null; base1: number | null; base2: number | null }) {
  const p1 = r1 != null && base1 ? (100 * r1) / base1 : null;
  const p2 = r2 != null && base2 ? (100 * r2) / base2 : null;
  return (
    <tr className="border-t" style={{ borderColor: 'var(--line)' }}>
      <td className="py-1">{label}</td>
      <td className="text-right">{pct(p1)}</td>
      <td className="text-right">{p2 == null ? '—' : pct(p2)}</td>
    </tr>
  );
}

export function Participacao({ r1, r2 }: { r1: Turnout; r2: Turnout | undefined }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="hint">
          <th className="text-left font-normal">Participação</th>
          <th className="text-right font-normal">1.ª volta</th>
          <th className="text-right font-normal">2.ª volta</th>
        </tr>
      </thead>
      <tbody>
        <TurnoutRow label="Abstenção" r1={r1.abstencao} r2={r2?.abstencao ?? null} base1={r1.eleitores} base2={r2?.eleitores ?? null} />
        <TurnoutRow label="Brancos" r1={r1.brancos} r2={r2?.brancos ?? null} base1={r1.comparecimento} base2={r2?.comparecimento ?? null} />
        <TurnoutRow label="Nulos" r1={r1.nulos} r2={r2?.nulos ?? null} base1={r1.comparecimento} base2={r2?.comparecimento ?? null} />
      </tbody>
    </table>
  );
}

export function DetalheEstado({ data, uf, onSelect, now }: { data: Snapshot; uf: string; onSelect: (uf: string) => void; now: number }) {
  const race = data.states.find((r) => r.uf === uf) ?? data.states[0];
  const gov = data.governors.find((r) => r.uf === race.uf);
  const v = stateView(race);
  return (
    <div className="grid gap-4">
      <label className="grid gap-1">
        <span className="hint">Escolher estado</span>
        <select className="btn" value={race.uf} onChange={(e) => onSelect(e.target.value)}>
          {data.states.map((r) => (
            <option key={r.uf} value={r.uf}>
              {UF_NAMES[r.uf as keyof typeof UF_NAMES]} · {r.uf}
            </option>
          ))}
        </select>
      </label>
      <div>
        <h3 className="font-bold mb-2">Presidente {v.flipped && <span className="tag" style={{ background: 'var(--gold)', color: '#111' }}>virou</span>}</h3>
        <Duelo race={race} now={now} size="small" />
        <p className="hint mt-2">
          1.ª volta neste estado: Flávio {pct(race.finalists[0].r1Pct, 2)} ({int(race.finalists[0].r1Votes)}) · Lula{' '}
          {pct(race.finalists[1].r1Pct, 2)} ({int(race.finalists[1].r1Votes)})
        </p>
      </div>
      {gov && (
        <div>
          <h3 className="font-bold mb-2">
            Governador {gov.internal && <span className="tag">duelo interno</span>}
          </h3>
          <Duelo race={gov} now={now} size="small" />
        </div>
      )}
      <Participacao r1={race.r1} r2={race.parsed?.turnout} />
    </div>
  );
}

export function Governadores({ data, now }: { data: Snapshot; now: number }) {
  return (
    <div className="grid gap-5">
      {data.governors.map((g) => (
        <div key={g.uf}>
          <h3 className="font-bold mb-2 flex items-center gap-2">
            {UF_NAMES[g.uf as keyof typeof UF_NAMES]}
            {g.internal && <span className="tag">duelo interno</span>}
          </h3>
          <Duelo race={g} now={now} size="small" />
        </div>
      ))}
      <p className="hint">
        “Duelo interno”: os dois finalistas pertencem ao mesmo agrupamento do autor original, por isso não contam para nenhum lado.
      </p>
    </div>
  );
}
