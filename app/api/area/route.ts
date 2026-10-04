import {env} from 'cloudflare:workers';
import {D1Store,snapshot} from '../../../lib/collector.mjs';
export async function GET(request: Request) {
  const uf=(new URL(request.url).searchParams.get('uf')||'BR').toUpperCase();
  if(!/^(BR|AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO)$/.test(uf))return Response.json({error:'Estado inválido'},{status:400});
  try{const data=await snapshot(new D1Store(env.DB!));return Response.json(data.areas[uf]||{records:[],candidates:{}},{headers:{'cache-control':'no-store'}});}catch{return Response.json({error:'Dados guardados indisponíveis'},{status:503});}
}
