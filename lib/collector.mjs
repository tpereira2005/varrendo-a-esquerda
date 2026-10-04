import {jobs,normalize,PROFILE,UFS} from './election.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
export class D1Store {
  constructor(db){this.db=db;}
  async state(){return await this.db.prepare('SELECT * FROM collector WHERE id=1').first()||{cursor:0,next_at:0,pause_until:0,lease_until:0};}
  async lock(owner,now,leaseMs=180000){
    await this.db.prepare('INSERT OR IGNORE INTO collector(id) VALUES(1)').run();
    const r=await this.db.prepare('UPDATE collector SET owner=?,lease_until=? WHERE id=1 AND lease_until<=? AND pause_until<=? AND (cursor>0 OR next_at<=?)').bind(owner,now+leaseMs,now,now,now).run();return r.meta.changes===1;
  }
  async control(owner,values){const names=Object.keys(values);await this.db.prepare(`UPDATE collector SET ${names.map(n=>n+'=?').join(',')},owner=NULL,lease_until=0 WHERE id=1 AND owner=?`).bind(...names.map(n=>values[n]),owner).run();}
  async get(key){return this.db.prepare('SELECT * FROM results WHERE key=?').bind(key).first();}
  async failure(job,old,error,now,retry){await this.db.prepare('INSERT INTO results(key,uf,cargo,url,checked_at,error,failures,retry_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET checked_at=excluded.checked_at,error=excluded.error,failures=excluded.failures,retry_at=excluded.retry_at').bind(job.key,job.uf,job.cargo,job.url,now,error,(old?.failures||0)+1,retry).run();}
  async unchanged(job,now){await this.db.prepare('UPDATE results SET checked_at=?,success_at=?,error=NULL,failures=0,retry_at=0 WHERE key=?').bind(now,now,job.key).run();}
  async success(job,old,json,parsed,hash,headers,now){
    const body=JSON.stringify(json), value=JSON.stringify(parsed),summary=JSON.stringify({...parsed,candidates:[],events:[]});
    const statements=[this.db.prepare('INSERT INTO results(key,uf,cargo,url,body,parsed,summary,hash,etag,modified,generated_at,checked_at,success_at,error,failures,retry_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,0,0) ON CONFLICT(key) DO UPDATE SET body=excluded.body,parsed=excluded.parsed,summary=excluded.summary,hash=excluded.hash,etag=excluded.etag,modified=excluded.modified,generated_at=excluded.generated_at,checked_at=excluded.checked_at,success_at=excluded.success_at,error=NULL,failures=0,retry_at=0').bind(job.key,job.uf,job.cargo,job.url,body.length<900000?body:null,value,summary,hash,headers.get('etag'),headers.get('last-modified'),parsed.generatedAt,now,now)];
    if(old?.hash!==hash){
      statements.push(this.db.prepare('INSERT INTO revisions(key,hash,parsed,at) VALUES(?,?,?,?)').bind(job.key,hash,value,now));
      const ids=parsed.events.map(e=>e.id);
      statements.push(this.db.prepare(`UPDATE notices SET active=0,corrected_at=? WHERE key=? AND active=1${ids.length?' AND id NOT IN ('+ids.map(()=>'?').join(',')+')':''}`).bind(now,job.key,...ids));
      for(const event of parsed.events)statements.push(this.db.prepare('INSERT INTO notices(id,key,payload,active,at,corrected_at) VALUES(?,?,?,1,?,NULL) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,active=1,at=CASE WHEN notices.active=0 THEN excluded.at ELSE notices.at END,corrected_at=NULL').bind(event.id,job.key,JSON.stringify(event),now));
    }
    await this.db.batch(statements);
  }
  async cleanup(now){await this.db.batch([this.db.prepare('DELETE FROM revisions WHERE at<?').bind(now-7*86400000),this.db.prepare('DELETE FROM notices WHERE active=0 AND corrected_at<?').bind(now-7*86400000)]);}
  async rows(){return (await this.db.prepare('SELECT key,uf,cargo,summary AS parsed,generated_at,checked_at,success_at,error FROM results').all()).results;}
  async events(){return (await this.db.prepare('SELECT payload,at,corrected_at,active FROM notices ORDER BY at DESC LIMIT 1000').all()).results;}
}
export async function collectStep(store,{fetchImpl=fetch,now=Date.now,sleep=wait,limit=8}={}){
  const owner=crypto.randomUUID(),started=now();
  if(!await store.lock(owner,started,Math.min(180000,limit*15000+30000)))return {busy:true,...await store.state()};
  let state=await store.state(),cursor=state.cursor||0,processed=0,pause=0,lastError=null;
  try {
    if(cursor===0)state.cycle_started_at=started;
    while(cursor<jobs.length&&processed<limit){
      const job=jobs[cursor],old=await store.get(job.key);
      if(old?.retry_at>now()){cursor++;continue;}
      if(processed)await sleep(150);
      processed++;
      try {
        const headers={accept:'application/json'};
        if(old?.etag)headers['if-none-match']=old.etag;
        if(old?.modified)headers['if-modified-since']=old.modified;
        const response=await fetchImpl(job.url,{headers,signal:AbortSignal.timeout(15000)});
        if(response.status===304&&old?.parsed)await store.unchanged(job,now());
        else {
          if(!response.ok){await response.body?.cancel();const err=new Error('TSE: HTTP '+response.status);err.status=response.status;err.retryAfter=response.headers.get('retry-after');throw err;}
          const json=await response.json(),parsed=normalize(json,job);
          if(old?.generated_at&&parsed.generatedAt&&parsed.generatedAt<old.generated_at)throw new Error('Revisão oficial anterior à última guardada');
          const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(json))))).map(x=>x.toString(16).padStart(2,'0')).join('');
          await store.success(job,old,json,parsed,hash,response.headers,now());
        }
      }catch(e){
        lastError=e.message;
        const backoff=Math.min(600000,60000*2**Math.min(old?.failures||0,4));
        let retry=now()+backoff;
        if(e.status===403||e.status===429){const h=e.retryAfter;const requested=/^\d+$/.test(h||'')?Number(h)*1000:Math.max(0,Date.parse(h||'')-now());pause=now()+Math.max(600000,requested||0);retry=pause;}
        await store.failure(job,old,lastError,now(),retry);
        if(pause||job.uf==='BR'){cursor=0;break;}
      }
      cursor++;
    }
    const done=cursor>=jobs.length;
    if(done)await store.cleanup(now());
    await store.control(owner,{cursor:done?0:cursor,cycle_started_at:state.cycle_started_at||started,cycle_finished_at:done?now():state.cycle_finished_at||0,next_at:done||pause||cursor===0?Math.max(now()+PROFILE.intervalMs,pause):0,pause_until:pause,last_error:lastError});
    return {processed,complete:done,...await store.state()};
  }catch(e){await store.control(owner,{last_error:e.message,next_at:now()+60000});throw e;}
}
export async function snapshot(store,now=Date.now(),selection={uf:'BR',cargo:1}){
  const [rows,notices,collector]=await Promise.all([store.rows(),store.events(),store.state()]);
  const areas={},errors=[];
  for(const row of rows){const area=areas[row.uf]||={presidential:null,races:[],records:[],candidates:{}};
    let p=null;try{if(row.parsed)p=JSON.parse(row.parsed);}catch{}
    const stale=!!row.error||!row.success_at||now-row.success_at>600000;
    const meta={cargo:row.cargo,office:p?.office,generatedAt:row.generated_at,checkedAt:row.checked_at,successAt:row.success_at,stale,error:row.error,warnings:p?.warnings||[]};
    area.records.push(meta);if(stale)errors.push({uf:row.uf,...meta});
    if(!p)continue;
    if(row.cargo===1)area.presidential={pctSections:p.pctSections,votesLeft:p.votesLeft,votesRight:p.votesRight};
    else area.races.push({...p.race,...meta});
    area.candidates[row.cargo]={office:p.office,status:p.status,candidates:p.candidates,slots:p.slots,electedCount:p.electedCount,...meta};
  }
  const detail=await store.get(`2026:1:${selection.uf}:${selection.cargo}`);if(detail?.parsed){const p=JSON.parse(detail.parsed),area=areas[selection.uf];if(area)area.candidates[selection.cargo]={...area.candidates[selection.cargo],candidates:p.candidates};}
  const states={};const races={};for(const uf of UFS){states[uf]=areas[uf]?.presidential||{pctSections:0,votesLeft:0,votesRight:0};races[uf]=areas[uf]?.races||[];}
  const active=notices.filter(n=>n.active).map(n=>({...JSON.parse(n.payload),at:n.at}));
  return {mode:'tse',serverNow:now,national:areas.BR?.presidential||{pctSections:0,votesLeft:0,votesRight:0},states,races,areas,events:active,corrections:notices.filter(n=>!n.active&&n.corrected_at).map(n=>({...JSON.parse(n.payload),at:n.corrected_at})),refreshedAt:collector.cycle_finished_at||0,nextRefreshAt:Math.max(collector.next_at,collector.pause_until),collector:{...collector,owner:undefined,lease_until:undefined,total:jobs.length},source:{ok:rows.filter(r=>r.parsed).length===jobs.length&&errors.length===0,records:rows.filter(r=>r.parsed).length,total:jobs.length,errors},classificationVersion:PROFILE.classificationVersion};
}
