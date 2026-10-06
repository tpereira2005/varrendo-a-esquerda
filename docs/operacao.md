# Operação: 2.ª volta (25 de outubro de 2026)

Painel Flávio Bolsonaro (PL, 22) × Lula (PT, 13), do ponto de vista de quem torce pelo Flávio. Números sempre oficiais do TSE.

## Regras do site

1. Votos, percentagens, secções e horas vêm dos ficheiros oficiais do TSE, sem filtros.
2. Vitória só com indicação oficial (estado "Eleito" ou totalização final `tf=s`, `and=f`). Ir à frente com 100% das secções não chega.
3. "Para virar" é uma estimativa e está sempre identificada como tal.
4. Correções do TSE retiram avisos e ficam registadas em "Correções do TSE".
5. **Atenção:** no ficheiro final da 1.ª volta, o TSE marca `e="s"` nos dois finalistas com o estado "2º turno". O código só considera eleito quem tiver o estado "Eleito" (`isElected` em `lib/tse.mjs`).

## Estrutura

| Ficheiro | Função |
|---|---|
| `data/turno1.json` | Resultados finais da 1.ª volta (Presidência BR + 27 estados; Governador nos 7 estados com 2.ª volta). Gerado por `scripts/build-turno1.mjs` a partir dos ficheiros oficiais. Nunca muda. |
| `lib/tse.mjs` | Leitura do formato unificado do TSE. |
| `lib/rounds.mjs` | As 35 disputas, os finalistas, os IDs da eleição (6258/6260) e a leitura da configuração oficial. |
| `lib/runoff.mjs` | Validação de cada ficheiro, vencedor, avisos (viradas, marcos, estados, resultado), "para virar", boneco. |
| `lib/store.mjs` | Base D1 (`turn = 2`); a 1.ª volta fica intocada com `turn = 1`. |
| `lib/collector.mjs` | Recolha (concessão única, ETag, backoff, pausa em 403/429) e estado para a página. |
| `app/page.tsx` + `components/painel/*` | Página renderizada no servidor e atualizada no cliente. |
| `app/api/state` | Estado atual; durante a noite também mantém a recolha viva. |
| `app/api/collect` | Recolha autenticada (`x-collector-token`, comparado em tempo constante). |
| `app/api/arquivo` | Arquivo da 1.ª volta (estático). |
| `scripts/fake-tse.mjs` | Simulador local do TSE para ensaios. |

## Recolha

- Janela ativa: de 25/10 às 16h30 de Brasília (19h30 em Lisboa) até todas as disputas terem totalização final. Fora dela não há pedidos ao TSE.
- Intervalos: Brasil e estado escolhido a cada 15 s; restantes a cada 45 s. Um ficheiro final deixa de ser pedido.
- A configuração `ele-c.json` é lida no máximo a cada 10 minutos. Os IDs 6258/6260 (campo `cdt2` da 1.ª volta) ficam "confirmados" quando o TSE publicar as eleições com `t=2`.
- 404 (ficheiro ainda não publicado): nova tentativa ao ritmo normal. 403/429: pausa global de pelo menos 10 minutos (ou o `Retry-After`).
- A recolha é feita pelos pedidos de quem tem a página **aberta e visível**. A tarefa horária do Sites (`POST /api/collect`) é só uma rede de segurança.

## Variáveis

| Variável | Uso |
|---|---|
| `COLLECTOR_TOKEN` | Segredo da recolha autenticada (gestor de segredos do Sites). |
| `COLLECTION_PAUSED=1` | Pára toda a recolha; mostra os dados guardados. |
| `COLLECTION_FORCE=1` | Só para ensaio local: recolhe fora da janela da noite. **Nunca em produção.** |
| `TSE_BASE` | Só para ensaio local; aceita apenas `http://127.0.0.1` ou `http://localhost`. |

## Ensaio local

1. `npm run build` e aplicar a migração `drizzle/0003_segunda_volta.sql` à base local (ver README, "Local D1 migrations").
2. Criar `.dev.vars` com `COLLECTION_FORCE=1` e `TSE_BASE=http://127.0.0.1:8787`.
3. `node scripts/fake-tse.mjs --origem=<pasta com os ficheiros da 1.ª volta>` (opções: `--passo=20`, `--final=lula`, `--com-429`).
4. `npm run dev` e abrir http://localhost:5173 (a página tem de estar visível para a recolha avançar).
5. Testes automáticos: `node --test test/*.test.mjs`.

Para repetir o ensaio do zero, apagar as linhas da 2.ª volta da base local:

```sql
DELETE FROM results WHERE turn=2; DELETE FROM revisions WHERE turn=2; DELETE FROM notices WHERE turn=2;
DELETE FROM timeline; DELETE FROM rounds; UPDATE collector SET next_at=0, pause_until=0, cursor=0;
```

## Publicação (Codex / plugin Sites)

1. Publicar este ramo com o mesmo identificador de site (`.openai/hosting.json`). A publicação aplica a migração 0003 à base de produção; é aditiva e não toca na 1.ª volta.
2. Confirmar que `COLLECTION_PAUSED` **não** está a `1` e que `COLLECTION_FORCE` e `TSE_BASE` **não** existem em produção.
3. Verificar: `/` abre com "Antes do fecho das urnas"; `/painel` redireciona para `/`; `/api/arquivo` responde; `POST /api/collect` sem token devolve 401.

## Noite da eleição

| Hora (Lisboa) | O que fazer |
|---|---|
| sáb 24 | Confirmar na configuração do TSE as eleições 6258/6260 com `t=2`. Abrir o site: deve dizer "Antes do fecho das urnas". |
| dom 25, 19h30 | Abrir o site (iPhone ou computador) e deixá-lo visível. |
| 20h00 | Fecho das urnas e primeiros ficheiros. |
| até ao fim | Acompanhar. Não insistir à mão se o TSE pedir pausa. |
| seg 26 | Publicar com `COLLECTION_PAUSED=1` e congelar a 2.ª volta. |

Emergências: formato inesperado → `COLLECTION_PAUSED=1` (mantém o último resultado bom); publicação falhada → voltar à versão Sites anterior (os dados ficam na D1). Nunca apagar a base.
