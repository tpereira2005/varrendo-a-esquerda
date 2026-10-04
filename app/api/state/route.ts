import {env,waitUntil} from 'cloudflare:workers';
import {D1Store,collectStep,snapshot} from '../../../lib/collector.mjs';
import {jobs} from '../../../lib/election.mjs';
export async function GET(request:Request){
  const url=new URL(request.url),uf=(url.searchParams.get('uf')||'BR').toUpperCase(),cargo=Number(url.searchParams.get('cargo')||1);
  if(!jobs.some(j=>j.uf===uf&&j.cargo===cargo))return Response.json({error:'Filtro inválido'},{status:400});
  try {const store=new D1Store(env.DB!);await store.prioritize({uf,cargo},Date.now());waitUntil(collectStep(store,{limit:32,foreground:true}).catch(error=>console.error('Background collector:',error)));const data=await snapshot(store,Date.now(),{uf,cargo});
    for(const [area,value] of Object.entries(data.areas))value.candidates=area===uf&&value.candidates[cargo]?{[cargo]:value.candidates[cargo]}:{};
    return Response.json(data,{headers:{'cache-control':'no-store'}});}
  catch(error){console.error('State:',error);return Response.json({error:'Não foi possível consultar os resultados guardados.'},{status:503});}
}
