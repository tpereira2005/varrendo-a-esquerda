import { env } from 'cloudflare:workers';
import { D1Store } from './store.mjs';

type SiteEnv = {
  DB?: D1Database;
  COLLECTOR_TOKEN?: string;
  COLLECTION_PAUSED?: string;
  /** Só para desenvolvimento e ensaio: recolher fora da janela da noite eleitoral. */
  COLLECTION_FORCE?: string;
  /** Só para desenvolvimento: endereço do simulador local do TSE. */
  TSE_BASE?: string;
  /** Notificações (Web Push): chave pública (não secreta) e privada (segredo). Ver scripts/vapid-keys.mjs. */
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  /** Contacto exigido pelos serviços de push (mailto: ou https:). */
  VAPID_SUBJECT?: string;
};

const siteEnv = env as unknown as SiteEnv;

export function store() {
  if (!siteEnv.DB) throw new Error('Base D1 indisponível');
  return new D1Store(siteEnv.DB);
}

/** Chaves das notificações, ou null se ainda não estiverem configuradas no Sites. */
export function pushKeys() {
  const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey } = siteEnv;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: siteEnv.VAPID_SUBJECT || 'https://varrendo-a-esquerda.tomaspereira.chatgpt.site' };
}

export function flags() {
  const local = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(siteEnv.TSE_BASE ?? '');
  return {
    paused: siteEnv.COLLECTION_PAUSED === '1',
    force: siteEnv.COLLECTION_FORCE === '1',
    push: pushKeys(),
    ...(local ? { base: siteEnv.TSE_BASE } : {}),
  };
}

/** Comparação do segredo em tempo constante (via resumos SHA-256 de tamanho fixo). */
export async function validToken(given: string | null) {
  const expected = siteEnv.COLLECTOR_TOKEN;
  if (!expected || !given) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(given)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
