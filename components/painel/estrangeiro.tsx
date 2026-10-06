'use client';
import { useState } from 'react';
import type { ExteriorCountry, Snapshot } from '@/lib/types';
import { Duelo } from './duelo';
import { ago, int, pct, pp } from './format';

const PORTUGAL = 'Portugal';
const LIMIT = 12;

/** Barra Flávio × Lula com as percentagens; cinzenta enquanto não houver votos. */
function MiniDuelo({ flavio, lula, r1 }: { flavio: number; lula: number; r1?: { flavio: number; lula: number } | null }) {
  const total = flavio + lula;
  const ref = !total && r1 ? r1 : null;
  const a = ref ? ref.flavio : flavio;
  const b = ref ? ref.lula : lula;
  const share = a + b ? (100 * a) / (a + b) : 50;
  return (
    <div className={`mini-duelo ${ref ? 'referencia' : ''}`}>
      <span className="c-flavio">{a + b ? pct(share, 1) : '—'}</span>
      <span className={`barra-duelo fina ${ref ? 'referencia' : ''}`}>
        <span className="bg-flavio" style={{ width: `${share}%` }} />
        <span className="bg-lula" style={{ width: `${100 - share}%` }} />
        <i className="meta-50" />
      </span>
      <span className="c-lula">{a + b ? pct(100 - share, 1) : '—'}</span>
    </div>
  );
}

function Pais({ c, open, toggle }: { c: ExteriorCountry; open: boolean; toggle: () => void }) {
  const total = c.flavio + c.lula;
  const r1Share = c.r1 && c.r1.flavio + c.r1.lula ? (100 * c.r1.flavio) / (c.r1.flavio + c.r1.lula) : null;
  const swing = total && r1Share != null ? (100 * c.flavio) / total - r1Share : null;
  return (
    <li className="ext-pais">
      <button className="ext-linha" onClick={toggle} aria-expanded={open}>
        <span className="ext-nome">
          <span className="ext-seta" aria-hidden="true">{open ? '▾' : '▸'}</span>
          {c.pais}
        </span>
        <MiniDuelo flavio={c.flavio} lula={c.lula} r1={c.r1} />
        <span className="ext-info">
          {total ? `${int(total)} votos` : '1.ª volta'}
          {c.sections > 0 && ` · ${int(c.counted)}/${int(c.sections)} secções`}
        </span>
        <span className={`ext-desloc ${swing == null ? '' : swing >= 0 ? 'c-flavio' : 'c-lula'}`}>
          {swing == null ? '' : `${swing >= 0 ? 'Flávio' : 'Lula'} ${pp(Math.abs(swing))}`}
        </span>
      </button>
      {open && (
        <ul className="ext-cidades">
          {c.cidades.map((x) => (
            <li key={x.cidade} className="ext-cidade">
              <span>{x.cidade}</span>
              <MiniDuelo flavio={x.flavio} lula={x.lula} r1={x.r1} />
              <span className="hint">{x.has ? `${int(x.flavio + x.lula)} votos · ${pct(x.pctSections, 0)} apurado` : 'sem votos ainda'}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** Voto no estrangeiro ao vivo: total oficial e cada país (Portugal no topo), com as cidades. */
export function Estrangeiro({ data, now }: { data: Snapshot; now: number }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set([PORTUGAL]));
  const [all, setAll] = useState(false);
  const [q, setQ] = useState('');
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const list = data.exterior.countries.filter((c) => !q || norm(c.pais).includes(norm(q)) || c.cidades.some((x) => norm(x.cidade).includes(norm(q))));
  const shown = all || q ? list : list.slice(0, LIMIT);
  const toggle = (pais: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(pais)) n.delete(pais);
      else n.add(pais);
      return n;
    });
  return (
    <section className="card grid gap-4" aria-labelledby="t-ext">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="t-ext">Voto no estrangeiro</h2>
        <span className="hint">186 cidades com consulado em 133 países{data.exterior.checkedAt ? ` · lido ${ago(data.exterior.checkedAt, now)}` : ''}</span>
      </div>
      <Duelo race={data.exterior.race} />
      <div className="grid gap-2">
        <input className="btn ext-procura" type="search" placeholder="Procurar país ou cidade…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Procurar país ou cidade" />
        <div className="ext-cabecalho hint" aria-hidden="true">
          <span>País</span>
          <span>Flávio × Lula</span>
          <span>Votos e secções</span>
          <span>Face à 1.ª volta</span>
        </div>
        <ul className="grid gap-1">
          {shown.map((c) => (
            <Pais key={c.pais} c={c} open={open.has(c.pais)} toggle={() => toggle(c.pais)} />
          ))}
        </ul>
        {!q && list.length > LIMIT && (
          <button className="btn" onClick={() => setAll(!all)}>
            {all ? 'Mostrar só os principais' : `Mostrar todos os países (${list.length})`}
          </button>
        )}
      </div>
      <p className="hint">
        Antes de haver votos, a barra mostra a 1.ª volta entre os dois (a tracejado). Toca num país para ver as cidades. Portugal aparece sempre primeiro.
      </p>
    </section>
  );
}
