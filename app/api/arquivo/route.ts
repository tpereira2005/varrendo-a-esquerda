import turno1 from '../../../data/turno1.json';

/** Resultados finais e congelados da 1.ª volta: nunca consulta o TSE. */
export function GET() {
  return Response.json(turno1, { headers: { 'cache-control': 'public, max-age=3600' } });
}
