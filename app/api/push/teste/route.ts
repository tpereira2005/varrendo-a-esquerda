import { sendPush } from '../../../../lib/webpush.mjs';
import { store, pushKeys } from '../../../../lib/runtime';

/** Envia uma notificação de teste a um aparelho já subscrito (no máximo uma por minuto). */
export async function POST(request: Request) {
  const keys = pushKeys();
  if (!keys) return Response.json({ error: 'Notificações não configuradas' }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  const db = store();
  const sub = (await db.pushSubs()).find((s: { endpoint: string }) => s.endpoint === body?.endpoint);
  if (!sub) return Response.json({ error: 'Aparelho não subscrito' }, { status: 404 });
  const last = await db.pushLastOk(sub.endpoint);
  if (last && Date.now() - last < 60_000) return Response.json({ error: 'Espera um minuto' }, { status: 429 });
  const status = await sendPush(sub, keys);
  await db.pushResult(sub.endpoint, status >= 200 && status < 300, Date.now());
  return Response.json({ status }, { status: status >= 200 && status < 300 ? 200 : 502 });
}
