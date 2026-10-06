import { waitUntil } from 'cloudflare:workers';
import { collectStep } from '../../../lib/collector.mjs';
import { store, flags, validToken } from '../../../lib/runtime';

export async function POST(request: Request) {
  if (!(await validToken(request.headers.get('x-collector-token')))) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 });
  }
  try {
    const task = collectStep(store(), flags());
    waitUntil(task.catch((e) => console.error('Recolha:', e)));
    return Response.json(await task);
  } catch (error) {
    console.error('Recolha:', error);
    return Response.json({ error: 'Falha na recolha' }, { status: 503 });
  }
}
