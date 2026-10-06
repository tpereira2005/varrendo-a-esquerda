# Varrendo a Esquerda · Eleições Brasil 2026

Painel em tempo real da **2.ª volta das presidenciais brasileiras** (25 de outubro de 2026): **Flávio Bolsonaro (PL, 22) × Lula (PT, 13)**, com os resultados oficiais do Tribunal Superior Eleitoral (TSE), visto por quem torce pelo Flávio.

Site: https://varrendo-eleicoes-brasil-2026.tomaspereira.chatgpt.site

Inspirado no projeto [ODevLibertario/varrendo-a-esquerda](https://github.com/ODevLibertario/varrendo-a-esquerda), de onde vem o critério de agrupamento dos partidos (`lib/parties.json`).

## O que mostra

- **Placar nacional** com o boneco do projeto original, que reage ao que o candidato atrás precisaria para virar.
- **"Para virar"**: percentagem dos votos por apurar de que o candidato atrás precisaria (estimativa identificada como tal).
- **Evolução da noite**, **mapa** por estado (com os estados que viraram face à 1.ª volta) e **detalhe de cada estado**.
- **Voto no estrangeiro** por país e cidade com consulado, com Portugal no topo.
- **Governadores** nos 7 estados com 2.ª volta e **arquivo da 1.ª volta** (estados e estrangeiro por país).
- Avisos (viradas, marcos, estados decididos, resultado oficial), notificações do sistema e **modo festejo** se o TSE declarar o Flávio eleito.
- Telemóvel e PC, tema claro (predefinido) e escuro.

## Regras

1. Todos os números vêm dos ficheiros oficiais do TSE, sem alterações.
2. Vitória só com indicação oficial do TSE; ir à frente não chega.
3. Estimativas aparecem sempre identificadas como "não oficiais".
4. O agrupamento "direita/esquerda" é o critério do projeto original, não do TSE.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `app/` | Página (renderizada no servidor) e API: `/api/state`, `/api/collect`, `/api/arquivo` |
| `components/painel/` | Componentes da página (placar, mapa, estrangeiro, festejo, …) |
| `lib/` | Leitura dos ficheiros do TSE, disputas, interpretação, base de dados e recolha |
| `data/` | Resultados finais da 1.ª volta (gerados) e `data/fontes/`, os ficheiros oficiais de origem |
| `db/`, `drizzle/` | Esquema e migrações da base D1 |
| `scripts/` | Geração do arquivo, simulador do TSE e ferramentas do modelo Sites |
| `test/` | Testes automáticos (`npm test`) |
| `docs/` | [Operação e noite da eleição](docs/operacao.md), [plano](docs/plano-segunda-volta.md), [base técnica](docs/base-tecnica-sites.md) |
| `build/`, `.openai/` | Integração com o alojamento Sites (não alterar) |

## Comandos

```bash
npm run dev            # site local em http://localhost:5173
npm test               # testes
npm run simulador      # simulador do TSE para ensaiar a noite (ver docs/operacao.md)
npm run dados:1a-volta # regenera o arquivo da 1.ª volta a partir de data/fontes
npm run lint
npm run build
```

Requer Node.js 22.13 ou mais recente. A publicação é feita pelo plugin Sites da OpenAI (Codex); ver [docs/operacao.md](docs/operacao.md).

## Fontes

- [Divulgação de resultados do TSE](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados) e [formato do ficheiro unificado](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea20-arquivo-de-resultado-unificado).
- Mapa do Brasil e reações do boneco: projeto original.

## Licença

Código sob a [licença MIT](LICENSE). Exceções, que pertencem aos respetivos autores:

- `lib/parties.json`, `lib/brazil-map.json` e as imagens do boneco (`public/emoji/`), vindos do [projeto original](https://github.com/ODevLibertario/varrendo-a-esquerda);
- os ficheiros oficiais em `data/fontes/` e os dados derivados deles, publicados pelo TSE;
- `build/sites-vite-plugin.ts`, que tem a sua própria licença (`build/sites-vite-plugin.LICENSE`).
