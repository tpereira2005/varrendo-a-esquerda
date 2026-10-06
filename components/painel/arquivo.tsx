'use client';
import { useEffect, useState } from 'react';
import type { Archive } from '@/lib/types';
import { UF_NAMES } from '@/lib/tse.mjs';
import { int, pct, titleCase } from './format';

type Row = { number: string; name: string; party: string; votes: number; pct: number; finalist?: boolean };

function Tabela({ rows }: { rows: Row[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="hint">
          <th className="text-left font-normal">Candidato</th>
          <th className="text-right font-normal">Votos</th>
          <th className="text-right font-normal">%</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => (
          <tr key={c.number} className="border-t" style={{ borderColor: 'var(--line)' }}>
            <td className="py-1">
              {titleCase(c.name)} <span className="hint">{c.party}</span>
              {c.finalist && <span className="tag ml-1">2.ª volta</span>}
            </td>
            <td className="text-right">{int(c.votes)}</td>
            <td className="text-right">{pct(c.pct, 2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PorEstado({ data }: { data: Archive }) {
  const [uf, setUf] = useState('BR');
  const race = data.president[uf];
  return (
    <div className="grid gap-3">
      <select className="btn" value={uf} onChange={(e) => setUf(e.target.value)} aria-label="Abrangência">
        {Object.keys(data.president).map((k) => (
          <option key={k} value={k}>
            {UF_NAMES[k as keyof typeof UF_NAMES]}
          </option>
        ))}
      </select>
      <Tabela rows={race.candidates.map((c) => ({ ...c, finalist: /2/.test(c.st) }))} />
      <p className="hint">Abstenção {pct(race.turnout.abstencaoPct, 2)}.</p>
    </div>
  );
}

function PorPais({ data }: { data: Archive }) {
  const ext = data.exterior;
  const [pais, setPais] = useState(ext.countries[0].pais);
  const country = ext.countries.find((c) => c.pais === pais) ?? ext.countries[0];
  const total = Object.values(country.votes).reduce((n, v) => n + v, 0);
  const rows = ext.candidates
    .map((c) => ({ ...c, votes: country.votes[c.number] ?? 0, pct: total ? (100 * (country.votes[c.number] ?? 0)) / total : 0, finalist: c.number === '22' || c.number === '13' }))
    .sort((a, b) => b.votes - a.votes);
  const two = (v: Record<string, number>) => {
    const t = (v['22'] ?? 0) + (v['13'] ?? 0);
    return t ? (100 * (v['22'] ?? 0)) / t : null;
  };
  return (
    <div className="grid gap-3">
      <select className="btn" value={country.pais} onChange={(e) => setPais(e.target.value)} aria-label="País">
        {ext.countries.map((c) => (
          <option key={c.pais} value={c.pais}>
            {c.pais}
          </option>
        ))}
      </select>
      <Tabela rows={rows} />
      {country.cidades.length > 1 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="hint">
              <th className="text-left font-normal">Cidade</th>
              <th className="text-right font-normal">Votos válidos</th>
              <th className="text-right font-normal">Flávio × Lula (só os dois)</th>
            </tr>
          </thead>
          <tbody>
            {country.cidades.map((x) => {
              const s = two(x.votes);
              return (
                <tr key={x.cd} className="border-t" style={{ borderColor: 'var(--line)' }}>
                  <td className="py-1">{x.cidade}</td>
                  <td className="text-right">{int(Object.values(x.votes).reduce((n, v) => n + v, 0))}</td>
                  <td className="text-right">
                    {s == null ? '—' : (
                      <>
                        <span className="c-flavio">{pct(s, 1)}</span> × <span className="c-lula">{pct(100 - s, 1)}</span>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="hint">{ext.source}. País atribuído pela cidade do posto consular.</p>
    </div>
  );
}

/** Resultados finais da 1.ª volta, lidos do ficheiro congelado (nunca do TSE). */
export function Arquivo() {
  const [data, setData] = useState<Archive | null>(null);
  const [tab, setTab] = useState<'estado' | 'pais'>('estado');
  const [error, setError] = useState(false);
  useEffect(() => {
    // A versão no endereço evita usar uma cópia antiga guardada pelo browser (a resposta fica em cache 1 h).
    fetch('/api/arquivo?v=2')
      .then((r) => (r.ok ? (r.json() as Promise<Archive>) : Promise.reject()))
      .then((d: Archive) => setData(d))
      .catch(() => setError(true));
  }, []);
  if (error) return <p className="hint">Não foi possível abrir o arquivo.</p>;
  if (!data) return <p className="hint">A abrir o arquivo…</p>;
  return (
    <div className="grid gap-3">
      <div className="separadores" role="tablist">
        <button role="tab" aria-selected={tab === 'estado'} onClick={() => setTab('estado')}>
          Brasil e estados
        </button>
        <button role="tab" aria-selected={tab === 'pais'} onClick={() => setTab('pais')}>
          Estrangeiro por país
        </button>
      </div>
      {tab === 'estado' || !data.exterior ? <PorEstado data={data} /> : <PorPais data={data} />}
      <p className="hint">{data.source}.</p>
    </div>
  );
}
