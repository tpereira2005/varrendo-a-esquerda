import { store } from '../../../lib/runtime';

const MAX = 1000;

/**
 * Dados abertos: todas as versões gravadas dos ficheiros do TSE (tabela `revisions`), página a página.
 * Presidente, Governador, Senado e cidades do estrangeiro; os deputados ficam de fora (enormes).
 *
 *   GET /api/dados?turno=2&depois=0&limite=500  →  { linhas: [{ id, key, at, parsed }], seguinte: id | null }
 *
 * Continuar com `depois=<seguinte>` até `seguinte` ser null. Ver scripts/descarregar-dados.mjs.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const turno = Number(q.get('turno') ?? 2);
  const depois = Number(q.get('depois') ?? 0);
  const limite = Math.min(MAX, Number(q.get('limite') ?? 500));
  if (![1, 2].includes(turno) || !Number.isInteger(depois) || depois < 0 || !Number.isInteger(limite) || limite < 1) {
    return Response.json({ error: 'Parâmetros inválidos: turno (1 ou 2), depois (≥ 0), limite (1–1000)' }, { status: 400 });
  }
  try {
    const linhas = await store().revisionsPage(turno, depois, limite);
    const cheia = linhas.length === limite;
    return Response.json(
      { turno, linhas, seguinte: cheia ? linhas.at(-1)!.id : null },
      // uma página cheia nunca muda (só se acrescentam linhas depois): pode ficar em cache
      { headers: { 'cache-control': cheia ? 'public, max-age=86400, immutable' : 'no-store', 'access-control-allow-origin': '*' } },
    );
  } catch (error) {
    console.error('Dados:', error);
    return Response.json({ error: 'Não foi possível ler os dados.' }, { status: 503 });
  }
}
