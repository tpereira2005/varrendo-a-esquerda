import {env} from 'cloudflare:workers';
import {D1Store,collectStep} from '../../../lib/collector.mjs';
export async function POST(request:Request){
 const token=(env as unknown as {COLLECTOR_TOKEN?:string}).COLLECTOR_TOKEN;
 if(!token||request.headers.get('x-collector-token')!==token)return Response.json({error:'Não autorizado'},{status:401});
 try{return Response.json(await collectStep(new D1Store(env.DB!)));}catch(error){console.error('Collector:',error);return Response.json({error:'Falha na recolha'},{status:503});}
}
