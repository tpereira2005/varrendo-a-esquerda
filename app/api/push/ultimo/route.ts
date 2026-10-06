import { pushWorthy } from '../../../../lib/webpush.mjs';
import { store } from '../../../../lib/runtime';

/** Aviso mais recente que merece notificação: o service worker mostra-o quando recebe um push. */
export async function GET() {
  try {
    type Row = { active: number; payload: string; at: number };
    const rows = (await store().notices()) as Row[];
    const latest = rows
      .filter((n) => n.active)
      .map((n) => ({ ...JSON.parse(n.payload), noticedAt: n.at }))
      .find(pushWorthy);
    return Response.json(latest ? { id: latest.id, title: latest.title, detail: latest.detail } : null, {
      headers: { 'cache-control': 'no-store' },
    });
  } catch {
    return Response.json(null, { status: 503 });
  }
}
