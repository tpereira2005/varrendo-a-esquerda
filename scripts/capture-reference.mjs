import fs from 'node:fs';
const base='https://resultados.tse.jus.br/oficial';
const targets=[['config',base+'/comum/config/ele-c.json'],['BR-presidente',base+'/ele2026/6257/dados/br/br-c0001-e006257-u.json'],...[[3,'governador'],[5,'senador'],[6,'deputado-federal'],[7,'deputado-estadual']].map(([c,n])=>['SP-'+n,base+'/ele2026/6259/dados/sp/sp-c'+String(c).padStart(4,'0')+'-e006259-u.json']),['DF-distrital',base+'/ele2026/6259/dados/df/df-c0008-e006259-u.json']];
const index=[];
for(const [name,url] of targets){const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(name+': '+r.status);const data=await r.json();fs.writeFileSync('test/fixtures/'+name+'.json',JSON.stringify(data));index.push({name,url,capturedAt:new Date().toISOString(),generation:data.idg,keys:Object.keys(data)});console.log(name+': captured');await new Promise(r=>setTimeout(r,150));}
fs.writeFileSync('docs/source-reference.json',JSON.stringify(index,null,2));
