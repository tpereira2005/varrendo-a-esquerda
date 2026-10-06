# Plano v2: Varrendo para a 2.ª volta (foco na Presidência)

> Plano escrito a 6 de outubro de 2026, antes da implementação. O funcionamento atual está descrito em [operacao.md](operacao.md).

Preparado a 6 de outubro de 2026 e revisto no mesmo dia para pôr a Presidência no centro do site. Substitui `plano-segunda-volta.md`, que fica guardado como referência.

**Objetivo:** até sexta-feira, **23 de outubro**, ter um site novo, estável e testado para acompanhar a noite de **domingo, 25 de outubro**. O site é um painel de torcida pelo **Flávio Bolsonaro (PL, 22)** contra o **Lula (PT, 13)**, com dados oficiais do TSE em tempo real. A 1.ª volta fica disponível como arquivo só de leitura.

**Princípio:** o site **torce** pelo Flávio na linguagem, nas cores, no boneco, nos avisos e nas celebrações. Os **números são sempre os do TSE, sem filtros**: se o Lula estiver à frente, o site mostra-o com clareza.

---

## 0. Regras invioláveis

1. Todos os números (votos, percentagens, secções, horas) vêm dos ficheiros oficiais do TSE e mostram-se como estão. Não se arredondam a favor de ninguém nem se escondem.
2. **Vitória só com indicação oficial do TSE.** Ir à frente, mesmo com 99% das secções, mostra-se como "à frente", nunca como "eleito".
3. Qualquer estimativa (por exemplo, "votos que faltam para virar") leva sempre o rótulo **"estimativa · não oficial"**.
4. Não há conteúdo a pôr em causa a contagem ou o processo eleitoral. Se o TSE corrigir um resultado, o site aplica a correção e diz que houve correção.
5. Se o Lula for eleito, o site mostra o resultado oficial de forma clara e sóbria, sem animação de festa nem negação do resultado.

---

## 1. Factos verificados

| | 1.ª volta | 2.ª volta |
|---|---|---|
| Foco do site | 5 cargos, 136 ficheiros | **Presidente: BR + 27 estados = 28 ficheiros** |
| Eleição TSE | federal 6257, `t=1` | campo `cdt2` no `ele-c.json`: **6258**, `t=2` (confirmar quando o TSE publicar) |
| Candidatos | 12 ou mais | **Flávio Bolsonaro (PL) × Lula (PT)** |
| Resultado da 1.ª volta (dados guardados no site) | Flávio **47,0%** · Lula **45,2%** | ponto de partida para a comparação |

- Os governadores (AC, AM, DF, ES, RJ, RN, TO, eleição 6260) passam a ser **secundários**: aparecem numa lista recolhida e são cortados primeiro se faltar tempo (§6).
- **Hora no dia da eleição:** a Europa passa para a hora de inverno nessa madrugada. Lisboa fica a Brasília + **3 h**, e as urnas fecham às **20h00 em Lisboa**. As horas são calculadas sempre com `Intl` e um fuso horário com nome.

---

## 2. Problemas atuais que este plano corrige

| # | Problema | Correção |
|---|---|---|
| P1 | A classificação binária conta o centrão como "esquerda" | Na 2.ª volta o placar é **Flávio × Lula pelo nome**; os agrupamentos deixam de contar para o número principal |
| P2 | A abrir, mostra "A aguardar dados" durante alguns segundos | A página é renderizada no servidor com os dados guardados (§5.1) |
| P3 | Os candidatos a Presidente aparecem como "Apuramento em curso" com a disputa já decidida (o `st` do candidato vem vazio e o estado da disputa vem do `md`) | O estado do candidato herda o da disputa (§3.3) |
| P4 | Turno, chaves `2026:1:…` e IDs de avisos fixos no código | Perfil por turno a partir da configuração oficial (§3.1) |
| P5 | A limpeza apaga as revisões com mais de 7 dias | Histórico guardado; arquivo da 1.ª volta congelado (§3.0) |
| P6 | Código compactado e interface inteira num HTML de 67 KB | Reescrita modular e formatada (§5, §7) |
| P7 | Cerca de 50 componentes shadcn e dependências não usados; `lib/live.mjs` é código morto | Limpeza (§7) |
| P8 | Token comparado com `!==` | Comparação em tempo constante (§7) |
| P9 | Commits todos chamados "Update Site source" | Commits descritivos e uma tag por publicação (§7) |
| P10 | Avisos só com a página aberta | Web Push no iPhone, como fase opcional (§6) |

---

## 3. Dados

### 3.0 Congelar a 1.ª volta (já)
1. Exportar a base D1 de produção (`wrangler d1 export`) para `outputs/backup-d1-turno1-AAAAMMDD.sql`.
2. `cleanup()` deixa de apagar revisões.
3. Gerar `data/turno1-presidente.json` com o resultado da 1.ª volta para o BR e para os 27 estados: votos de cada candidato, comparecimento, abstenção, brancos e nulos. É a base de todas as comparações e a vista de arquivo.

### 3.1 Perfil da 2.ª volta
- `lib/rounds.mjs` com `ROUND_1` congelado e `ROUND_2`.
- O coletor lê `ele-c.json` a cada 10 minutos até confirmar a eleição `cdt2` de 6257, com `t=2`, abrangência BR e cargo 1. O ID confirmado fica guardado na tabela `rounds`, e o código não depende de valores escritos à mão.
- Os finalistas são identificados pelo número: **22 = Flávio** e **13 = Lula**. Se o ficheiro trouxer outro número, a disputa fica com o aviso "finalista alterado pelo TSE".

### 3.2 Base de dados (migração aditiva 0003)
```sql
CREATE TABLE rounds (turn INTEGER PRIMARY KEY, federal INTEGER, estadual INTEGER, confirmed_at INTEGER);
ALTER TABLE results   ADD turn INTEGER NOT NULL DEFAULT 1;
ALTER TABLE revisions ADD turn INTEGER NOT NULL DEFAULT 1;
ALTER TABLE notices   ADD turn INTEGER NOT NULL DEFAULT 1;
CREATE TABLE timeline (key TEXT, generated_at INTEGER, at INTEGER, pct_sections REAL,
  votes_flavio INTEGER, votes_lula INTEGER, PRIMARY KEY(key, generated_at));
```
- As chaves passam a `2026:2:UF:1`. A tabela `timeline` guarda um ponto por cada nova geração oficial, para o BR e para cada estado.

### 3.3 Interpretação (`lib/runoff.mjs`)
Para o BR e para cada estado:
```
{ uf, pctSections, generatedAt, status,
  flavio: {votes, pct, votesR1, pctR1, gainR1},
  lula:   {votes, pct, votesR1, pctR1, gainR1},
  margin: {votes, pp},          // positivo = Flávio à frente
  leader: 'flavio'|'lula'|null,
  turnout: {comparecimento, abstencao, brancos, nulos, vsR1},
  toFlip: {votesNeeded, estimate: true},   // §4.3
  winner: null|'flavio'|'lula' }          // só oficial
```
- Correção de P3: o estado do candidato herda o estado da disputa.
- Ficheiros com `t=1`, de outra eleição ou com um terceiro candidato são rejeitados.

### 3.4 Recolha
- **28 fontes**, mais 7 de governador se essa secção se mantiver. Intervalos: **15 s** para o BR e 45 s para os estados.
- **Janela ativa:** das 16h30 de Brasília de 25/10 até à totalização final. Fora dela não há pedidos ao TSE.
- Mantêm-se o *lease*, o ETag, o *backoff*, a pausa em 403/429 e a rejeição de gerações mais antigas.

---

## 4. A perspetiva do Flávio

### 4.1 Identidade
- **Título:** "Varrendo a Esquerda". **Subtítulo:** "2.ª volta · Flávio 22 × Lula 13".
- **Cores:** azul e amarelo do lado do Flávio, vermelho para o Lula. O Flávio fica sempre à **esquerda do ecrã** e é lido primeiro.
- **Linguagem:** de quem torce, por exemplo "O Flávio vai à frente por 1,2 M de votos" ou "O Lula passou à frente, faltam 38% das secções". Sem insultos e sem afirmações falsas.

### 4.2 Boneco (as 10 reações originais)
| Situação (diferença Flávio − Lula) | Reação |
|---|---|
| Sem votos | `humor-06` (a aguardar) |
| Flávio > +8 pp | `humor-10` (euforia) |
| +4 a +8 pp | `humor-09` |
| +1 a +4 pp | `humor-08` |
| 0 a +1 pp | `humor-07` (tenso) |
| 0 a −1 pp | `humor-05` |
| −1 a −4 pp | `humor-04` |
| −4 a −8 pp | `humor-03` |
| < −8 pp | `humor-02` |
| Lula eleito oficialmente | `humor-01` |

Antes de fechar esta tabela, é preciso ver as imagens para confirmar a ordem real das expressões em `public/emoji/`.

### 4.3 "Para virar" (estimativa)
- Quando o Lula vai à frente, aparece: *"O Flávio precisa de ~X% dos votos que faltam apurar"*.
- Quando o Flávio vai à frente: *"O Lula precisa de ~X% dos votos que faltam"*. Um valor acima de 60% tem a nota "muito difícil".
- **Cálculo:** os votos por apurar em cada estado estimam-se como o comparecimento da 1.ª volta × as secções por apurar. Soma-se por estado e não se faz uma extrapolação nacional.
- Leva sempre o rótulo "estimativa · não oficial". O cálculo é feito com os números do TSE e não favorece ninguém.

### 4.4 Avisos
1. **Viradas:** "O Flávio passou à frente!" ou "O Lula passou à frente". Contam a partir de 20% das secções e só quando a mudança se mantém em duas gerações oficiais seguidas.
2. **Marcos:** "50% das secções apuradas, o Flávio vai à frente por X". Há marcos aos 25%, 50%, 75%, 90% e 99%.
3. **Estados:** quando um estado fica 100% apurado, aparece "O Flávio venceu em SC (+X pp)" ou "O Lula venceu na BA". Nos estados que mudaram de lado face à 1.ª volta, o aviso traz "**virou para o Flávio**".
4. **Resultado oficial:** "**FLÁVIO BOLSONARO ELEITO PRESIDENTE**" leva ecrã de celebração (confetes verdes e amarelos, boneco em euforia). "Lula eleito pelo TSE" leva um ecrã sóbrio. As duas mensagens só aparecem com a indicação oficial.
5. **Correções do TSE:** são mostradas sempre.

---

## 5. Interface

### 5.1 Arquitetura
- `app/page.tsx` é renderizada no servidor: lê a D1 e envia o HTML já com os números. Uma componente cliente consulta `/api/state` com um intervalo adaptado:
  - 5 s durante a janela ativa;
  - 60 s fora dela;
  - pausa quando o separador está oculto.
- A página é feita em React com Tailwind, e o `painel.html` é retirado. A rota `/painel` redireciona para `/`.

### 5.2 Ecrã principal (de cima para baixo, pensado para iPhone)
1. **Topo:** estado da noite (Antes da abertura / Apuramento / Encerrado), hora de Lisboa em destaque e hora de Brasília ao lado.
2. **Placar:** Flávio à esquerda e Lula à direita, com percentagem grande, votos e uma barra dividida com marca nos 50%. Por baixo: **diferença em votos e em pp**, percentagem de secções e "Atualizado há X s (ficheiro TSE hh:mm)". Boneco ao lado.
3. **"Para virar"** (§4.3).
4. **Evolução da noite:** gráfico da diferença em função da percentagem de secções, a partir da tabela `timeline`. As viradas ficam marcadas.
5. **Mapa:** cada estado é pintado pelo candidato que vai à frente, com intensidade conforme a diferença. Para não depender só da cor, mostra também a UF e um símbolo (▲ Flávio / ● Lula). Os estados que "viraram" face à 1.ª volta têm contorno dourado.
6. **Placar de estados:** "Flávio vence em N estados · Lula em M · por definir K", contando só os estados com 100% apurado.
7. **Onde o Flávio cresceu:** ranking dos estados pelo ganho do Flávio face à 1.ª volta, em pp e em votos. Mostra também onde o Lula cresceu mais.
8. **Detalhe do estado** (ao tocar no mapa ou na lista): a 2.ª volta comparada com a 1.ª, a abstenção e os brancos e nulos.
9. **Avisos:** a lista do §4.4.
10. **Secundário, recolhido:** Governadores (§6) e Arquivo da 1.ª volta.

### 5.3 Pormenores
- Se não houver uma geração oficial nova durante 3 minutos na janela ativa, aparece "Sem novos dados do TSE".
- Os números mudam com uma animação curta, desligada quando `prefers-reduced-motion` está ativo.
- Tema claro e escuro conforme o sistema. Instalável no ecrã principal.
- Nenhum deslocamento horizontal a 320, 375, 390 e 430 px; alvos de toque com pelo menos 44 px.
- **Texto em português de Portugal:** "volta", "secções", "ficheiro", "atualizado há". Números com `Intl.NumberFormat('pt-PT')`.

---

## 6. Fases opcionais (são as primeiras a cortar)

- **Governadores:** uma lista recolhida com as 7 disputas (mini-barra, diferença e estado), sem boneco nem "para virar". Os avisos só aparecem quando o candidato do PL ou do Republicanos for eleito, o que dá AC, AM, ES e RJ.
- **Notificações no iPhone (Web Push):**
  - funcionamento: service worker, VAPID e subscrição na D1; o coletor envia as viradas, os marcos e o resultado oficial;
  - requisitos: iOS 16.4 ou posterior com o site instalado no ecrã principal;
  - antes de avançar: confirmar que o alojamento Sites permite um service worker na raiz e pedidos às APIs de push.

  Decidir a 20/10.

---

## 7. Qualidade do código

- **Estrutura:** `lib/tse/`, `lib/rounds.mjs`, `lib/runoff.mjs`, `lib/store.mjs`, `lib/collector.mjs` e `components/*`.
- **Prettier e ESLint:** largura de 100 e ESLint a passar.
- **Remover:** os `components/ui/*` não usados, as dependências não usadas, `lib/live.mjs` com o seu teste, e `examples/`.
- **Token:** `/api/collect` passa a comparar o token em tempo constante.
- **Git:** commits descritivos e uma tag em cada publicação (`sites-v7`, …).
- **Documentação:** `docs/` reescrito para a 2.ª volta, com o *runbook* da noite (§9).

---

## 8. Testes e ensaio geral

1. **Testes unitários:**
   - rejeição de turno e eleição errados;
   - identificação 22/13 e terceiro candidato;
   - herança de estado (P3);
   - vencedor só oficial;
   - viradas com histerese e marcos sem repetição;
   - "para virar" com casos conhecidos;
   - comparação com a 1.ª volta;
   - `timeline` sem pontos duplicados.
2. **Ficheiros de exemplo da 2.ª volta:** gerados a partir dos ficheiros reais da 1.ª (`ele=6258`, `t=2`, só 22 e 13), em vários estados de apuramento: 0%, 10%, Lula à frente, virada para o Flávio, 99%, Flávio eleito e Lula eleito.
3. **Simulador do TSE** (`scripts/fake-tse.mjs`): serve a sequência ao longo do tempo e inclui um 429 e uma geração antiga. O coletor aponta para ele com `TSE_BASE`, que só existe em desenvolvimento.
4. **Ensaio geral a 21 ou 22/10:** 30 minutos de simulação num iPhone a sério com Safari. Testar os dois finais, celebração e resultado sóbrio.
5. **Teste em produção:** fora da janela ativa não há pedidos ao TSE, o arquivo da 1.ª volta está intacto e escrever sem token devolve 401.

---

## 9. Calendário e noite da eleição

| Data | Marco |
|---|---|
| ter 6 – qua 7 out | §3.0: backup, desligar a limpeza e congelar a 1.ª volta. Publicar a v7 |
| qui 8 – dom 11 | §3: perfil, migração, coletor e `runoff.mjs`, com testes |
| seg 12 – qua 14 | §4: boneco, "para virar" e avisos |
| qui 15 – dom 18 | §5: nova interface |
| seg 19 – ter 20 | §7: limpeza e documentação. Decidir as fases opcionais |
| qua 21 – qui 22 | §8: simulador e ensaio geral no iPhone |
| **sex 23** | **Publicação final congelada**. Só correções críticas a partir daqui |
| sáb 24 | Confirmar a eleição 6258 no `ele-c.json`; verificação em produção |
| **dom 25** | 19h30 em Lisboa: abrir o site. 20h00 em Lisboa: fecho das urnas e primeiros ficheiros. Acompanhar até ao resultado oficial |
| seg 26 | Desligar a recolha e congelar a 2.ª volta no arquivo |

**Plano de emergência para a noite**
- Se o TSE bloquear (403/429), o site entra em pausa sozinho. Não insistir à mão.
- Se um formato mudar, ativar `COLLECTION_PAUSED=1` e mostrar o último resultado bom.
- Se uma publicação falhar, voltar à versão Sites anterior; os dados ficam na D1.

---

## 10. Decisões em aberto (com a minha recomendação)

1. **Governadores:** manter a lista recolhida só se a Presidência estiver pronta a 18/10.
2. **Fotos do TSE (`fotos/`):** usar se a URL estiver disponível; se não, usar as iniciais.
3. **Web Push:** decidir a 20/10.
4. **Horas:** Lisboa em destaque e Brasília em segundo plano.
