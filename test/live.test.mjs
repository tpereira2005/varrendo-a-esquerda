import test from 'node:test';
import assert from 'node:assert/strict';

const fixture = {pst:'50,00',cand:[{n:'22',nm:'Exemplo',sg:'PL',vap:'100',pvap:'60,00',e:'s'}]};
test('unavailable hosting cache does not prevent reading official data',async()=>{
  const original=globalThis.fetch;const cache=globalThis.caches;
  globalThis.caches={default:{match:async()=>{throw new Error('Cache disabled')},put:async()=>{throw new Error('Cache disabled')}}};
  globalThis.fetch=async()=>Response.json(fixture);
  try {
    const {readArea}=await import('../lib/live.mjs?cache-disabled');
    const d=await (await readArea('BR')).json();
    assert.equal(d.ok,true);assert.equal(d.presidential.votesRight,100);
  }finally{globalThis.fetch=original;globalThis.caches=cache;}
});
test('state batch fetches five fixed official URLs, caches and keeps several-seat races pending', async()=>{
  const original=globalThis.fetch; const urls=[];
  globalThis.fetch=async url=>{urls.push(url);return Response.json(fixture)};
  try {
    const {readArea}=await import('../lib/live.mjs?state');
    const d=await (await readArea('DF')).json();
    assert.equal(d.ok,true);assert.equal(urls.length,5);
    assert.ok(urls.some(u=>u.includes('df-c0008-e006259')));
    assert.ok(!urls.some(u=>u.includes('df-c0007')));
    assert.equal(d.races.find(r=>r.office==='Senador(a)').decided,false);
    assert.equal(d.presidential.votesRight,100);
    await readArea('DF');assert.equal(urls.length,5);
    assert.equal((await readArea('../SP')).status,400);
  }finally{globalThis.fetch=original;}
});
test('upstream block stops a batch and suppresses subsequent upstream requests',async()=>{
  const original=globalThis.fetch;let count=0;
  globalThis.fetch=async()=>{count++;return new Response('',{status:429})};
  try {
    const {readArea}=await import('../lib/live.mjs?block');
    const d=await (await readArea('SP')).json();
    assert.equal(d.ok,false);assert.equal(d.presidential,null);assert.equal(count,1);
    assert.ok(d.retryAt>Date.now());
    await readArea('BR');assert.equal(count,1);
  }finally{globalThis.fetch=original;}
});
test('network failure after expiry returns last good data and conditional headers',async()=>{
  const original=globalThis.fetch;const clock=Date.now;let time=clock();let count=0;
  Date.now=()=>time;
  globalThis.fetch=async(_url,opts)=>{
    count++;
    if(count===1)return Response.json(fixture,{headers:{etag:'test-etag'}});
    assert.equal(opts.headers['if-none-match'],'test-etag');throw new Error('offline');
  };
  try {
    const {readArea}=await import('../lib/live.mjs?stale');
    const first=await (await readArea('BR')).json();
    time+=301000;
    const second=await (await readArea('BR')).json();
    assert.equal(second.ok,false);assert.equal(second.presidential.votesRight,100);
    assert.equal(second.at,first.at);assert.match(second.errors[0].message,/offline/);
    await readArea('BR');assert.equal(count,2);
  }finally{globalThis.fetch=original;Date.now=clock;}
});
