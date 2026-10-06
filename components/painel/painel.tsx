'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Notice, Snapshot } from '@/lib/types';
import { Duelo } from './duelo';
import { Evolucao } from './evolucao';
import { Mapa } from './mapa';
import { Placar, Crescimento, DetalheEstado, Governadores } from './estados';
import { Avisos } from './avisos';
import { Arquivo } from './arquivo';
import { compact, countdown, pct, timeBrasilia, timeLisbon, FLAVIO } from './format';

const read = (k: string) => {
  try {
    return localStorage.getItem('varrendo.' + k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem('varrendo.' + k, v);
  } catch {}
};

export default function Painel({ initial }: { initial: Snapshot | null }) {
  const [data, setData] = useState<Snapshot | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [uf, setUf] = useState('SP');
  const [now, setNow] = useState(initial?.serverNow ?? 0);
  const [toast, setToast] = useState<Notice | null>(null);
  const [alerts, setAlerts] = useState(true);
  const [party, setParty] = useState<'flavio' | 'lula' | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const skew = useRef(0);

  // Preferências guardadas no browser: só existem no cliente, por isso são lidas depois da hidratação.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setUf(read('estado') ?? 'SP');
    setAlerts(read('avisos') !== '0');
    setNow(Date.now() + skew.current);
    /* eslint-enable react-hooks/set-state-in-effect */
    const t = setInterval(() => setNow(Date.now() + skew.current), 1000);
    return () => clearInterval(t);
  }, []);

  const select = useCallback((next: string) => {
    setUf(next);
    write('estado', next);
  }, []);

  // Avisos novos: mostrados uma vez (toast + notificação do sistema, se autorizada).
  useEffect(() => {
    if (!data) return;
    if (!seen.current) {
      seen.current = new Set(JSON.parse(read('vistos') ?? '[]'));
      if (!seen.current.size) data.events.forEach((e) => seen.current!.add(e.id));
    }
    const fresh = data.events.filter((e) => !seen.current!.has(e.id));
    fresh.forEach((e) => seen.current!.add(e.id));
    write('vistos', JSON.stringify([...seen.current].slice(-500)));
    // Prioridade do destaque: Presidente eleito > outros eleitos > Brasil > restantes.
    const rank = (e: Notice) => (e.kind === 'eleito' ? 2 : 0) + (e.key === data.national.key ? 1 : 0) + (e.kind === 'eleito' && e.key === data.national.key ? 4 : 0);
    const top = fresh.sort((a, b) => rank(b) - rank(a))[0];
    if (!top || !alerts) return;
    setToast(top);
    if (top.kind === 'eleito' && top.key === data.national.key) setParty(top.winner === FLAVIO ? 'flavio' : 'lula');
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(top.title, { body: top.detail, icon: '/favicon.svg', tag: top.id });
      } catch {}
    }
    navigator.vibrate?.(top.tone === 'good' ? [80, 60, 80] : 120);
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [data, alerts]);

  // Atualização: 5 s durante a noite, 60 s fora dela; parada com o separador oculto.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const r = await fetch(`/api/state?uf=${encodeURIComponent(uf)}`, { cache: 'no-store' });
          if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Sem ligação');
          const next: Snapshot = await r.json();
          skew.current = next.serverNow - Date.now();
          setData(next);
          setError(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Sem ligação');
        }
      }
      if (!stopped) timer = setTimeout(tick, data?.active ? 5000 : 60_000);
    };
    timer = setTimeout(tick, data ? (data.active ? 5000 : 60_000) : 0);
    const wake = () => document.visibilityState === 'visible' && (clearTimeout(timer), tick());
    document.addEventListener('visibilitychange', wake);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [uf, data?.active]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) {
    return (
      <main className="wrap">
        <Cabecalho data={null} now={now} />
        <div className="card">Não foi possível ler os resultados guardados. {error}</div>
      </main>
    );
  }

  const national = data.national;
  const p = national.parsed;
  const winner = p?.winner != null ? p.cands[p.winner] : null;

  return (
    <main className="wrap">
      <Cabecalho data={data} now={now} />

      {winner && (
        <section className="card text-center" style={{ borderColor: winner.number === FLAVIO ? 'var(--flavio)' : 'var(--line)', borderWidth: 2 }}>
          {winner.number === FLAVIO ? (
            <>
              <div className="text-2xl font-extrabold c-flavio">FLÁVIO BOLSONARO ELEITO PRESIDENTE!</div>
              <div className="hint">Resultado oficial do TSE · {pct(winner.pct, 2)} dos votos válidos</div>
            </>
          ) : (
            <>
              <div className="text-xl font-bold">Lula foi eleito Presidente pelo TSE.</div>
              <div className="hint">Resultado oficial · Flávio Bolsonaro com {pct(p!.cands[0].pct, 2)} dos votos válidos</div>
            </>
          )}
        </section>
      )}

      <section className="card" aria-labelledby="t-pres">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 id="t-pres">Presidente · Brasil</h2>
            <p className="hint">Flávio Bolsonaro (PL, 22) × Lula (PT, 13)</p>
          </div>
          <figure className="text-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.mood.src} alt={`Boneco: ${data.mood.label}`} width={72} height={72} />
            <figcaption className="hint font-semibold">{data.mood.label}</figcaption>
          </figure>
        </div>
        <Duelo race={national} now={now} />
        {data.phase === 'antes' && (
          <p className="mt-3 rounded-xl p-3 text-sm" style={{ background: 'var(--soft)' }}>
            As urnas fecham às <b>{timeLisbon(data.pollsCloseAt)} em Lisboa</b> ({timeBrasilia(data.pollsCloseAt)} em Brasília), domingo, 25 de outubro.
            {now < data.pollsCloseAt && <> Faltam <b>{countdown(data.pollsCloseAt, now)}</b>.</>}
          </p>
        )}
      </section>

      {data.toFlip && p && p.pctSections > 0 && <ParaVirar data={data} />}

      {data.timeline.length > 0 && (
        <section className="card">
          <h2>Evolução da noite</h2>
          <Evolucao data={data} />
        </section>
      )}

      <section className="card grid gap-3">
        <h2>Estados</h2>
        <Placar score={data.score} />
        <Mapa states={data.states} selected={uf} onSelect={select} />
      </section>

      <section className="card">
        <h2 className="mb-2">Detalhe do estado</h2>
        <DetalheEstado data={data} uf={uf} onSelect={select} now={now} />
      </section>

      <section className="card">
        <h2 className="mb-2">Face à 1.ª volta</h2>
        <Crescimento states={data.states} onSelect={select} />
      </section>

      <section className="card">
        <h2 className="mb-2">Avisos</h2>
        <Avisos events={data.events} corrections={data.corrections} />
      </section>

      <details className="card">
        <summary>Governadores (7 estados)</summary>
        <div className="mt-3">
          <Governadores data={data} now={now} />
        </div>
      </details>

      <details className="card">
        <summary>Arquivo da 1.ª volta</summary>
        <div className="mt-3">
          <Arquivo />
        </div>
      </details>

      <Rodape data={data} alerts={alerts} setAlerts={(v) => (setAlerts(v), write('avisos', v ? '1' : '0'))} error={error} />

      {toast && (
        <div role="status" className="toast" style={{ background: toast.tone === 'good' ? 'var(--flavio)' : toast.tone === 'bad' ? 'var(--lula)' : '#333' }}
          onClick={() => setToast(null)}>
          <div className="font-bold">{toast.title}</div>
          <div className="text-sm opacity-90">{toast.detail}</div>
        </div>
      )}
      {party === 'flavio' && <Confetes onDone={() => setParty(null)} />}
    </main>
  );
}

function Cabecalho({ data, now }: { data: Snapshot | null; now: number }) {
  const phase = data?.phase ?? 'antes';
  const label = data?.paused
    ? 'Recolha em pausa'
    : phase === 'antes'
      ? 'Antes do fecho das urnas'
      : phase === 'apuramento'
        ? 'Apuramento em curso'
        : 'Encerrado';
  return (
    <header className="flex flex-wrap items-end justify-between gap-2 pt-2">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Varrendo a <span className="c-lula">Esquerda</span>
        </h1>
        <p className="hint font-semibold">
          2.ª volta · <span className="c-flavio">Flávio 22</span> × <span className="c-lula">Lula 13</span>
        </p>
      </div>
      <div className="grid justify-items-start sm:justify-items-end gap-1">
        <span className={`pill ${phase === 'apuramento' && data?.active ? 'live' : ''}`}>{label}</span>
        {now > 0 && (
          <span className="hint">
            <b>{timeLisbon(now, true)}</b> Lisboa · {timeBrasilia(now)} Brasília
          </span>
        )}
      </div>
    </header>
  );
}

function ParaVirar({ data }: { data: Snapshot }) {
  const f = data.toFlip!;
  const flavioBehind = f.trailing === 0;
  const who = flavioBehind ? 'O Flávio' : 'O Lula';
  let text: string;
  if (f.impossible || f.needPct == null) text = `${who} já não tem votos suficientes por apurar para virar.`;
  else text = `${who} ${flavioBehind ? 'precisa' : 'precisaria'} de ~${pct(f.needPct, 1)} dos votos que faltam apurar para virar.`;
  const hard = !f.impossible && (f.needPct ?? 0) > 60;
  return (
    <section className="card" style={{ borderLeft: `5px solid ${flavioBehind ? 'var(--lula)' : 'var(--flavio)'}` }}>
      <div className="flex items-center justify-between gap-2">
        <h2>Para virar</h2>
        <span className="tag">estimativa · não oficial</span>
      </div>
      <p className="font-semibold mt-1">
        {text} {hard && <span className="hint">(muito difícil)</span>}
      </p>
      <p className="hint mt-1">
        Faltam ~{compact(f.remaining)} votos válidos, estimados com os votos válidos da 1.ª volta nas secções de cada estado ainda por apurar.
      </p>
    </section>
  );
}

function Rodape({ data, alerts, setAlerts, error }: { data: Snapshot; alerts: boolean; setAlerts: (v: boolean) => void; error: string | null }) {
  const [perm, setPerm] = useState<string>('default');
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setPerm(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission), []);
  return (
    <footer className="card grid gap-3 text-sm">
      {error && <p className="c-lula font-semibold">Sem ligação ao site: {error}. A mostrar os últimos dados recebidos.</p>}
      {data.collector.pauseUntil > data.serverNow && (
        <p className="c-lula">O TSE pediu uma pausa; nova consulta às {timeLisbon(data.collector.pauseUntil)}.</p>
      )}
      <label className="flex items-center gap-3 min-h-[44px]">
        <input type="checkbox" className="size-5" checked={alerts} onChange={(e) => setAlerts(e.target.checked)} />
        Mostrar avisos no ecrã
      </label>
      {perm === 'default' && (
        <button className="btn" onClick={() => Notification.requestPermission().then(setPerm)}>
          Ativar notificações do sistema (com a página aberta)
        </button>
      )}
      <p className="hint">
        Dados: Tribunal Superior Eleitoral (eleições {data.ids.federal} e {data.ids.estadual}
        {data.ids.confirmedAt ? ', confirmadas na configuração oficial' : ', a confirmar na configuração oficial'}). Vitória só com indicação
        oficial do TSE. Os agrupamentos “direita/esquerda” são critério do{' '}
        <a className="underline" href="https://github.com/ODevLibertario/varrendo-a-esquerda">projeto original</a>, não do TSE.
      </p>
      <p className="hint">
        Durante a noite os dados atualizam-se a cada 5 s com a página aberta; o TSE é consultado no máximo a cada 15 s (Brasil e estado
        escolhido) ou 45 s (restantes).
      </p>
    </footer>
  );
}

function Confetes({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 7000);
    return () => clearTimeout(t);
  }, [onDone]);
  const colors = ['#009c3b', '#ffdf00', '#002776', '#ffffff'];
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 120 }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: colors[i % colors.length],
            animationDuration: `${3 + (i % 7) * 0.5}s`,
            animationDelay: `${(i % 13) * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}
