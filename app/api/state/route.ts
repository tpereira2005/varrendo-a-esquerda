import {env} from 'cloudflare:workers';
import {D1Store,collectStep,snapshot} from '../../../lib/collector.mjs';
export async function GET(request:Request){
  const url=new URL(request.url),uf=(url.searchParams.get('uf')||'BR').toUpperCase(),cargo=Number(url.searchParams.get('cargo')||1);
  if(!/^(BR|AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO)$/.test(uf)||![1,3,5,6,7,8].includes(cargo))return Response.json({error:'Filtro inválido'},{status:400});
  try {const store=new D1Store(env.DB!);await collectStep(store);const data=await snapshot(store,Date.now(),{uf,cargo});
    for(const [area,value] of Object.entries(data.areas))value.candidates=area===uf&&value.candidates[cargo]?{[cargo]:value.candidates[cargo]}:{};
    return Response.json(data,{headers:{'cache-control':'no-store'}});}
  catch(error){console.error('State:',error);return Response.json({error:'Não foi possível consultar os resultados guardados.'},{status:503});}
}
