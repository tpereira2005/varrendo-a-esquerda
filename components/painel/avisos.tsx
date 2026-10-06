import type { Notice } from '@/lib/types';
import { timeLisbon } from './format';

const TONE = { good: 'var(--good)', bad: 'var(--bad)', neutral: 'var(--muted)' } as const;

export function Avisos({ events, corrections }: { events: Notice[]; corrections: Notice[] }) {
  const list = [...events].sort((a, b) => (b.at ?? b.noticedAt) - (a.at ?? a.noticedAt));
  if (!list.length && !corrections.length) {
    return <p className="hint">Viradas, marcos do apuramento, estados decididos e o resultado oficial vão aparecer aqui.</p>;
  }
  return (
    <div className="grid gap-2">
      <ul className="grid gap-2">
        {list.map((e) => (
          <li key={e.id} className="rounded-xl p-3" style={{ background: 'var(--soft)', borderLeft: `5px solid ${TONE[e.tone]}` }}>
            <div className="font-bold" style={{ color: e.tone === 'neutral' ? undefined : TONE[e.tone] }}>{e.title}</div>
            <div className="hint">
              {e.detail} · {timeLisbon(e.at ?? e.noticedAt)}
            </div>
          </li>
        ))}
      </ul>
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
