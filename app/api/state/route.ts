import { waitUntil } from 'cloudflare:workers';
import { collectStep, snapshot, currentIds } from '../../../lib/collector.mjs';
import { jobsFor } from '../../../lib/rounds.mjs';
import { UFS } from '../../../lib/tse.mjs';
import { refreshMarket } from '../../../lib/mercado.mjs';
import { store, flags } from '../../../lib/runtime';

export async function GET(request: Request) {
  const uf = (new URL(request.url).searchParams.get('uf') || 'BR').toUpperCase();
  if (uf !== 'BR' && !UFS.includes(uf)) return Response.json({ error: 'Estado inválido' }, { status: 400 });
  try {
    const db = store();
    const f = flags();
    const now = Date.now();
    const data = await snapshot(db, now, f);
    if (data.active && !f.paused) {
      // Quem tem a página aberta mantém a recolha viva; a concessão garante uma recolha de cada vez.
      await db.prioritize(jobsFor(await currentIds(db), f.base), uf, now);
      waitUntil(collectStep(db, { ...f, limit: 32, foreground: true }).catch((e) => console.error('Recolha:', e)));
    }
    // Mercado de previsões: lido em segundo plano, ao seu próprio ritmo (a base garante um pedido de cada vez).
    waitUntil(refreshMarket(db, { active: data.active }).catch((e) => console.error('Mercado:', e)));
    return Response.json(data, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('Estado:', error);
    return Response.json({ error: 'Não foi possível ler os resultados guardados.' }, { status: 503 });
  }
}
