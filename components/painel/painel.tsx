'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Notice, Snapshot } from '@/lib/types';
import { Marcador } from './marcador';
import { Evolucao } from './evolucao';
import { Mapa, stateView } from './mapa';
import { Placar, Crescimento, DetalheEstado, Governadores } from './estados';
import { Avisos } from './avisos';
import { Arquivo } from './arquivo';
import { Estrangeiro } from './estrangeiro';
import { Festejo } from './festejo';
import { Projecao, OndeFaltam } from './projecao';
import { Mercado } from './mercado';
import { Definicoes } from './definicoes';
import { useTema } from './controlos';
import { shareResult } from './partilhar';
import { chime, keepAwake, reacquireAwake, unlockAudio } from './efeitos';
import { ago, compact, pct, shortName, timeBrasilia, timeLisbon, FLAVIO } from './format';

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

/** Intervalo de atualização: rápido com a página à vista; mais lento em segundo plano (o PC continua a receber avisos). */
function pollDelay(data: Snapshot | null) {
  const hidden = typeof document !== 'undefined' && document.visibilityState !== 'visible';
  if (!data?.active) return hidden ? 300_000 : 60_000;
  return hidden ? 15_000 : 4000;
}

export default function Painel({ initial }: { initial: Snapshot | null }) {
  const [data, setData] = useState<Snapshot | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [uf, setUf] = useState('SP');
  const [now, setNow] = useState(initial?.serverNow ?? 0);
  const [toast, setToast] = useState<Notice | null>(null);
  const [alerts, setAlerts] = useState(true);
  const [sound, setSound] = useState(false);
  const [awake, setAwake] = useState(false);
  const [motion, setMotion] = useState(true);
  const [party, setParty] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const skew = useRef(0);
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Preferências guardadas no browser: só existem no cliente, por isso são lidas depois da hidratação.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setUf(read('estado') ?? 'SP');
    setAlerts(read('avisos') !== '0');
    setSound(read('som') === '1');
    setMotion(read('animacoes') !== '0');
    setNow(Date.now() + skew.current);
    /* eslint-enable react-hooks/set-state-in-effect */
    const t = setInterval(() => setNow(Date.now() + skew.current), 1000);
    // O áudio só fica disponível depois de um clique na página.
    const unlock = () => read('som') === '1' && unlockAudio();
    addEventListener('pointerdown', unlock, { once: true });
    return () => {
      clearInterval(t);
      removeEventListener('pointerdown', unlock);
    };
  }, []);

  const select = useCallback((next: string) => {
    setUf(next);
    write('estado', next);
  }, []);

  const national = data?.national;
  const p = national?.parsed ?? null;
  const winner = p?.winner != null ? p.cands[p.winner] : null;
  const festejo = winner?.number === FLAVIO;

  // Festejo em ecrã inteiro: abre uma vez por aparelho quando o TSE declara o Flávio eleito.
  useEffect(() => {
    if (!festejo || !national) return;
    const id = `${national.key}:eleito:${FLAVIO}`;
    if (read('festejo') === id) return;
    write('festejo', id);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setParty(true);
  }, [festejo, national]);

  // Título do separador (visível na barra de tarefas do Windows e nos separadores do Chrome).
  useEffect(() => {
    if (!p || p.cands[0].votes + p.cands[1].votes === 0) {
      document.title = 'Varrendo a Esquerda · 2.ª volta 2026';
      return;
    }
    const [a, b] = p.cands;
    document.title = winner
      ? winner.number === FLAVIO
        ? '🎉 FLÁVIO ELEITO! · Varrendo'
        : 'Lula eleito · Varrendo'
      : `${a.votes >= b.votes ? '▲' : '●'} ${shortName(a, 1)} ${pct(a.pct)} × ${pct(b.pct)} ${shortName(b, 1)} · ${pct(p.pctSections, 0)}`;
  }, [p, winner]);

  // Avisos novos: mostrados uma vez (toast, som e notificação do sistema, se autorizados).
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
    const rank = (e: Notice) =>
      (e.kind === 'eleito' ? 2 : 0) + (e.key === data.national.key ? 1 : 0) + (e.kind === 'eleito' && e.key === data.national.key ? 4 : 0);
    const top = fresh.sort((a, b) => rank(b) - rank(a))[0];
    if (!top || !alerts) return;
    setToast(top);
    const presidentWon = top.kind === 'eleito' && top.key === data.national.key && top.winner === FLAVIO;
    if (sound && !presidentWon) void chime(top.tone);
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      try {
        new Notification(top.title, { body: top.detail, icon: '/emoji/humor-10.png', tag: top.id });
      } catch {}
    }
    navigator.vibrate?.(top.tone === 'good' ? [80, 60, 80] : 120);
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [data, alerts, sound]);

  // Atualização contínua; ao voltar ao separador, atualiza logo.
  // O relógio que marca as atualizações corre num Web Worker: o Chrome abranda muito os temporizadores
  // de um separador escondido (até 1 por minuto), mas não os de um worker. Sem worker, usa setTimeout.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    let worker: Worker | null = null;
    try {
      const code = 'let t;onmessage=(e)=>{clearTimeout(t);t=setTimeout(()=>postMessage(0),e.data)}';
      worker = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
    } catch {
      worker = null;
    }
    const schedule = (ms: number) => {
      if (stopped) return;
      if (worker) worker.postMessage(ms);
      else timer = setTimeout(tick, ms);
    };
    if (worker) worker.onmessage = () => void tick();
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
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
      running = false;
      schedule(pollDelay(dataRef.current));
    };
    schedule(dataRef.current ? pollDelay(dataRef.current) : 0);
    const wake = () => {
      if (document.visibilityState !== 'visible') return;
      reacquireAwake();
      clearTimeout(timer);
      void tick();
    };
    document.addEventListener('visibilitychange', wake);
    return () => {
      stopped = true;
      clearTimeout(timer);
      worker?.terminate();
      document.removeEventListener('visibilitychange', wake);
    };
  }, [uf]);

  const closeParty = useCallback(() => setParty(false), []);
  const [sharing, setSharing] = useState(false);
  const share = useCallback(async () => {
    if (!data) return;
    setSharing(true);
    try {
      await shareResult(data);
    } finally {
      setSharing(false);
    }
  }, [data]);

  if (!data || !national) {
    return (
      <main className="wrap">
        <Cabecalho data={null} now={now} />
        <div className="card">Não foi possível ler os resultados guardados. {error}</div>
      </main>
    );
  }

  const leading = data.states.reduce(
    (n, r) => {
      const v = stateView(r);
      if (v.lead === 0) n.flavio++;
      else if (v.lead === 1) n.lula++;
      return n;
    },
    { flavio: 0, lula: 0 },
  );

  return (
    <main className={`wrap ${festejo ? 'modo-festejo' : ''}`}>
      <Cabecalho data={data} now={now} festejo={festejo} onShare={share} sharing={sharing} />
      <EstadoTSE data={data} now={now} error={error} />
      <BarraFixa data={data} />

      {winner &&
        (festejo ? (
          <section className="card faixa-festejo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/emoji/humor-10.png" alt="" width={84} height={84} className="shrink-0" />
            <div className="grow">
              <div className="titulo-festejo">Flávio Bolsonaro eleito Presidente!</div>
              <div className="font-semibold opacity-90">
                Resultado oficial do TSE · {pct(winner.pct, 2)} dos votos válidos · a esquerda foi varrida! 🧹
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button className="btn btn-forte" onClick={() => (sound && unlockAudio(), setParty(true))}>
                🎉 Festejar outra vez
              </button>
              <button className="btn" onClick={share} disabled={sharing}>
                {sharing ? 'A preparar…' : 'Partilhar a vitória'}
              </button>
            </div>
          </section>
        ) : (
          <section className="card text-center">
            <div className="text-xl font-bold">{shortName(winner, 1)} foi eleito Presidente pelo TSE.</div>
            <div className="hint">
              Resultado oficial · {shortName(p!.cands[p!.winner === 0 ? 1 : 0], 1)} com {pct(p!.cands[p!.winner === 0 ? 1 : 0].pct, 2)} dos votos válidos
            </div>
          </section>
        ))}

      <Marcador data={data} now={now} />

      {/*
        PC: linhas de pares com alturas parecidas (em vez de duas colunas soltas, que deixavam
        um vazio enorme quando um lado tinha poucos cartões, por exemplo antes do fecho das urnas).
        Telemóvel: tudo numa coluna, pela mesma ordem.
      */}
      {(data.projection || data.timeline.length > 0) && (
        <div className="par">
          {data.projection && <Projecao data={data} />}
          {data.timeline.length > 0 && (
            <section className="card">
              <h2>Evolução da noite</h2>
              <Evolucao data={data} />
            </section>
          )}
        </div>
      )}

      {/* Mercado de apostas: a toda a largura, com o gráfico ao lado dos números no PC. */}
      {data.market && <Mercado data={data} now={now} />}

      {/* "Para virar" e "Onde faltam votos" falam do mesmo: os votos por apurar. */}
      {data.projection && p && p.pctSections > 0 ? (
        <OndeFaltam data={data}>{data.toFlip && <ParaVirar data={data} embedded />}</OndeFaltam>
      ) : (
        data.toFlip && p && p.pctSections > 0 && <ParaVirar data={data} />
      )}

      <section className="card">
        <h2 className="mb-2">Avisos</h2>
        <Avisos events={data.events} corrections={data.corrections} />
      </section>

      <div className="par">
        <section className="card grid gap-3 content-start">
          <h2>Estados</h2>
          <Placar score={data.score} />
          {data.score.pending > 0 && leading.flavio + leading.lula > 0 && (
            <p className="hint text-center">
              À frente agora: <b className="c-flavio">Flávio em {leading.flavio}</b> · <b className="c-lula">Lula em {leading.lula}</b>
            </p>
          )}
          <Mapa states={data.states} selected={uf} onSelect={select} />
        </section>

        <section className="card">
          <h2 className="mb-2">Detalhe do estado</h2>
          <DetalheEstado data={data} uf={uf} onSelect={select} />
        </section>
      </div>

      <section className="card">
        <h2 className="mb-2">Face à 1.ª volta</h2>
        <Crescimento states={data.states} onSelect={select} />
      </section>

      <Estrangeiro data={data} now={now} />

      <details className="card">
        <summary>Governadores (7 estados)</summary>
        <div className="mt-3">
          <Governadores data={data} />
        </div>
      </details>

      <details className="card">
        <summary>Arquivo da 1.ª volta</summary>
        <div className="mt-3">
          <Arquivo />
        </div>
      </details>

      <Definicoes
        data={data}
        error={error}
        alerts={alerts}
        setAlerts={(v) => (setAlerts(v), write('avisos', v ? '1' : '0'))}
        sound={sound}
        setSound={(v) => {
          setSound(v);
          write('som', v ? '1' : '0');
          if (v) {
            unlockAudio();
            void chime('good');
          }
        }}
        awake={awake}
        setAwake={async (v) => setAwake(v && (await keepAwake(v)))}
        motion={motion}
        setMotion={(v) => {
          setMotion(v);
          write('animacoes', v ? '1' : '0');
          if (v) delete document.documentElement.dataset.motion;
          else document.documentElement.dataset.motion = 'off';
        }}
      />

      {toast && (
        <div
          role="status"
          className="toast"
          style={{ background: toast.tone === 'good' ? 'var(--flavio)' : toast.tone === 'bad' ? 'var(--lula)' : '#333' }}
          onClick={() => setToast(null)}
        >
          <div className="font-bold">{toast.title}</div>
          <div className="text-sm opacity-90">{toast.detail}</div>
        </div>
      )}
      {party && festejo && winner && p && <Festejo winner={winner} other={p.cands[1]} sound={sound} onClose={closeParty} onShare={share} />}
    </main>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 64 64" className="logo" aria-hidden="true">
      <defs>
        <linearGradient id="logo-verde" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0aa346" />
          <stop offset="1" stopColor="#05582a" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="29" fill="url(#logo-verde)" stroke="#ffdf00" strokeWidth="3" />
      <path d="M45 11 L30 33" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M23 29 L36 37 L30 53 Q20 51 13 44 Z" fill="#ffdf00" />
      <path d="M18 45 L27 39 M22 49 L30 41 M26 52 L33 42" stroke="#b89400" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Botão claro/escuro. O claro é o predefinido; a escolha fica guardada neste browser. */
function BotaoTema() {
  const [dark, setTema] = useTema();
  const toggle = () => setTema(!dark);
  return (
    <button className="botao-tema" onClick={toggle} aria-label={dark ? 'Mudar para o modo claro' : 'Mudar para o modo escuro'} title={dark ? 'Modo claro' : 'Modo escuro'}>
      {dark ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
        </svg>
      )}
    </button>
  );
}

function Cabecalho({
  data,
  now,
  festejo = false,
  onShare,
  sharing = false,
}: {
  data: Snapshot | null;
  now: number;
  festejo?: boolean;
  onShare?: () => void;
  sharing?: boolean;
}) {
  const phase = data?.phase ?? 'antes';
  const label = festejo
    ? 'Flávio eleito'
    : data?.paused
      ? 'Recolha em pausa'
      : phase === 'antes'
        ? 'Antes do fecho das urnas'
        : phase === 'apuramento'
          ? 'Apuramento ao vivo'
          : 'Encerrado';
  return (
    <>
      <header className="cabecalho">
        <div className="marca">
          <Logo />
          <div>
            <h1>
              {festejo ? (
                <>
                  A <span className="c-lula">esquerda</span> foi varrida!
                </>
              ) : (
                <>
                  Varrendo a <span className="c-lula">Esquerda</span>
                </>
              )}
            </h1>
            <p>
              <span className="sem-quebra">Eleições Brasil 2026 · 2.ª volta</span>{' '}
              <span className="sem-quebra">
                · <span className="c-flavio">Flávio 22</span> × <span className="c-lula">Lula 13</span>
              </span>
            </p>
          </div>
        </div>
        <div className="relogios">
          <div className="flex items-center gap-2">
            <BotaoTema />
          <span className={`pill ${phase === 'apuramento' && data?.active && !festejo ? 'live' : ''} ${festejo ? 'pill-festejo' : ''}`}>
            {label}
          </span>
          {onShare && (
            <button className="botao-partilhar" onClick={onShare} disabled={sharing} aria-label="Partilhar o resultado como imagem">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
              </svg>
              {sharing ? '…' : 'Partilhar'}
            </button>
          )}
          </div>
          {now > 0 && (
            <span className="hint">
              <b>{timeLisbon(now, true)}</b> Lisboa · {timeBrasilia(now)} Brasília
            </span>
          )}
        </div>
      </header>
      <div className="faixa-brasil" aria-hidden="true" />
    </>
  );
}

/** Estado da ligação ao TSE: última leitura, erros e pausas, para se perceber logo se algo falhou. */
function EstadoTSE({ data, now, error }: { data: Snapshot; now: number; error: string | null }) {
  const success = Math.max(0, ...[data.national, ...data.states].map((r) => r.meta.successAt ?? 0));
  const paused = data.collector.pauseUntil > data.serverNow;
  let tone: 'ok' | 'aviso' | 'erro' | 'neutro' = 'neutro';
  let text: string;
  if (error) {
    tone = 'erro';
    text = `Sem ligação ao site (${error})`;
  } else if (data.paused) {
    text = 'Recolha em pausa · a mostrar os resultados guardados';
  } else if (!data.active) {
    text = data.phase === 'encerrado' ? 'Recolha terminada · resultados guardados' : `Recolha começa às ${timeLisbon(data.opensAt)} em Lisboa (25 de outubro)`;
  } else if (paused) {
    tone = 'erro';
    text = `O TSE pediu uma pausa · nova consulta às ${timeLisbon(data.collector.pauseUntil)}`;
  } else if (!success) {
    tone = 'aviso';
    text = 'A aguardar os primeiros ficheiros do TSE';
  } else {
    const age = now - success;
    tone = age > 120_000 ? 'aviso' : 'ok';
    text = `TSE: última leitura ${ago(success, now)}`;
    if (data.collector.lastError) {
      tone = 'aviso';
      text += ` · último erro: ${data.collector.lastError}`;
    }
  }
  return (
    <div className={`estado-tse estado-${tone}`} role="status">
      <i aria-hidden="true" />
      {text}
    </div>
  );
}

/** Resumo fixo no topo, visível quando o placar principal sai do ecrã. */
function BarraFixa({ data }: { data: Snapshot }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = document.getElementById('placar');
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const p = data.national.parsed;
  if (!p || p.cands[0].votes + p.cands[1].votes === 0) return null;
  const [a, b] = p.cands;
  const share = (100 * a.votes) / (a.votes + b.votes);
  return (
    <div className={`barra-fixa ${visible ? 'on' : ''}`} aria-hidden={!visible}>
      <button className="barra-fixa-in" onClick={() => document.getElementById('placar')?.scrollIntoView({ behavior: 'smooth' })} tabIndex={visible ? 0 : -1}>
        <b className="c-flavio">{shortName(a, 1)} {pct(a.pct)}</b>
        <span className="barra-duelo grow">
          <span className="bg-flavio" style={{ width: `${share}%` }} />
          <span className="bg-lula" style={{ width: `${100 - share}%` }} />
          <i className="meta-50" />
        </span>
        <b className="c-lula">{pct(b.pct)} {shortName(b, 1)}</b>
        <span className="hint hidden sm:inline">{pct(p.pctSections, 1)} apurado</span>
      </button>
    </div>
  );
}

function ParaVirar({ data, embedded = false }: { data: Snapshot; embedded?: boolean }) {
  const f = data.toFlip!;
  const flavioBehind = f.trailing === 0;
  const cands = data.national.parsed!.cands;
  const who = shortName(cands[f.trailing], 1);
  const need = f.impossible || f.needPct == null ? null : f.needPct;
  const text =
    need == null
      ? `${who === 'Flávio' || who === 'Lula' ? `O ${who}` : who} já não tem votos suficientes por apurar para virar.`
      : `${who === 'Flávio' || who === 'Lula' ? `O ${who}` : who} ${flavioBehind ? 'precisa' : 'precisaria'} de ~${pct(need, 1)} dos votos que faltam.`;
  // Medidor de 50% (basta empatar o resto) a 100% (precisaria de todos os votos que faltam).
  const pos = need == null ? 100 : Math.max(0, Math.min(100, ((need - 50) / 50) * 100));
  const verdict = need == null ? 'impossível' : need > 60 ? 'muito difícil' : need > 55 ? 'difícil' : need > 52 ? 'possível' : 'tudo em aberto';
  const Wrapper = embedded ? 'div' : 'section';
  return (
    <Wrapper
      className={embedded ? 'para-virar-embutido' : 'card'}
      style={{ borderLeft: `6px solid ${flavioBehind ? 'var(--lula)' : 'var(--flavio)'}` }}
    >
      <div className="flex items-center justify-between gap-2">
        {embedded ? <h3 className="font-bold">Para virar</h3> : <h2>Para virar</h2>}
        <span className="tag">estimativa · não oficial</span>
      </div>
      <p className="font-semibold mt-1">
        {text} <span className={flavioBehind ? 'c-lula' : 'c-flavio'}>({verdict})</span>
      </p>
      <div className="medidor" role="img" aria-label={`Dificuldade de virar: ${verdict}`}>
        <i className="medidor-marca" style={{ left: `${pos}%` }} />
      </div>
      <div className="medidor-legenda">
        <span>50% · em aberto</span>
        <span>75%</span>
        <span>100% · impossível</span>
      </div>
      {data.projection && (() => {
        // Liga o "para virar" à projeção: não basta a percentagem necessária, importa onde estão os votos que faltam.
        const net = data.projection.perRegion.reduce((n, r) => n + r.netFlavio, 0);
        const helps = (net >= 0) === flavioBehind ? 'ajudam' : 'dificultam';
        return (
          <p className="text-sm mt-2">
            Pela projeção, os votos que faltam {helps} {flavioBehind ? 'o Flávio' : 'o Lula'}: devem dar{' '}
            <b className={net >= 0 ? 'c-flavio' : 'c-lula'}>
              +{compact(Math.abs(net))} ao {net >= 0 ? 'Flávio' : 'Lula'}
            </b>
            , por estarem sobretudo em estados onde {net >= 0 ? 'ele' : 'o Lula'} vai à frente.
          </p>
        );
      })()}
      <p className="hint mt-2">
        Faltam ~{compact(f.remaining)} votos válidos, estimados com os votos da 1.ª volta nas secções ainda por apurar (estados e estrangeiro).
      </p>
    </Wrapper>
  );
}

