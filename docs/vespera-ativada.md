# Atualização de 24/10/2026

A média foi posteriormente alargada para 16 institutos (51,06% Flávio / 48,94% Lula), após conferência; ver `docs/sondagens-2026-10-24.md`. Mantém-se o cenário manual principal de 53,2%. Os três institutos e os números iniciais abaixo ficam como histórico da primeira atualização.

## Cenário principal escolhido posteriormente

Por pedido explícito do utilizador, o valor principal passou para um cenário manual de 53,2% para Flávio e 46,8% para Lula, identificado no cartão. A deslocação é uniforme em logit nos pontos de partida estaduais, preservando votos válidos esperados e incertezas. Não se modificaram os valores das sondagens, as suas fontes nem a incerteza para obter uma probabilidade escolhida. Com desvio-padrão nacional efetivo de aproximadamente 2,4195 pp, a probabilidade condicional de vitória é 90,70% para Flávio e 9,30% para Lula; o intervalo de 95% do cenário é aproximadamente 48,46–57,94%. Os resultados observados durante o apuramento continuam a corrigir o cenário e o resultado oficial prevalece. Os números seguintes documentam a previsão anterior, baseada nas fontes.

A âncora usa votos válidos publicados em fontes originais conferidas: Datafolha 50%, PoderData 51% e Nexus 50,3% para Flávio (fichas, datas e fontes em `data/sondagens-verificadas.json`). Média simples: 50,43%. A compilação de outros institutos é conservada como contexto, sem entrar automaticamente na previsão enquanto os valores originais não forem conferidos.

Transferência do conjunto de eliminados: Datafolha, campo 20–22/10, 47% para Flávio e 26% para Lula. Não é uma medição exata por candidato ou estado. As pequenas candidaturas de esquerda mantêm os pressupostos anteriores; finalistas mantêm retenção simétrica de 97%. Não se transferiu uma classificação política de partido para uma taxa nova de retenção.

Antes de votos, o resultado é aproximadamente 50,83% Flávio / 49,17% Lula, probabilidade de vitória de 63%, intervalo de cerca de 46,1–55,6%. A incerteza de 2 pp na âncora é um desvio-padrão conservador, não a margem de erro publicada. A combinação por variância é uma aproximação; as fontes não são perfeitamente independentes. A incerteza regional e estadual permanece no modelo.

Sensibilidade com transferências novas: âncora 50,5% dá 50,88%; âncora 51% dá 51,23%; âncora 51,5% dá 51,57%. Sem âncora, só transferências novas dão 51,74%. Não escolher o centro em função do candidato desejado. O Global Election Simulator descreve uma combinação calculada próxima de 51,53%, mas mostra um cenário do proprietário de 53,20%; nenhum foi importado como dado de sondagem.

O painel tem novas tentativas de leitura (até três, apenas leituras) e uma fotografia de contingência da cache do Worker, no máximo com dez minutos, explicitamente marcada. A fotografia de contingência não é renovada por falhas e desativa o pré-festejo. Leituras novas são tentadas a cada cinco segundos durante a contingência. A prioridade da recolha passa para segundo plano, para uma falha nessa escrita não transformar uma fotografia acabada de ler num erro 503. Diagnóstico inclui agora mensagens e causas dos erros D1. Estas medidas não garantem que a infraestrutura D1 nunca falhe.

O mercado deixa de disparar o pré-festejo sozinho. Mantém-se o boneco, os sons, o pré-festejo da projeção com pelo menos 10% apurado e o festejo oficial; as mensagens probabilísticas deixam de declarar certeza.

Verificação manual ainda necessária no iPhone: abrir a aplicação instalada no ecrã principal, ativar notificações, enviar teste para o próprio aparelho e confirmar entrega com a aplicação fechada. Não há acesso ao aparelho físico nesta sessão. Não foram enviados testes a subscritores alheios.

Recuo: desativar `data/vespera.json`, recompilar e publicar. A previsão anterior à atualização também pode ser recuperada pela versão 16 do Sites.
