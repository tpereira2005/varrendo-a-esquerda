import {env,waitUntil} from 'cloudflare:workers';
import {D1Store,collectStep} from '../../../lib/collector.mjs';
export async function POST(request:Request){
 const token=(env as unknown as {COLLECTOR_TOKEN?:string}).COLLECTOR_TOKEN;
 if(!token||request.headers.get('x-collector-token')!==token)return Response.json({error:'Não autorizado'},{status:401});
 try{const task=collectStep(new D1Store(env.DB!));waitUntil(task.catch(error=>console.error('Collector lifetime:',error)));return Response.json(await task);}catch(error){console.error('Collector:',error);return Response.json({error:'Falha na recolha'},{status:503});}
}
