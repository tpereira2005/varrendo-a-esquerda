import { validSubscription } from '../../../lib/webpush.mjs';
import { store, pushKeys } from '../../../lib/runtime';

/** Chave pública para o aparelho subscrever (ou `disabled` se as notificações não estiverem configuradas). */
export function GET() {
  const keys = pushKeys();
  return Response.json(keys ? { publicKey: keys.publicKey } : { disabled: true }, { headers: { 'cache-control': 'no-store' } });
}

/** Guarda a subscrição de um aparelho (só serviços de push conhecidos). */
export async function POST(request: Request) {
  if (!pushKeys()) return Response.json({ error: 'Notificações não configuradas' }, { status: 503 });
  const sub = await request.json().catch(() => null);
  if (!validSubscription(sub)) return Response.json({ error: 'Subscrição inválida' }, { status: 400 });
  try {
    await store().pushSubscribe(sub, Date.now());
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Push:', error);
    return Response.json({ error: 'Não foi possível guardar' }, { status: 503 });
  }
}

/** Remove a subscrição de um aparelho. */
export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) return Response.json({ error: 'Pedido inválido' }, { status: 400 });
  await store().pushUnsubscribe(body.endpoint);
  return Response.json({ ok: true });
}
