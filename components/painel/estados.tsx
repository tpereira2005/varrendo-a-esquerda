'use client';
import type { Race, Snapshot, Turnout } from '@/lib/types';
import { taxas } from './abstencao';
import { UF_NAMES } from '@/lib/tse.mjs';
import { Duelo } from './duelo';
import { Numero } from './numero';
import { stateView } from './mapa';
import { int, pct, pp } from './format';

const ufName = (uf: string) => UF_NAMES[uf as keyof typeof UF_NAMES];

/** Quota do 1.º finalista na 1.ª volta contando só os dois (comparável com a 2.ª volta). */
export const r1Share = (r: Race) => (100 * r.finalists[0].r1Votes) / (r.finalists[0].r1Votes + r.finalists[1].r1Votes);

export function Placar({ score }: { score: Snapshot['score'] }) {
  const tiles = [
    { n: score.flavio, label: 'Flávio vence', cls: 'tile-flavio' },
    { n: score.lula, label: 'Lula vence', cls: 'tile-lula' },
    { n: score.pending, label: 'por apurar', cls: 'tile-neutro' },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      {tiles.map((t) => (
        <div key={t.label} className={`tile ${t.cls}`}>
          <Numero value={t.n} format={(v) => String(Math.round(v))} className="tile-n" />
          <div className="tile-label">{t.label}</div>
        </div>
      ))}
    </div>
  );
}

type Swing = { uf: string; swing: number };

function Ranking({ rows, k, onSelect }: { rows: Swing[]; k: 'flavio' | 'lula'; onSelect: (uf: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.swing)));
  return (
    <ol className="grid gap-1">
      {rows.map((r) => (
        <li key={r.uf}>
          <button className="ranking-linha" onClick={() => onSelect(r.uf)}>
            <span>{ufName(r.uf)}</span>
            <span className="ranking-barra" aria-hidden="true">
              <span className={`bg-${k}`} style={{ width: `${(100 * Math.abs(r.swing)) / max}%` }} />
            </span>
            <span className={`font-semibold c-${k} text-right`}>{pp(Math.abs(r.swing))}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/**
 * Deslocação de votos face à 1.ª volta: quota do Flávio entre os dois finalistas, antes e agora.
 * (Comparar com a percentagem da 1.ª volta entre todos os candidatos faria os dois "crescerem" sempre.)
 */
export function Crescimento({ states, onSelect }: { states: Race[]; onSelect: (uf: string) => void }) {
  const rows = states
    .filter((r) => r.parsed && r.parsed.cands[0].votes + r.parsed.cands[1].votes > 0)
    .map((r) => ({ uf: r.uf, swing: r.parsed!.cands[0].pct - r1Share(r) }));
  if (!rows.length) return <p className="hint">Aparece quando houver votos nos estados.</p>;
  const flavio = rows.filter((r) => r.swing > 0).sort((x, y) => y.swing - x.swing).slice(0, 5);
  const lula = rows.filter((r) => r.swing < 0).sort((x, y) => x.swing - y.swing).slice(0, 5);
  return (
    <div className="grid sm:grid-cols-2 gap-5">
      <div>
        <h3 className="font-bold c-flavio mb-1">Onde o Flávio ganhou terreno</h3>
        {flavio.length ? <Ranking rows={flavio} k="flavio" onSelect={onSelect} /> : <p className="hint">Ainda em nenhum estado.</p>}
      </div>
      <div>
        <h3 className="font-bold c-lula mb-1">Onde o Lula ganhou terreno</h3>
        {lula.length ? <Ranking rows={lula} k="lula" onSelect={onSelect} /> : <p className="hint">Ainda em nenhum estado.</p>}
      </div>
      <p className="hint sm:col-span-2">
        Face à 1.ª volta, contando só os dois finalistas.
      </p>
    </div>
  );
}

function TurnoutRow({ label, r1, r2 }: { label: string; r1: number | null | undefined; r2: number | null | undefined }) {
  return (
    <tr className="border-t" style={{ borderColor: 'var(--line)' }}>
      <td className="py-1">{label}</td>
      <td className="text-right">{pct(r1)}</td>
      <td className="text-right">{r2 == null ? '—' : pct(r2)}</td>
    </tr>
  );
}

/** Participação no estado. Na 2.ª volta, só sobre as secções já apuradas (ver taxas). */
export function Participacao({ r1, r2 }: { r1: Turnout; r2: Turnout | undefined }) {
  const t1 = taxas(r1);
  const t2 = taxas(r2);
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
        <TurnoutRow label="Abstenção" r1={t1?.abstencao} r2={t2?.abstencao} />
        <TurnoutRow label="Brancos" r1={t1?.brancos} r2={t2?.brancos} />
        <TurnoutRow label="Nulos" r1={t1?.nulos} r2={t2?.nulos} />
      </tbody>
    </table>
  );
}

export function DetalheEstado({ data, uf, onSelect }: { data: Snapshot; uf: string; onSelect: (uf: string) => void }) {
  const race = data.states.find((r) => r.uf === uf) ?? data.states[0];
  const gov = data.governors.find((r) => r.uf === race.uf);
  const v = stateView(race);
  const share1 = r1Share(race);
  const p = race.parsed;
  const counted = p && p.cands[0].votes + p.cands[1].votes > 0;
  const swing = counted ? p!.cands[0].pct - share1 : null;
  return (
    <div className="grid gap-4">
      <label className="grid gap-1">
        <span className="hint">Escolher estado (ou tocar no mapa)</span>
        <select className="btn" value={race.uf} onChange={(e) => onSelect(e.target.value)}>
          {data.states.map((r) => (
            <option key={r.uf} value={r.uf}>
              {ufName(r.uf)} · {r.uf}
            </option>
          ))}
        </select>
      </label>
      <div>
        <h3 className="font-bold mb-2 flex items-center gap-2">
          Presidente {v.flipped && <span className="tag tag-ouro">virou face à 1.ª volta</span>}
        </h3>
        <Duelo race={race} />
        <p className="hint mt-2">
          1.ª volta, só os dois: Flávio {pct(share1, 1)} · Lula {pct(100 - share1, 1)} ({int(race.finalists[0].r1Votes)} ×{' '}
          {int(race.finalists[1].r1Votes)} votos)
          {swing != null && (
            <>
              {' '}
              · deslocação: <b className={swing >= 0 ? 'c-flavio' : 'c-lula'}>{swing >= 0 ? 'Flávio' : 'Lula'} {pp(Math.abs(swing))}</b>
            </>
          )}
        </p>
      </div>
      {gov && (
        <div>
          <h3 className="font-bold mb-2 flex items-center gap-2">Governador {gov.internal && <span className="tag">duelo interno</span>}</h3>
          <Duelo race={gov} />
        </div>
      )}
      <Participacao r1={race.r1} r2={race.parsed?.turnout} />
    </div>
  );
}

export function Governadores({ data }: { data: Snapshot }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {data.governors.map((g) => (
        <div key={g.uf}>
          <h3 className="font-bold mb-2 flex items-center gap-2">
            {ufName(g.uf)}
            {g.internal && <span className="tag">duelo interno</span>}
          </h3>
          <Duelo race={g} />
        </div>
      ))}
      <p className="hint lg:col-span-2">
        “Duelo interno”: os dois finalistas pertencem ao mesmo agrupamento do autor original, por isso não contam para nenhum lado.
      </p>
    </div>
  );
}
