import turno1 from '../../../data/turno1.json';
import exterior from '../../../data/exterior-turno1.json';

/** Resultados finais e congelados da 1.ª volta (incluindo o estrangeiro por país): nunca consulta o TSE. */
export function GET() {
  return Response.json({ ...turno1, exterior }, { headers: { 'cache-control': 'public, max-age=3600' } });
}
