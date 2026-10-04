import parties from './parties.json' with {type:'json'};
import { UFS, OFFICES, depEstadualCargo, parseResult, indexParties, resultUrl, eventsFrom, raceSummary } from './tse-core.mjs';

const P = indexParties(parties);
const tse = {base:'https://resultados.tse.jus.br',env:'oficial',resultUrl:'{base}/{env}/{cycle}/{ele}/dados/{uf}/{uf}-c{cargo4}-e{ele6}-u.json'};
const TTL = 300000;
const memory = new Map();
const running = new Map();
const pauseKey = 'https://tse-cache.invalid/pause';
const delay = ms => new Promise(r=>setTimeout(r,ms));
let pausedUntil = 0;
function edgeCache() { return globalThis.caches?.default; }
function remember(key,record) {
  memory.delete(key); memory.set(key,record);
  while(memory.size>16) memory.delete(memory.keys().next().value);
}
async function loadRecord(key) {
  const local = memory.get(key);
  if (local) return local;
  try {
    const response = await edgeCache()?.match(key);
    if (!response) return null;
    const record = await response.json(); remember(key, record); return record;
  } catch { return null; }
}
async function saveRecord(key, record, seconds=3600) {
  remember(key, record);
  try { await edgeCache()?.put(key,new Response(JSON.stringify(record),{headers:{'content-type':'application/json','cache-control':`public, max-age=${seconds}`}})); } catch {}
}

async function readSource(url) {
  if(running.has(url)) return running.get(url);
  const task = (async()=>{
    const old = await loadRecord(url);
    if(old && Date.now()-old.at<TTL) return {...old,stale:false,error:null};
    const pause = await loadRecord(pauseKey);
    pausedUntil = Math.max(pausedUntil,pause?.until||0);
    const retryAt = Math.max(pausedUntil,old?.retryAt||0);
    if(Date.now()<retryAt) return {...old,json:old?.json||null,stale:true,error:old?.error||'Consulta ao TSE temporariamente em pausa.',retryAt};
    try {
      const headers={accept:'application/json'};
      if(old?.etag) headers['if-none-match']=old.etag;
      if(old?.modified) headers['if-modified-since']=old.modified;
      const response = await fetch(url,{headers,signal:AbortSignal.timeout(15000)});
      if(response.status===403 || response.status===429) {
        pausedUntil=Date.now()+600000;
        await saveRecord(pauseKey,{until:pausedUntil},600);
      }
      if(response.status===304 && old?.json) {
        const value={...old,at:Date.now(),retryAt:0,error:null}; await saveRecord(url,value); return {...value,stale:false};
      }
      if(!response.ok) { await response.body?.cancel(); throw new Error(`TSE: HTTP ${response.status}`); }
      const json=await response.json();
      if(!json || typeof json!=='object' || (!json.carg && !json.cand && !json.abr && !json.carper)) throw new Error('Formato de resultados do TSE não reconhecido.');
      const value={json,at:Date.now(),etag:response.headers.get('etag'),modified:response.headers.get('last-modified'),retryAt:0,error:null};
      await saveRecord(url,value); return {...value,stale:false};
    } catch(e) {
      const value={...old,json:old?.json||null,at:old?.at||0,error:e.message,retryAt:Math.max(pausedUntil,Date.now()+60000)};
      await saveRecord(url,value); return {...value,stale:true};
    }
  })();
  running.set(url,task);
  try{return await task;}finally{running.delete(url);}
}

export async function readArea(uf) {
  uf=String(uf).toUpperCase();
  if(uf!=='BR' && !UFS.includes(uf)) return Response.json({error:'Estado inválido.'},{status:400});
  const cargos=uf==='BR'?[1]:[1,3,5,6,depEstadualCargo(uf)];
  const results=[]; const errors=[]; let at=Infinity; let retryAt=0;
  for(const cargo of cargos) {
    const url=resultUrl(tse,{cycle:'ele2026',ele:cargo===1?6257:6259,uf,cargo});
    const record=await readSource(url);
    retryAt=Math.max(retryAt,record.retryAt||0);
    if(record.error) errors.push({office:OFFICES[cargo],message:record.error});
    if(record.json) {
      const parsed=parseResult(record.json,P,uf);
      at=Math.min(at,record.at);
      const race=raceSummary(parsed,OFFICES[cargo]);
      if(cargo===5 || cargo>=6) {race.decided=parsed.pctSections>=1;race.status=race.decided?'decidido':'pendente';}
      const events=eventsFrom({...parsed,candidates:parsed.candidates.filter(c=>c.valid)}, {office:OFFICES[cargo],uf,minEventPct:.03,isPresident:cargo===1,winsOnly:cargo>=6}).map(ev=>({...ev,at:record.at}));
      results.push({cargo,parsed,race,events,stale:record.stale});
    }
    if(errors.length && cargo===1) break;
    if(pausedUntil>Date.now()) break;
    if(cargo!==cargos.at(-1)) await delay(150);
  }
  const pres=results.find(r=>r.cargo===1)?.parsed;
  return Response.json({uf,at:Number.isFinite(at)?at:0,serverNow:Date.now(),retryAt,
    presidential:pres?{pctSections:pres.pctSections,votesLeft:pres.votesLeft,votesRight:pres.votesRight}:null,
    races:results.filter(r=>r.cargo!==1).map(r=>r.race),
    events:results.filter(r=>uf==='BR'||r.cargo!==1).flatMap(r=>r.events),
    ok:errors.length===0 && results.length===cargos.length,errors}, {headers:{'cache-control':'no-store'}});
}
