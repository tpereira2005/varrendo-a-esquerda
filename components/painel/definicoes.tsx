'use client';
import { useEffect, useState } from 'react';
import type { Snapshot } from '@/lib/types';
import { Notificacoes } from './notificacoes';
import { Definicao, Interruptor, useTema } from './controlos';
import { timeLisbon } from './format';
import { getVolume, setVolume, tocar } from './efeitos';

type Props = {
  data: Snapshot;
  error: string | null;
  alerts: boolean;
  setAlerts: (v: boolean) => void;
  sound: boolean;
  setSound: (v: boolean) => void;
  awake: boolean;
  setAwake: (v: boolean) => void;
  motion: boolean;
  setMotion: (v: boolean) => void;
};

/** Definições deste aparelho e, em baixo, a origem dos dados (os pormenores ficam em "Como funciona"). */
export function Definicoes({ data, error, alerts, setAlerts, sound, setSound, awake, setAwake, motion, setMotion }: Props) {
  const [canAwake, setCanAwake] = useState(false);
  const [dark, setTema] = useTema();
  const [vol, setVol] = useState(0.8);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVol(getVolume());
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanAwake('wakeLock' in navigator);
  }, []);

  return (
    <footer className="card grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2>Definições</h2>
        <span className="hint">guardadas neste aparelho</span>
      </div>

      {error && <p className="c-lula font-semibold text-sm">Sem ligação ao site: {error}. A mostrar os últimos dados recebidos.</p>}
      {data.collector.pauseUntil > data.serverNow && (
        <p className="c-lula text-sm">O TSE pediu uma pausa; nova consulta às {timeLisbon(data.collector.pauseUntil)}.</p>
      )}

      {/* Dois grupos com título: cada um é uma coluna no PC, por isso o número de definições nunca desequilibra a grelha. */}
      <div className="grupos-definicoes">
        <section aria-labelledby="def-alertas">
          <h3 id="def-alertas" className="grupo-titulo">Alertas</h3>
          <div className="definicoes">
            <Notificacoes />
            <Definicao icone="aviso" titulo="Avisos no ecrã" descricao="Viradas e marcos no topo da página">
              <Interruptor on={alerts} onChange={setAlerts} label="Avisos no ecrã" />
            </Definicao>
            <Definicao
              icone="som"
              titulo="Som"
              descricao={
                sound ? (
                  <span className="volume">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={vol}
                      aria-label="Volume"
                      onChange={(e) => {
                        setVol(Number(e.target.value));
                        setVolume(Number(e.target.value));
                      }}
                      onPointerUp={() => void tocar('marco')}
                    />
                    <button className="link-botao" onClick={() => void tocar('virada-boa')}>
                      Testar
                    </button>
                  </span>
                ) : (
                  'Avisos, viradas e o hino na vitória'
                )
              }
            >
              <Interruptor on={sound} onChange={setSound} label="Som" />
            </Definicao>
          </div>
        </section>
        <section aria-labelledby="def-ecra">
          <h3 id="def-ecra" className="grupo-titulo">Ecrã</h3>
          <div className="definicoes">
            <Definicao icone="lua" titulo="Modo escuro" descricao="Também no botão do topo">
              <Interruptor on={dark} onChange={setTema} label="Modo escuro" />
            </Definicao>
            <Definicao icone="brilho" titulo="Animações" descricao="Números, gráficos e festejo">
              <Interruptor on={motion} onChange={setMotion} label="Animações" />
            </Definicao>
            {canAwake && (
              <Definicao icone="ecra" titulo="Ecrã sempre ligado" descricao="Para acompanhar a noite sem tocar">
                <Interruptor on={awake} onChange={setAwake} label="Ecrã sempre ligado" />
              </Definicao>
            )}
          </div>
        </section>
      </div>

      <div className="fonte">
        <span className="fonte-selo">
          <i aria-hidden="true" />
          Dados oficiais do TSE
        </span>
        <span className="hint">
          Eleições {data.ids.federal} e {data.ids.estadual}
          {data.ids.confirmedAt ? ' · confirmadas' : ' · a confirmar'}
        </span>
        <details className="detalhes-pequenos fonte-detalhes">
          <summary>Como funciona?</summary>
          <ul className="hint">
            <li>A página atualiza a cada 4 s (15 s noutro separador). O ficheiro nacional do TSE é lido a cada 10 s e, quando muda, todos os outros logo a seguir.</li>
            <li>A recolha continua com o site fechado.</li>
            <li>Vitória só com a indicação oficial do TSE. Projeção e mercado de apostas são estimativas não oficiais.</li>
            <li>
              Os grupos “direita/esquerda” vêm do{' '}
              <a className="underline" href="https://github.com/ODevLibertario/varrendo-a-esquerda">
                projeto original
              </a>
              , não do TSE.
            </li>
          </ul>
        </details>
      </div>
    </footer>
  );
}
