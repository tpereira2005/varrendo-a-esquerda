'use client';
import { useEffect, useState } from 'react';
import { fromB64u } from '@/lib/webpush.mjs';

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
    setMsg(r.ok ? 'Teste enviado: deve chegar dentro de segundos (podes fechar o site).' : 'O teste falhou ou foi pedido há pouco; tenta daqui a 1 minuto.');
  };

  if (estado === 'a-verificar' || estado === 'servidor-desligado') return null;
  return (
    <div className="notificacoes">
      <div className="font-semibold">
        {movel ? 'Notificações no telemóvel (mesmo com o site fechado)' : 'Notificações no computador (mesmo com o separador fechado)'}
      </div>
      {estado === 'instalar-iphone' && (
        <p className="hint">
          No iPhone: toca em <b>Partilhar</b> (o quadrado com a seta) → <b>Adicionar ao ecrã principal</b>. Depois abre o site a partir do novo ícone e ativa
          aqui as notificações.
        </p>
      )}
      {estado === 'sem-suporte' && <p className="hint">Este browser não suporta notificações com o site fechado.</p>}
      {estado === 'bloqueadas' && (
        <p className="hint">As notificações estão bloqueadas para este site. Permite-as nas definições do browser (ou do iPhone) e volta a tentar.</p>
      )}
      {(estado === 'desligadas' || estado === 'a-ativar') && (
        <button className="btn btn-forte" onClick={ativar} disabled={estado === 'a-ativar'}>
          {estado === 'a-ativar' ? 'A ativar…' : 'Ativar notificações'}
        </button>
      )}
      {estado === 'ligadas' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="c-flavio font-semibold">✓ Ativas neste aparelho</span>
          <button className="btn" onClick={testar}>
            Enviar teste
          </button>
          <button className="btn" onClick={desativar}>
            Desativar
          </button>
        </div>
      )}
      {msg && <p className="hint">{msg}</p>}
      <p className="hint">
        Recebes as viradas, os marcos do apuramento, a projeção e o resultado oficial do Presidente.
        {!movel && ' No computador chegam enquanto o browser estiver aberto (mesmo noutro separador ou minimizado).'}
      </p>
    </div>
  );
}
