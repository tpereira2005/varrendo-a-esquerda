# Atualização do dia eleitoral — 25/10/2026

Média simples da sondagem nacional de segundo turno mais recente de cada instituto, com campo terminado nos últimos sete dias (19–25/10). As 19 fontes verificadas têm fim de campo entre 19 e 24/10. Média: **Flávio 50,94% / Lula 49,06%**, mediana 51%, intervalo entre institutos 49,4–52% para Flávio. Não é uma previsão nem uma nova sondagem.

Atualizadas as publicações Datafolha, PoderData, Nexus, AtlasIntel, Quaest, Palver, Gerp, Futura e Veritá. Acrescentadas CNT/MDA, Instituto França e Colectta. Restantes sete entradas conservam a última publicação verificada. Fontes, períodos, amostras e registos transcritos estão em `data/sondagens-verificadas.json`; resumo reproduzível em `data/sondagens.json`. Não foram verificados independentemente os registos no portal TSE. Fontes originais quando acessíveis ou reportagens identificadas com ficha técnica; dados discordantes de compilações não substituem automaticamente as fontes. Registos sem resultados confirmados não entram na média.

Uma conversão: Palver publicou totais 50/49; quota calculada 100×50/99 = 50,5051%. Tem nota explícita e não é apresentada como válidos originalmente publicados. Quaest agora usa válidos publicados51/49, substituindo a antiga conversão de totais. Nexus50,5/49,5 usa a amostra geral; o seu modelo de eleitor provável52,4/47,6 fica documentado como recorte separado, sem contar duas vezes nem substituir silenciosamente o universo. Veritá passa para a publicação final de24/10, campo19–23/10, BR-03181/2026,51,56/48,44.

## Cenário principal

O utilizador autorizou atualizar sondagens e rever o cenário após a verificação do dia eleitoral. Mantendo o objetivo anterior de acompanhar o mapa do Global Election Simulator, o cenário manual foi revisto de53,2 para **52,26% Flávio /47,74% Lula**. O cartão conserva o rótulo de cenário manual e a explicação fica nos detalhes. Referência: https://globalelectionsimulator.com/brazil/ consultado em25/10. O mapa52,26 é escolhido pelo autor; o seu guia distingue a combinação calculada51,52 e as sondagens ajustadas51,58 (datadas23/10). Nenhum desses números foi inserido na média das nossas sondagens.

O nosso modelo mantém a incerteza existente, sem a escolher para alcançar uma probabilidade. Antes dos primeiros votos dá cerca de82,49% de vitória para Flávio e17,51% para Lula; a interface arredonda para82/18. São probabilidades condicionais ao cenário, não probabilidades publicadas pelo GES. Intervalo95% para Flávio aproximadamente47,52–57,00. Sem o ajuste manual, a combinação própria de primeira volta, transferências e média atual daria51,19% e69% de vitória. Isso permite avaliar a diferença entre dados e cenário assumido.

O ajuste continua uniforme em logit, sem alterar votos esperados ou incertezas; os votos observados corrigem-no e o resultado oficial prevalece. Cache de contingência renovada para a versão22, para não recuperar uma projeção antiga de53,2 numa falha após a publicação. Histórico anterior preservado nos documentos e fotografias de24/10.

O importador ignora agora linhas da compilação com soma zero (linhas vazias), evitando NaN no contexto semanal. A compilação continua apenas para descoberta; a média usa exclusivamente as entradas verificadas.

## Preparação operacional

71 testes e TypeScript aprovados na verificação prévia. Tarefa GitHub ativa, arranque19h20 Lisboa, recolha abre19h30, urnas fecham20h00; tentativas adicionais19h45,20h15,22h00. Ensaio real de1min em25/10: https://github.com/tpereira2005/varrendo-a-esquerda/actions/runs/40184297609 . Primeiro pedido excedeu25s, dois seguintes recuperaram; cinco verificações diretas posteriores200, sem contingência ou erros do coletor. Não é garantia de capacidade sob carga. Não foi alterada a tarefa nem forçada recolha antecipada.

O utilizador confirmou a receção da notificação de teste no iPhone com a aplicação fechada. Essa confirmação conclui a verificação física pendente no documento de24/10.
