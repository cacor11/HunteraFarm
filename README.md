# HunteraFarm

Player não oficial para Windows que reúne de uma a quatro contas do Huntera em uma única janela, com sessões separadas.

Site público: <https://cacor11.github.io/HunteraFarm/>

## Versões

- **Estável no site:** `v1.1.0`.
- **Em preparação:** `v1.2.0`, que inicia com uma conta para economizar memória e permite adicionar ou fechar telas individualmente até o limite de quatro.

A versão 1.2 só substituirá o download estável depois dos testes finais e da assinatura Authenticode. Os pacotes temporários gerados pelo GitHub Actions são artefatos de revisão e não são lançamentos públicos.

## Código do aplicativo

O código-fonte do player fica em [`app`](app). Para testar e compilar no Windows:

```text
cd app
pnpm install --frozen-lockfile
pnpm test
pnpm smoke
pnpm smoke:lifecycle
pnpm dist
```

O fluxo de integração contínua repete esses testes, cria os pacotes de revisão e publica os hashes SHA-256. A procedência gerada pelo GitHub não substitui a assinatura Authenticode do Windows.

## Site

O conteúdo público fica em [`site`](site) e é publicado automaticamente pelo GitHub Pages.

## Segurança e assinatura

Consulte a [Code signing policy](CODE_SIGNING_POLICY.md) e a [política de segurança](.github/SECURITY.md). Chaves privadas e certificados nunca são armazenados neste repositório.

## Licença e aviso

O código do HunteraFarm é disponibilizado sob a [licença MIT](LICENSE). HunteraFarm é um projeto independente e não oficial, sem vínculo com o Huntera ou seus responsáveis.
