'use client';
import { useEffect, useState } from 'react';
import { fromB64u } from '@/lib/webpush.mjs';
import { Definicao, Interruptor } from './controlos';

type Estado = 'a-verificar' | 'servidor-desligado' | 'sem-suporte' | 'instalar-iphone' | 'bloqueadas' | 'desligadas' | 'ligadas' | 'a-ativar';

/** Notificações com o site fechado (Web Push). No iPhone só funcionam com o site instalado no ecrã principal. */
export function Notificacoes() {
  const [estado, setEstado] = useState<Estado>('a-verificar');
  const [chave, setChave] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [movel, setMovel] = useState(false);

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      setMovel(ios || /Android|Mobile/i.test(navigator.userAgent));
      const instalado = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      const r = (await fetch('/api/push', { cache: 'no-store' }).then((x) => x.json()).catch(() => null)) as { publicKey?: string } | null;
      if (!r?.publicKey) return setEstado('servidor-desligado');
      setChave(r.publicKey);
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
        return setEstado(ios && !instalado ? 'instalar-iphone' : 'sem-suporte');
      }
      if (Notification.permission === 'denied') return setEstado('bloqueadas');
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sub = await reg?.pushManager.getSubscription();
      setEstado(sub ? 'ligadas' : 'desligadas');
    })().catch(() => setEstado('sem-suporte'));
  }, []);

  const ativar = async () => {
    setEstado('a-ativar');
    setMsg(null);
    try {
      if ((await Notification.requestPermission()) !== 'granted') return setEstado('bloqueadas');
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64u(chave!) }));
      const r = await fetch('/api/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub.toJSON()) });
      if (!r.ok) throw new Error('servidor');
      setEstado('ligadas');
    } catch {
      setEstado('desligadas');
      setMsg('Não foi possível ativar. Tenta de novo.');
    }
  };

  const desativar = async () => {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/push', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setEstado('desligadas');
  };

  const testar = async () => {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    const r = await fetch('/api/push/teste', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
    setMsg(r.ok ? 'Teste enviado: deve chegar dentro de segundos.' : 'O teste falhou ou foi pedido há pouco; tenta daqui a 1 minuto.');
  };

  if (estado === 'a-verificar' || estado === 'servidor-desligado') return null;
  const on = estado === 'ligadas' || estado === 'a-ativar';
  const descricao: Record<Exclude<Estado, 'a-verificar' | 'servidor-desligado'>, string> = {
    desligadas: movel ? 'Viradas, marcos e resultado, mesmo com o site fechado' : 'Viradas, marcos e resultado, mesmo com o separador fechado',
    'a-ativar': 'A ativar…',
    ligadas: movel ? 'Ativas neste telemóvel' : 'Ativas neste computador (com o browser aberto)',
    'instalar-iphone': 'No iPhone, primeiro adiciona o site ao ecrã principal',
    'sem-suporte': 'Este browser não as suporta',
    bloqueadas: 'Bloqueadas: permite-as nas definições do browser',
  };
  return (
    <Definicao
      icone="sino"
      titulo="Notificações"
      descricao={descricao[estado]}
      extra={
        (estado === 'instalar-iphone' || estado === 'ligadas' || msg) && (
          <>
            {estado === 'instalar-iphone' && (
              <p>
                Toca em <b>Partilhar</b> → <b>Adicionar ao ecrã principal</b> e abre o site pelo novo ícone.
              </p>
            )}
            {estado === 'ligadas' && (
              <button className="link-botao" onClick={testar}>
                Enviar notificação de teste
              </button>
            )}
            {msg && <p>{msg}</p>}
          </>
        )
      }
    >
      <Interruptor
        on={on}
        label="Notificações"
        disabled={estado !== 'ligadas' && estado !== 'desligadas'}
        onChange={(v) => void (v ? ativar() : desativar())}
      />
    </Definicao>
  );
}
