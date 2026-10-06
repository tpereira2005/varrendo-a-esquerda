'use client';
import { useEffect, useState } from 'react';
import type { Archive } from '@/lib/types';
import { UF_NAMES } from '@/lib/tse.mjs';
import { int, pct, titleCase } from './format';

/** Resultados finais da 1.ª volta, lidos do ficheiro congelado (nunca do TSE). */
export function Arquivo() {
  const [data, setData] = useState<Archive | null>(null);
  const [uf, setUf] = useState('BR');
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch('/api/arquivo')
      .then((r) => (r.ok ? (r.json() as Promise<Archive>) : Promise.reject()))
      .then((d: Archive) => setData(d))
      .catch(() => setError(true));
  }, []);
  if (error) return <p className="hint">Não foi possível abrir o arquivo.</p>;
  if (!data) return <p className="hint">A abrir o arquivo…</p>;
  const race = data.president[uf];
  return (
    <div className="grid gap-3">
      <select className="btn" value={uf} onChange={(e) => setUf(e.target.value)} aria-label="Abrangência">
        {Object.keys(data.president).map((k) => (
          <option key={k} value={k}>{UF_NAMES[k as keyof typeof UF_NAMES]}</option>
        ))}
      </select>
      <table className="w-full text-sm">
        <thead>
          <tr className="hint">
            <th className="text-left font-normal">Candidato</th>
            <th className="text-right font-normal">Votos</th>
            <th className="text-right font-normal">%</th>
          </tr>
        </thead>
        <tbody>
          {race.candidates.map((c) => (
            <tr key={c.number} className="border-t" style={{ borderColor: 'var(--line)' }}>
              <td className="py-1">
                {titleCase(c.name)} <span className="hint">{c.party}</span>
                {/2/.test(c.st) && <span className="tag ml-1">2.ª volta</span>}
              </td>
              <td className="text-right">{int(c.votes)}</td>
              <td className="text-right">{pct(c.pct, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        Abstenção {pct(race.turnout.abstencaoPct, 2)} · {data.source}.
      </p>
    </div>
  );
}
