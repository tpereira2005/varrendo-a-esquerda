'use client';
import { useState } from 'react';
import type { Notice } from '@/lib/types';
import { timeLisbon } from './format';

const LIMIT = 8;
const TONE = { good: 'var(--good)', bad: 'var(--bad)', neutral: 'var(--muted)' } as const;
const ICON: Record<Notice['kind'], string> = { virada: '⇅', marco: '%', estado: '✓', 'estado-virou': '↻', eleito: '★' };

export function Avisos({ events, corrections }: { events: Notice[]; corrections: Notice[] }) {
  const [all, setAll] = useState(false);
  // Mais recentes primeiro; à mesma hora, o resultado do Presidente vem à frente.
  const weight = (e: Notice) => (e.kind === 'eleito' ? (e.uf === 'BR' ? 2 : 1) : 0);
  const sorted = [...events].sort((a, b) => (b.at ?? b.noticedAt) - (a.at ?? a.noticedAt) || weight(b) - weight(a));
  const list = all ? sorted : sorted.slice(0, LIMIT);
  if (!list.length && !corrections.length) {
    return <p className="hint">Viradas, marcos do apuramento, estados decididos e o resultado oficial vão aparecer aqui.</p>;
  }
  return (
    <div className="grid gap-2">
      <ul className="lista-avisos grid gap-2">
        {list.map((e) => (
          <li key={e.id} className="aviso">
            <span className="aviso-icone" style={{ background: TONE[e.tone] }} aria-hidden="true">
              {ICON[e.kind]}
            </span>
            <div>
              <div className="font-bold leading-snug" style={{ color: e.tone === 'neutral' ? undefined : TONE[e.tone] }}>
                {e.title}
              </div>
              <div className="hint">
                {e.detail} · {timeLisbon(e.at ?? e.noticedAt)}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {sorted.length > LIMIT && (
        <button className="btn" onClick={() => setAll(!all)}>
          {all ? 'Mostrar só os mais recentes' : `Mostrar todos (${sorted.length})`}
        </button>
      )}
      {corrections.length > 0 && (
        <details>
          <summary className="text-sm">Correções do TSE ({corrections.length})</summary>
          <ul className="grid gap-1">
            {corrections.map((e) => (
              <li key={e.id} className="hint">
                <s>{e.title}</s> · retirado às {timeLisbon(e.noticedAt)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
