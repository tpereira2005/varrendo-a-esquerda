# Plano da véspera (sábado, 24/10/2026, à noite)

Atualização única do ponto de partida da projeção, com os dados mais recentes possíveis.
Até lá `data/vespera.json` fica com `"ativo": false` e o site usa o modelo atual (só transferências da 1.ª volta).

## O que muda quando se ativa

1. **Transferências**: os votos dos eliminados passam a dividir-se como na sondagem Datafolha (46% Flávio, 32% Lula, resto branco/nulo).
   PL, NOVO, PSD e PP (`manter`) continuam com a retenção atual.
2. **Âncora nas sondagens**: os pontos de partida de todos os estados deslizam juntos (mesmo desvio em logit), até a média nacional coincidir com a combinação entre o modelo e a média das sondagens.
   O peso de cada lado depende da incerteza de cada um.
3. **Cartão "Projeção"**: aparece a linha "Sondagens: Flávio X% · Polymarket: Y% · média de N institutos (período) · não oficial".

Nada disto mexe nos resultados do TSE: só no ponto de partida, que perde peso à medida que a contagem avança.

## Passos (cerca de 30 min)

1. **Sondagens**: `node scripts/sondagens.mjs` (ou `node scripts/sondagens.mjs 5`, se houver muitas sondagens novas).
   - Confirmar que a tabela foi lida: número de institutos e períodos de campo plausíveis.
   - Ver a evolução por semana: há tendência na última semana?
   - Ter em conta que no sábado podem sair as últimas Datafolha, Quaest e AtlasIntel. Se a Wikipédia ainda não as tiver, acrescentá-las à mão no resumo.
2. **Global Election Simulator**: reler https://globalelectionsimulator.com/brazil e comparar:
   - o valor nacional e a probabilidade;
   - que sondagens usa e de que datas;
   - se mudou as transferências.
   Em 21/10 dava 52,90%, com sondagens antigas e transferências mais favoráveis ao Flávio do que o próprio Datafolha.
   Serve de comparação, não de fonte.
3. **Transferências**: procurar um novo cruzamento ("eleitores de Ciro/Simone/... na 2.ª volta") de Datafolha ou Quaest.
   Se existir, atualizar `transferencias.padrao` e `_fonte`.
4. **Pré-visualização**: `node scripts/vespera.mjs`. Mostra a projeção inicial atual, só com as transferências novas, e com a âncora.
   Em 21/10: 52,37% / 74% → 51,46% / 65% → 51,18% / 69%.
5. **Ativar** em `data/vespera.json`:
   - `ativo: true`;
   - `atualizado: "2026-10-24T22:00"`;
   - `sondagens.flavio`: a média do passo 1;
   - `sondagens.institutos` e `sondagens.periodo` (ex.: `"18–24/10"`);
   - `incerteza` fica em 2.0, a menos que as sondagens estejam muito dispersas.
6. **Verificar**: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run projecao:real` e `npm run build`.
   O backtest real não deve piorar, porque as âncoras só tocam na 2.ª volta de 2026.
7. **Commit e push** ("Véspera: âncora nas sondagens de 24/10").
8. **Publicar via Codex** (só o utilizador), ainda no sábado.
9. **Confirmar em produção**: `/api/state` mostra `projection.prior` perto do valor da pré-visualização, e o cartão mostra a linha "Sondagens".

## Para recuar

Se algo correr mal: `"ativo": false`, depois commit e publicação. O site volta exatamente ao modelo de antes.
