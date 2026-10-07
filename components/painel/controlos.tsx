'use client';
import { useEffect, useState, type ReactNode } from 'react';

const ICONES = {
  sino: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15ZM10 20.5a2 2 0 0 0 4 0',
  aviso: 'M4 5h16v11H9l-5 4ZM8 9.5h8M8 12.5h5',
  som: 'M4 9.5h3.5L12 6v12l-4.5-3.5H4ZM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11',
  brilho: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
  lua: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z',
  ecra: 'M7 3h10a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 17 21H7a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 7 3ZM10.5 18h3',
};

export function Icone({ nome }: { nome: keyof typeof ICONES }) {
  return (
    <svg viewBox="0 0 24 24" className="definicao-icone" aria-hidden="true">
      <path d={ICONES[nome]} />
    </svg>
  );
}

/** Interruptor ligado/desligado (acessível como "switch"). */
export function Interruptor({ on, onChange, label, disabled = false }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="interruptor" disabled={disabled} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

/** Uma definição: ícone, nome, descrição curta e o controlo à direita. */
export function Definicao({
  icone,
  titulo,
  descricao,
  children,
  extra,
}: {
  icone: keyof typeof ICONES;
  titulo: string;
  descricao: ReactNode;
  children?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="definicao">
      <Icone nome={icone} />
      <div className="min-w-0">
        <div className="definicao-titulo">{titulo}</div>
        <div className="definicao-descricao">{descricao}</div>
      </div>
      <div className="definicao-controlo">{children}</div>
      {extra && <div className="definicao-extra">{extra}</div>}
    </div>
  );
}

/**
 * Modo escuro, partilhado entre o botão do topo e as definições (ambos seguem o atributo da página).
 * O claro é o predefinido; a escolha fica guardada neste browser.
 */
export function useTema() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.dataset.theme === 'dark');
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);
  const setTema = (next: boolean) => {
    const root = document.documentElement;
    if (next) root.dataset.theme = 'dark';
    else delete root.dataset.theme;
    try {
      localStorage.setItem('varrendo.tema', next ? 'escuro' : 'claro');
    } catch {}
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next ? '#0a0e17' : '#f3f4ef');
  };
  return [dark, setTema] as const;
}
