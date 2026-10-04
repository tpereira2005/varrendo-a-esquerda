import fs from 'node:fs';
const file='public/painel.html';
let html=fs.readFileSync(file,'utf8');
html=html.replace('</style>', `
.method-note {margin:12px 0 20px;padding:12px 16px;border:1px solid var(--line,#ddd);border-radius:12px;font-size:13px;line-height:1.6;background:var(--panel,#fff)}
.method-note a {color:inherit;text-decoration:underline}
#liveStatus {font-weight:600}
</style>`);
html=html.replace('<section class="score"', `<div class="method-note"><strong>Classificação do autor:</strong> PL, NOVO, REPUBLICANOS, MISSÃO e PRD contam como direita; todos os outros partidos, incluindo desconhecidos, contam como esquerda. <a href="https://github.com/ODevLibertario/varrendo-a-esquerda/blob/main/parties.json" target="_blank" rel="noopener">Consultar critérios</a>. Os votos e os estados de eleição vêm do TSE.<br><span id="liveStatus" role="status" aria-live="polite">A ligar ao TSE…</span> · <a href="https://resultados.tse.jus.br/" target="_blank" rel="noopener">Resultados oficiais</a></div>\n<section class="score"`);
html=html.replace('Horário de Brasília. O intervalo de atualização é definido pelo servidor.', 'Horário de Brasília. Recolha automática por lotes de 5 em 5 minutos enquanto esta página estiver aberta.');
html=html.replace('Fonte TSE indisponível, mostrando último dado', 'Dados incompletos ou fonte TSE indisponível. Alguns valores podem estar desatualizados.');
html=html.replace('render(null); renderFeed(); renderPending();', 'render(null); renderFeed(); renderPending();');
html=html.replace('if (!selected) return;\n  const list', 'if (!selected) return;\n  if (!races[selected]?.length) { ol.innerHTML = `<li class="empty">A aguardar dados dos cargos deste estado.</li>`; return; }\n  const list');
html=html.replace('  const fresh = (msg.events || [])', `  const currentIds = new Set((msg.events || []).map(ev => ev.id));
  for (let i = allEvents.length - 1; i >= 0; i--) if (!currentIds.has(allEvents[i].id)) { seen.delete(allEvents[i].id); allEvents.splice(i,1); }
  const fresh = (msg.events || [])`);
html=html.replace('  tickClock();\n}', '  renderFeed();\n  tickClock();\n}');
html=html.replace(/const es = new EventSource\("\/api\/events"\);[\s\S]*?es\.addEventListener\("snapshot"[^\n]*\);/, `
const areaData = new Map();
const statusEl = document.getElementById('liveStatus');
let liveBusy = false;
let liveTimer;
let cycleEnd = 0;
function drawLive() {
  const br = areaData.get('BR');
  const states = {}, races = {}, events = [];
  const times = [];
  let ok = areaData.size === 28;
  for (const [uf, d] of areaData) {
    ok = ok && d.ok;
    if (d.at) times.push(d.at);
    if (uf !== 'BR') {
      if (d.presidential) states[uf] = d.presidential;
      races[uf] = d.races;
    }
    events.push(...d.events);
  }
  events.sort((a,b) => b.at-a.at);
  onSnapshot({mode:'tse',serverNow:Date.now(),national:br?.presidential||{},states,races,events,
    refreshedAt:times.length?Math.min(...times):0,nextRefreshAt:cycleEnd,source:{ok}});
}
async function loadArea(uf) {
  const res = await fetch('/api/area?uf='+uf, {cache:'no-store',signal:AbortSignal.timeout(90000)});
  if (!res.ok) throw new Error('O alojamento não respondeu: HTTP '+res.status);
  const d = await res.json();
  if (!Array.isArray(d.events) || !Array.isArray(d.races)) throw new Error('Resposta de dados inválida.');
  const old = areaData.get(uf);
  if (!d.presidential && old?.presidential) d.presidential=old.presidential;
  if (!d.races.length && old?.races?.length) {d.races=old.races;d.events=old.events;d.at=old.at;}
  areaData.set(uf,d);
  drawLive();
  return d;
}
async function refreshLive() {
  if (liveBusy) return;
  liveBusy=true; clearTimeout(liveTimer); cycleEnd=0;
  let pauseUntil=0;
  try {
    statusEl.textContent='A recolher resultados nacionais…';
    const br=await loadArea('BR');
    if (!br.ok) throw new Error(br.errors?.[0]?.message || 'Resultados nacionais indisponíveis.');
    const ordered = selected ? [selected,...UFS.filter(uf=>uf!==selected)] : UFS;
    for (let i=0;i<ordered.length;i++) {
      statusEl.textContent='A recolher estados: '+(i+1)+' / 27 · '+ordered[i];
      const d=await loadArea(ordered[i]);
      if(d.retryAt>Date.now()+120000) {pauseUntil=d.retryAt;throw new Error('O TSE limitou temporariamente as consultas.');}
      await new Promise(r=>setTimeout(r,150));
    }
    const failed=[...areaData.values()].filter(d=>!d.ok).length;
    statusEl.textContent=failed ? 'Recolha concluída com falhas em '+failed+' região(ões). Consulte os resultados oficiais.' : 'Ligado ao TSE · Brasil e 27 estados recolhidos.';
  } catch(e) {
    const d=areaData.get('BR');pauseUntil=Math.max(pauseUntil,d?.retryAt||0);
    statusEl.textContent=e.message+' Nova tentativa automática agendada.';
    document.getElementById('srcWarn').hidden=false;
  } finally {
    liveBusy=false;cycleEnd=Math.max(Date.now()+300000,pauseUntil);nextRefreshAt=cycleEnd;tickClock();
    liveTimer=setTimeout(refreshLive,cycleEnd-Date.now());
  }
}
refreshLive();
`);
fs.writeFileSync(file,html);
