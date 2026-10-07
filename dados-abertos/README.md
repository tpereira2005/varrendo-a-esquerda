# Dados abertos: evolução da contagem das eleições no Brasil

Registos da noite eleitoral, versão a versão, tal como o TSE os foi publicando: quantos votos tinha cada candidato
e que fração das secções estava apurada em cada momento, por estado. Servem para estudar como evolui uma contagem
(por exemplo, porque é que quem começa à frente nem sempre ganha) e para testar modelos de projeção.

Qualquer pessoa ou IA pode usar, copiar, modificar e redistribuir estes dados, para qualquer fim, sem pedir
autorização (ver [Licença](#licença)).

## Ficheiros

| Pasta | Eleição | O que tem |
|---|---|---|
| `2022-2t/` | 2.ª volta de 2022 (Bolsonaro × Lula) | Presidente, 27 estados, ~100–180 momentos por estado |
| `2026-1t/` | 1.ª volta de 2026 | Presidente, Governador e Senado, por estado (e Brasil), ~50–95 momentos por disputa |
| `2026-2t/` | 2.ª volta de 2026 (Flávio Bolsonaro × Lula) | Acrescentado depois de 25/10/2026: Presidente, Governador e as cidades do estrangeiro |

Em cada pasta:

- `evolucao.csv`: uma linha por candidato, em cada versão de cada disputa;
- `resumo.json`: número de linhas, disputas e o período coberto.

## Colunas de `evolucao.csv`

| Coluna | Significado |
|---|---|
| `ano`, `turno` | Eleição (ex.: 2026, 1) |
| `cargo` | `presidente`, `governador` ou `senador` |
| `uf` | Sigla do estado; `BR` = Brasil; `ZZ` = estrangeiro |
| `cidade_codigo` | Só no estrangeiro por cidade: código TSE da cidade do posto consular |
| `gravado_em_utc` | Quando a versão foi lida (UTC, ISO 8601) |
| `gerado_tse_utc` | Hora oficial de geração do ficheiro pelo TSE (UTC), quando disponível |
| `fracao_secoes_apuradas` | Secções apuradas, de 0 a 1 |
| `numero`, `nome`, `partido` | Candidato (o nome e o partido podem faltar nas cidades e em 2022) |
| `votos` | Votos do candidato nessa versão (acumulados) |
| `eleitores`, `comparecimento`, `abstencao`, `brancos`, `nulos` | Participação nas secções apuradas, quando disponível (2.ª volta de 2026) |

Exemplo em Python:

```python
import pandas as pd
d = pd.read_csv("2026-1t/evolucao.csv")
sp = d[(d.cargo == "presidente") & (d.uf == "SP")]
print(sp.pivot_table(index="gravado_em_utc", columns="nome", values="votos").tail())
```

## Notas

- Só há uma linha por versão nova: se o TSE não mudou o ficheiro, não há registo novo.
- Os votos são os da totalização oficial do TSE no momento, ainda não definitivos; o resultado final oficial é o
  último registo de cada disputa, ou o publicado pelo TSE.
- Os deputados ficaram de fora do histórico (mais de mil candidatos por estado em cada versão); os resultados finais
  estão no portal de dados abertos do TSE.
- Em 2026 os registos foram gravados pelo site [Varrendo a Esquerda](https://varrendo-a-esquerda.tomaspereira.chatgpt.site)
  a partir dos ficheiros públicos do TSE (`resultados.tse.jus.br`). Podem faltar versões publicadas e substituídas
  pelo TSE entre duas leituras.
- A 2.ª volta de 2022 vem das gravações do Divulga TSE feitas durante a noite por Wesley Cota
  ([github.com/wcota/br_eleicoes_2022_2T](https://github.com/wcota/br_eleicoes_2022_2T)), a quem agradecemos.

## Como se gera

Qualquer pessoa pode descarregar diretamente do site as versões gravadas (endereço público, por páginas):
`https://varrendo-a-esquerda.tomaspereira.chatgpt.site/api/dados?turno=2&depois=0&limite=1000`
(continuar com `depois=<seguinte>` até `seguinte` ser `null`).

```bash
# descarregar do site e gerar o CSV (a partir da pasta site/)
npm run dados:descarregar -- 2
# a partir de uma exportação da tabela `revisions` da base do site
node --max-old-space-size=4096 scripts/dados-abertos.mjs ../arquivo/revisoes-1a-volta.json 2026 1
# 2.ª volta de 2022
node scripts/dados-abertos.mjs 2022 2022 2
```

## Licença

Os resultados eleitorais são informação pública do Tribunal Superior Eleitoral. Esta compilação é dedicada ao
domínio público com a [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.pt): pode ser usada para
qualquer fim, incluindo comercial e treino de modelos de IA, sem necessidade de autorização nem de atribuição
(embora uma referência seja bem-vinda). Os dados de 2022 vêm do repositório de Wesley Cota, cujo autor permite o uso
livre e pede apenas que seja referenciado.

---

*English: open data with the vote-count evolution of Brazilian elections (2022 runoff, 2026 first round and, after
25 Oct 2026, the 2026 runoff), one CSV row per candidate per published version, by state. Public domain (CC0 1.0).*
