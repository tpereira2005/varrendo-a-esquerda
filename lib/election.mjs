import parties from './parties.json' with {type:'json'};
import {parseResult,indexParties,eventsFrom,OFFICES,UFS,depEstadualCargo,resultUrl} from './tse-core.mjs';
export const PROFILE={cycle:'ele2026',federal:6257,estadual:6259,turn:1,intervalMs:120000,priorityMs:30000,classificationVersion:'autor-original-v1'};
const P=indexParties(parties);
export {UFS,OFFICES};
export const jobs=[{uf:'BR',cargo:1},...UFS.flatMap(uf=>[1,3,5,6,depEstadualCargo(uf)].map(cargo=>({uf,cargo})))].map(j=>({...j,key:`2026:1:${j.uf}:${j.cargo}`,url:resultUrl({base:'https://resultados.tse.jus.br',env:'oficial',resultUrl:'{base}/{env}/{cycle}/{ele}/dados/{uf}/{uf}-c{cargo4}-e{ele6}-u.json'},{...j,cycle:PROFILE.cycle,ele:j.cargo===1?PROFILE.federal:PROFILE.estadual})}));
export function officialTime(date,time){if(!date||!time)return null;const m=String(date).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!m||!/^\d{2}:\d{2}:\d{2}$/.test(time))return null;const t=Date.parse(`${m[3]}-${m[2]}-${m[1]}T${time}-03:00`);return Number.isFinite(t)?t:null;}
export function candidateStatus(c){
  if(!c.valid)return 'Votos anulados';
  if(c.elected)return c.st||'Eleito';
  if(/2[º°o]?\s*turno/i.test(c.st))return '2º turno';
  if(/n[ãa]o eleit/i.test(c.st))return 'Não eleito';
  if(/suplente/i.test(c.st))return 'Suplente';
  if(c.st)return c.st;
  return c.votes>0?'Apuramento em curso':'A aguardar votos';
}
export function normalize(json,job){
  if(!json||!Array.isArray(json.carg)||!json.s||!json.carg.some(c=>Number(c.cd)===job.cargo))throw new Error('Formato oficial ou cargo não reconhecido');
  const ele=job.cargo===1?PROFILE.federal:PROFILE.estadual;
  if(Number(json.ele)!==ele||Number(json.t)!==PROFILE.turn||String(json.cdabr).toUpperCase()!==job.uf)throw new Error('Eleição, turno ou abrangência incompatível');
  const raw=[];
  function walk(n){if(!n||typeof n!=='object')return;if(Array.isArray(n.cand))raw.push(...n.cand);for(const [key,value] of Object.entries(n))if(key!=='cand'&&value&&typeof value==='object')walk(value);}
  walk(json);
  if(!raw.length||raw.some(c=>!/^\d+$/.test(String(c.vap))||!c.n||!Number.isSafeInteger(Number(c.vap))))throw new Error('Votação oficial ausente ou inválida');
  const p=parseResult(json,P,job.uf);
  if(!p.candidates.length)throw new Error('O ficheiro não contém candidatos reconhecidos');
  if(p.candidates.some(c=>!c.number||!Number.isSafeInteger(c.votes)||c.votes<0))throw new Error('Identificação ou votação de candidato inválida');
  const pct=Number(String(json.s.pst).replace(',','.'));
  if(!Number.isFinite(pct)||pct<0||pct>100)throw new Error('Percentagem de secções inválida');
  const warnings=[];
  const total=p.candidates.reduce((n,c)=>n+c.votes,0);
  if(json.v?.vvc!=null&&Number(json.v.vvc)!==total)warnings.push('A soma dos candidatos difere do total de votos concorrentes do TSE.');
  p.candidates=p.candidates.map(c=>({...c,status:candidateStatus(c),classified:!!P.byAcr.get(String(c.party||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,''))}));
  const rank=p.candidates.filter(c=>c.valid).sort((a,b)=>b.votes-a.votes);
  const runoff=json.md==='s'||rank.some(c=>/2[º°o]?\s*turno/i.test(c.st));
  const final=json.tf==='s'||json.and==='f';
  const withoutWinner=json.esae==='s';
  const elected=rank.filter(c=>c.elected);
  const slots=Number(json.carg.find(c=>Number(c.cd)===job.cargo)?.nv)||null;
  let status=withoutWinner?'Sem atribuição de eleitos':runoff?'2º turno':final?'Totalização final':json.md==='e'?'Definido pelo TSE':total>0?'Apuramento em curso':'A aguardar votos';
  return {...p,uf:job.uf,cargo:job.cargo,office:OFFICES[job.cargo],generatedAt:officialTime(json.dg,json.hg),totalizedAt:officialTime(json.dt,json.ht),generation:String(json.idg||''),final,withoutWinner,runoff,slots,electedCount:elected.length,status,warnings,classificationVersion:PROFILE.classificationVersion,
    race:{office:OFFICES[job.cargo],cargo:job.cargo,pctSections:p.pctSections,decided:(final&&!withoutWinner)||runoff||((job.cargo===1||job.cargo===3)&&elected.length>0),status,slots,electedCount:elected.length,leader:rank[0]?.votes>0?{name:rank[0].name,party:rank[0].party,side:rank[0].side,pct:rank[0].pct}:null},
    events:!withoutWinner&&(job.uf==='BR'||job.cargo!==1)?eventsFrom({...p,candidates:p.candidates.filter(c=>c.valid)}, {uf:job.uf,office:OFFICES[job.cargo],isPresident:job.cargo===1,winsOnly:job.cargo>=6,minEventPct:.03}).map(e=>({...e,id:`2026-1-${job.uf}-${job.cargo}-${e.id}`,key:job.key})):[]};
}
