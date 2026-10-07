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
    // CORS aberto: aparelhos que ativaram as notificações no endereço antigo do site
    // (varrendo-eleicoes-brasil-2026…, agora redirecionado) continuam a conseguir ler o aviso.
    return Response.json(latest ? { id: latest.id, title: latest.title, detail: latest.detail } : null, {
      headers: { 'cache-control': 'no-store', 'access-control-allow-origin': '*' },
    });
  } catch {
    return Response.json(null, { status: 503 });
  }
}
