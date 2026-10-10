# Contribuir

Obrigado pelo interesse. O projeto é pequeno e mantido por uma pessoa, por isso o mais útil é:

- **Erros e sugestões**: [abrir um issue](https://github.com/tpereira2005/varrendo-a-esquerda/issues/new/choose), com capturas de ecrã quando for algo visual (e o aparelho/browser).
- **Dados**: correções aos [dados abertos](dados-abertos/) ou gravações de outras noites eleitorais (estado a estado) para testar a projeção.

## Antes de enviar alterações

```bash
npm install
npm run lint
npx tsc --noEmit -p .
npm test        # inclui as noites reais de 2022 e 2026 (scripts/backtest.mjs)
npm run build
```

O GitHub corre o mesmo em cada envio (`.github/workflows/testes.yml`).

## Regras do projeto

1. Os números oficiais vêm só dos ficheiros do TSE, sem alterações.
2. Vitória só com indicação oficial do TSE.
3. Estimativas (projeção, mercado de apostas) sempre identificadas como "não oficiais".
4. Interface em português de Portugal.
5. Mudanças na projeção (`lib/projecao.mjs`) têm de continuar a passar os testes das noites reais e a calibração (`npm run projecao:real`, `npm run projecao:simular`).

Ao contribuir, aceitas que o código fica sob a [licença MIT](LICENSE) e os dados sob [CC0](dados-abertos/README.md#licença).
