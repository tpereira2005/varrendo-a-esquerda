# Referência e funcionamento

Referência preservada: commit `c9171702a21ae859204eda9d799fa18923e0d70f`, tag local `baseline-2026-10-04-v2`. A tabela `lib/parties.json` e a classificação do autor foram mantidas. Os ficheiros em `test/fixtures` são exemplos oficiais capturados em 4 de outubro de 2026, antes da divulgação de votos; não são resultados finais. `source-reference.json` regista os endereços e horários de captura.

## Fontes verificadas

- [Informações técnicas do TSE](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados): ciclo ele2026, eleições 6257 e 6259; bloqueios HTTP 403/429 exigem pausa de pelo menos dez minutos.
- [Formato EA20 de resultados unificados](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea20-arquivo-de-resultado-unificado): estados oficiais de candidatos, vagas, finalização, segunda volta e horários.
- [Projeto original](https://github.com/ODevLibertario/varrendo-a-esquerda).

## Dados e interpretação

136 fontes fixas: Presidente nacional e Presidente, Governador, Senador, Deputado federal e Deputado estadual/distrital em cada unidade federativa. A fonte nacional de Presidente é o ficheiro BR; não se somam as percentagens dos estados. O Distrito Federal usa cargo 8.

Uma concessão temporária na base D1 permite apenas uma recolha de cada vez. Cada invocação faz até oito pedidos, com espaçamento de 150 ms e timeout de 15 s por fonte. Após o ciclo, a próxima recolha fica agendada para cinco minutos depois. Visitantes consultam uma base partilhada, não iniciam recolhas independentes. GET /api/state pode avançar um lote quando é devido. POST /api/collect usa um segredo de servidor. GET /api/area apenas lê dados persistidos.

Guardam-se por fonte a última resposta válida, revisão normalizada, resumo leve, hash, cabeçalhos condicionais, geração oficial, última verificação válida, última tentativa, erro e nova tentativa. Uma falha parcial conserva o resultado desse cargo sem apagar os outros. HTTP 403/429 pausa toda a recolha. Respostas de geração anterior são rejeitadas; uma correção mais recente com votos a diminuir é aceite.

Votos inválidos não entram no agrupamento. A liderança e 100% das secções, isoladamente, não declaram eleitos. Nos cargos proporcionais, a indicação de eleito é do TSE. O Senado conserva a contagem de vagas (duas em 2026). Eventos persistentes têm identidade estável: atualizar votos não repete um aviso; retirar uma eleição oficial retira o aviso e regista uma correção. Revisões e correções inativas têm retenção de sete dias. Não são previsões, sondagens nem classificações oficiais de ideologia.

O telemóvel recebe os resumos e apenas os candidatos do estado/cargo escolhido. A página usa controlos nativos, tamanho mínimo de 44 px, fontes de sistema, margens para as áreas seguras e seleção de estado alternativa ao mapa. As preferências locais são apenas estado, avisos e animações. Os avisos funcionam com a página aberta; não são notificações push do iOS.

## Recolha sem visitantes

A tarefa cloud ligada a este Site deve obter os metadados com get_site, usar o token de serviço existente como `x-collector-token` num POST para `/api/collect`, repetir os lotes até `complete=true`, e verificar `/api/state`. Se `busy=true`, parar quando há pausa ou próxima recolha no futuro; uma concessão ainda ativa pode ser reavaliada numa execução posterior. Nunca gerar ou alterar tokens. Os valores ficam no gestor de segredos Sites, nunca neste documento, no browser ou no repositório. Não se publica uma nova versão para atualizar dados.

## Validação e recuperação

`node --test` cobre formatos de todos os cargos, classificação original, liderança, Senado, proporcionais, validação de ficheiros, concorrência, limites de pedidos, falhas, bloqueios, persistência, respostas condicionais e correções. A base local é separada da base alojada. As migrations são guardadas com o código. Não apagar a base para corrigir uma falha.

Para recuperar uma publicação, selecionar a versão Sites anterior preservada. As tabelas acrescentadas são compatíveis com a versão antiga; conservar os dados. Se uma fonte mudar, pausar a recolha, verificar a documentação TSE, corrigir a normalização e validar com um exemplo real antes de republicar. Verificar logs do Worker e horários por cargo. Os resultados oficiais podem ser retificados pelo TSE.
